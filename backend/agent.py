"""
LangGraph Agent for Railway Graph-RAG Copilot

This module implements a stateful agent that:
1. Converts natural language queries to Cypher
2. Executes queries against Neo4j with self-correction
3. Synthesizes human-readable responses

Architecture:
    User Question -> Query Generator (LLM) -> Query Executor (Neo4j) -> Response Synthesizer (LLM)
                              ^                       |
                              |________ Error ________|  (Self-Correction Loop)
"""

import os
from typing import Dict, List, Optional, Literal, Annotated, TypedDict
from datetime import datetime

from langgraph.graph import StateGraph, END
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_ollama import ChatOllama

from backend.graph_db import GraphRepository, Neo4jConnection


# ============================================================================
# Configuration
# ============================================================================

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
MAX_RETRIES = 3


# ============================================================================
# Agent State Definition
# ============================================================================

class AgentState(TypedDict):
    """State that flows through the LangGraph workflow."""
    question: str                           # Original user question
    cypher_query: str                       # Generated Cypher query
    db_results: List[Dict]                  # Results from Neo4j
    error: Optional[str]                    # Error message if query failed
    retry_count: int                        # Number of retries attempted
    final_answer: str                       # Natural language response
    structured_data: Optional[List[Dict]]   # Structured data for frontend rendering


# ============================================================================
# Neo4j Schema Context for LLM
# ============================================================================

GRAPH_SCHEMA = """
## Neo4j Graph Schema for Railway Anomaly Detection

### Nodes:

1. **Track** - Represents a railway track/line
   - Properties: track_id (string), name (string), region (string), total_length_km (float), status (string)
   - Example: (:Track {track_id: 'TRACK-001', name: 'Main Line North', region: 'Northern Division'})

2. **Segment** - A geographic section of a track
   - Properties: segment_id (string), start_km (float), end_km (float), lat (float), lng (float), terrain_type (string)
   - Example: (:Segment {segment_id: 'SEG-001-001', lat: 20.5, lng: 78.3, terrain_type: 'bridge'})

3. **Inspection** - A single inspection event
   - Properties: inspection_id (string), media_id (string), timestamp (string), inspector_name (string), inspection_type (string)
   - Example: (:Inspection {inspection_id: 'INSP-abc123', timestamp: '2025-01-10T14:30:00', inspection_type: 'drone'})

4. **Anomaly** - A detected defect/issue
   - Properties: anomaly_id (string), anomaly_type (string), severity (string), confidence (float), image_path (string), status (string), detected_at (string)
   - anomaly_type values: crack, missing_bolt, missing_clamp, debris, rail_wear, broken_tie, gauge_deviation, vegetation_overgrowth, ballast_deficiency
   - severity values: LOW, MEDIUM, HIGH, CRITICAL
   - status values: open, verified, resolved, dismissed
   - Example: (:Anomaly {anomaly_id: 'ANOM-xyz789', anomaly_type: 'crack', severity: 'HIGH', confidence: 0.87, status: 'open'})

### Relationships:

1. (:Segment)-[:PART_OF]->(:Track)
   - A segment belongs to a track

2. (:Anomaly)-[:LOCATED_AT]->(:Segment)
   - An anomaly is located at a specific segment

3. (:Anomaly)-[:FOUND_IN]->(:Inspection)
   - An anomaly was discovered during an inspection

### Common Query Patterns:

- Find anomalies by severity: MATCH (a:Anomaly {severity: 'HIGH'}) RETURN a
- Find anomalies on a track: MATCH (a:Anomaly)-[:LOCATED_AT]->(s:Segment)-[:PART_OF]->(t:Track {track_id: 'TRACK-001'}) RETURN a, s, t
- Count by type: MATCH (a:Anomaly) RETURN a.anomaly_type, count(a) as count ORDER BY count DESC
- Recent inspections: MATCH (i:Inspection) RETURN i ORDER BY i.timestamp DESC LIMIT 10
"""


# ============================================================================
# Few-Shot Examples for Cypher Generation
# ============================================================================

FEW_SHOT_EXAMPLES = """
## Example Queries:

### Example 1:
User: "Show me all critical cracks on Track 5"
Cypher:
```cypher
MATCH (a:Anomaly {anomaly_type: 'crack', severity: 'CRITICAL'})-[:LOCATED_AT]->(s:Segment)-[:PART_OF]->(t:Track)
WHERE t.track_id CONTAINS '005' OR t.name CONTAINS '5'
RETURN a.anomaly_id as id, a.anomaly_type as type, a.severity as severity, 
       a.confidence as confidence, a.status as status, a.detected_at as detected_at,
       s.lat as lat, s.lng as lng, t.name as track_name
ORDER BY a.detected_at DESC
```

### Example 2:
User: "How many anomalies are there by type?"
Cypher:
```cypher
MATCH (a:Anomaly)
RETURN a.anomaly_type as anomaly_type, count(a) as count
ORDER BY count DESC
```

### Example 3:
User: "What are the most recent HIGH severity issues?"
Cypher:
```cypher
MATCH (a:Anomaly {severity: 'HIGH'})-[:LOCATED_AT]->(s:Segment)-[:PART_OF]->(t:Track)
MATCH (a)-[:FOUND_IN]->(i:Inspection)
RETURN a.anomaly_id as id, a.anomaly_type as type, a.severity as severity,
       a.confidence as confidence, a.detected_at as detected_at,
       t.name as track_name, s.lat as lat, s.lng as lng,
       i.inspector_name as inspector
ORDER BY a.detected_at DESC
LIMIT 10
```

### Example 4:
User: "Show me all open issues that need attention"
Cypher:
```cypher
MATCH (a:Anomaly {status: 'open'})-[:LOCATED_AT]->(s:Segment)-[:PART_OF]->(t:Track)
WHERE a.severity IN ['HIGH', 'CRITICAL']
RETURN a.anomaly_id as id, a.anomaly_type as type, a.severity as severity,
       a.confidence as confidence, a.image_path as image_path,
       t.name as track_name, t.track_id as track_id,
       s.lat as lat, s.lng as lng
ORDER BY 
    CASE a.severity 
        WHEN 'CRITICAL' THEN 1 
        WHEN 'HIGH' THEN 2 
        WHEN 'MEDIUM' THEN 3 
        ELSE 4 
    END,
    a.detected_at DESC
```

### Example 5:
User: "Give me a summary of the track with the most problems"
Cypher:
```cypher
MATCH (a:Anomaly)-[:LOCATED_AT]->(s:Segment)-[:PART_OF]->(t:Track)
WITH t, count(a) as total_anomalies,
     sum(CASE WHEN a.severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical,
     sum(CASE WHEN a.severity = 'HIGH' THEN 1 ELSE 0 END) as high,
     sum(CASE WHEN a.status = 'open' THEN 1 ELSE 0 END) as open_issues
ORDER BY total_anomalies DESC
LIMIT 1
RETURN t.track_id as track_id, t.name as track_name, t.region as region,
       total_anomalies, critical, high, open_issues
```

### Example 6:
User: "Find segments with multiple defects"
Cypher:
```cypher
MATCH (a:Anomaly)-[:LOCATED_AT]->(s:Segment)-[:PART_OF]->(t:Track)
WITH s, t, collect(a) as anomalies, count(a) as defect_count
WHERE defect_count > 1
RETURN s.segment_id as segment_id, s.lat as lat, s.lng as lng,
       t.name as track_name, defect_count,
       [x IN anomalies | x.anomaly_type] as defect_types
ORDER BY defect_count DESC
LIMIT 10
```
"""


# ============================================================================
# Prompt Templates
# ============================================================================

CYPHER_GENERATION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a Neo4j Cypher expert for a Railway Anomaly Detection system.

{schema}

{examples}

## Instructions:
1. Generate ONLY valid Cypher queries based on the schema above.
2. Always return useful fields like id, type, severity, coordinates (lat, lng), and timestamps.
3. Use proper property names as shown in the schema (e.g., anomaly_type, not defect_type).
4. For track references by number (like "Track 5"), search both track_id (CONTAINS '005') and name (CONTAINS '5').
5. Always ORDER results meaningfully (by severity, date, or count).
6. Return ONLY the Cypher query, no explanations.

{error_context}
"""),
    ("human", "{question}")
])

RESPONSE_SYNTHESIS_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are a helpful railway maintenance assistant. 
Your job is to explain database query results in clear, professional language.

## Guidelines:
1. Summarize the key findings from the data.
2. Highlight critical or high-severity issues first.
3. Mention specific locations (track names, coordinates) when relevant.
4. If data shows anomalies, recommend appropriate actions.
5. Keep responses concise but informative.
6. If no results were found, explain this clearly and suggest alternative queries.
7. Format numbers nicely (e.g., "87% confidence" not "0.87 confidence").
"""),
    ("human", """User's question: {question}

Query results:
{results}

Please provide a helpful, natural language response summarizing these findings.""")
])


# ============================================================================
# LLM Initialization
# ============================================================================

def get_llm():
    """Get configured Ollama LLM instance."""
    return ChatOllama(
        base_url=OLLAMA_BASE_URL,
        model=OLLAMA_MODEL,
        temperature=0.1,  # Low temperature for consistent Cypher generation
        num_ctx=8192,     # Context window
    )


# ============================================================================
# Agent Node Functions
# ============================================================================

def query_generator(state: AgentState) -> AgentState:
    """
    Node 1: Convert natural language to Cypher query.
    Uses few-shot prompting with schema context.
    """
    llm = get_llm()
    
    # Add error context if this is a retry
    error_context = ""
    if state.get("error") and state.get("retry_count", 0) > 0:
        error_context = f"""
## Previous Query Error:
Your previous query failed with error: {state['error']}
Previous query was: {state.get('cypher_query', 'N/A')}

Please fix the syntax error and try again. Common issues:
- Use correct property names from the schema
- Ensure proper Cypher syntax
- Check relationship directions
"""
    
    chain = CYPHER_GENERATION_PROMPT | llm | StrOutputParser()
    
    response = chain.invoke({
        "schema": GRAPH_SCHEMA,
        "examples": FEW_SHOT_EXAMPLES,
        "error_context": error_context,
        "question": state["question"]
    })
    
    # Extract Cypher from response (handle markdown code blocks)
    cypher = response.strip()
    if "```cypher" in cypher:
        cypher = cypher.split("```cypher")[1].split("```")[0].strip()
    elif "```" in cypher:
        cypher = cypher.split("```")[1].split("```")[0].strip()
    
    return {
        **state,
        "cypher_query": cypher,
        "error": None  # Clear previous error
    }


def query_executor(state: AgentState) -> AgentState:
    """
    Node 2: Execute Cypher query against Neo4j.
    Captures errors for potential self-correction.
    """
    try:
        results = GraphRepository.execute_cypher(state["cypher_query"])
        
        # Convert Neo4j types to JSON-serializable format
        serializable_results = []
        for record in results:
            clean_record = {}
            for key, value in record.items():
                if hasattr(value, 'isoformat'):  # datetime
                    clean_record[key] = value.isoformat()
                elif hasattr(value, '__dict__'):  # Node/Relationship
                    clean_record[key] = dict(value)
                else:
                    clean_record[key] = value
            serializable_results.append(clean_record)
        
        return {
            **state,
            "db_results": serializable_results,
            "error": None
        }
        
    except Exception as e:
        error_msg = str(e)
        return {
            **state,
            "db_results": [],
            "error": error_msg,
            "retry_count": state.get("retry_count", 0) + 1
        }


def response_synthesizer(state: AgentState) -> AgentState:
    """
    Node 3: Convert database results to natural language response.
    Also prepares structured data for frontend rendering.
    """
    llm = get_llm()
    
    # Handle empty results
    if not state["db_results"]:
        return {
            **state,
            "final_answer": f"I couldn't find any results for your query: '{state['question']}'. This might mean there's no matching data, or you could try rephrasing your question.",
            "structured_data": []
        }
    
    # Format results for the LLM
    results_text = ""
    for i, record in enumerate(state["db_results"][:20], 1):  # Limit to 20 for context
        results_text += f"\n{i}. {record}"
    
    if len(state["db_results"]) > 20:
        results_text += f"\n... and {len(state['db_results']) - 20} more results"
    
    chain = RESPONSE_SYNTHESIS_PROMPT | llm | StrOutputParser()
    
    answer = chain.invoke({
        "question": state["question"],
        "results": results_text
    })
    
    return {
        **state,
        "final_answer": answer,
        "structured_data": state["db_results"]
    }


def should_retry(state: AgentState) -> Literal["retry", "synthesize", "fail"]:
    """
    Conditional edge: Decide whether to retry, proceed, or fail.
    """
    if state.get("error"):
        if state.get("retry_count", 0) < MAX_RETRIES:
            return "retry"
        else:
            return "fail"
    return "synthesize"


def handle_failure(state: AgentState) -> AgentState:
    """
    Terminal node for unrecoverable failures.
    """
    return {
        **state,
        "final_answer": f"I'm sorry, I couldn't process your query after {MAX_RETRIES} attempts. The last error was: {state.get('error', 'Unknown error')}. Please try rephrasing your question or ask for help with the specific query.",
        "structured_data": []
    }


# ============================================================================
# Graph Workflow Construction
# ============================================================================

def build_agent_graph() -> StateGraph:
    """
    Build the LangGraph workflow for the Railway RAG agent.
    
    Flow:
        START -> query_generator -> query_executor -> [conditional]
                     ^                                    |
                     |_____ retry (if error) _____________|
                                                          |
                                                          v
                                               response_synthesizer -> END
                                                          |
                                                     fail_handler -> END
    """
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("query_generator", query_generator)
    workflow.add_node("query_executor", query_executor)
    workflow.add_node("response_synthesizer", response_synthesizer)
    workflow.add_node("fail_handler", handle_failure)
    
    # Set entry point
    workflow.set_entry_point("query_generator")
    
    # Add edges
    workflow.add_edge("query_generator", "query_executor")
    
    # Conditional routing after execution
    workflow.add_conditional_edges(
        "query_executor",
        should_retry,
        {
            "retry": "query_generator",
            "synthesize": "response_synthesizer",
            "fail": "fail_handler"
        }
    )
    
    # Terminal edges
    workflow.add_edge("response_synthesizer", END)
    workflow.add_edge("fail_handler", END)
    
    return workflow.compile()


# ============================================================================
# Public Interface
# ============================================================================

# Compiled agent (singleton)
_agent = None


def get_agent():
    """Get or create the compiled LangGraph agent."""
    global _agent
    if _agent is None:
        _agent = build_agent_graph()
    return _agent


async def process_query(question: str) -> Dict:
    """
    Process a natural language query through the Graph-RAG pipeline.
    
    Args:
        question: User's natural language question
    
    Returns:
        Dict containing:
            - question: Original question
            - cypher_query: Generated Cypher
            - answer: Natural language response
            - data: Structured data for frontend
            - error: Error message if any
    """
    agent = get_agent()
    
    initial_state: AgentState = {
        "question": question,
        "cypher_query": "",
        "db_results": [],
        "error": None,
        "retry_count": 0,
        "final_answer": "",
        "structured_data": None
    }
    
    # Run the agent
    final_state = await agent.ainvoke(initial_state)
    
    return {
        "question": final_state["question"],
        "cypher_query": final_state["cypher_query"],
        "answer": final_state["final_answer"],
        "data": final_state.get("structured_data", []),
        "error": final_state.get("error"),
        "retries": final_state.get("retry_count", 0)
    }


def process_query_sync(question: str) -> Dict:
    """Synchronous version of process_query."""
    import asyncio
    return asyncio.run(process_query(question))


# ============================================================================
# Direct Query Tools (for debugging/testing)
# ============================================================================

def test_cypher_generation(question: str) -> str:
    """Test Cypher generation without executing."""
    state: AgentState = {
        "question": question,
        "cypher_query": "",
        "db_results": [],
        "error": None,
        "retry_count": 0,
        "final_answer": "",
        "structured_data": None
    }
    result = query_generator(state)
    return result["cypher_query"]


# ============================================================================
# Module Test
# ============================================================================

if __name__ == "__main__":
    import asyncio
    
    # Test queries
    test_questions = [
        "Show me all critical anomalies",
        "How many anomalies are there by type?",
        "What tracks have the most issues?",
    ]
    
    print("=" * 60)
    print("Railway Graph-RAG Agent Test")
    print("=" * 60)
    
    for q in test_questions:
        print(f"\n📝 Question: {q}")
        print("-" * 40)
        
        # Test Cypher generation
        cypher = test_cypher_generation(q)
        print(f"🔧 Generated Cypher:\n{cypher}")
        
        # Full pipeline test (requires Neo4j connection)
        try:
            result = asyncio.run(process_query(q))
            print(f"\n💬 Answer: {result['answer'][:200]}...")
            print(f"📊 Results: {len(result.get('data', []))} records")
        except Exception as e:
            print(f"❌ Error: {e}")
        
        print("=" * 60)
