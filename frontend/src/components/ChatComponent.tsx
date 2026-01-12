"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, AlertTriangle, Database, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface AnomalyData {
  id?: string;
  type?: string;
  anomaly_type?: string;
  severity?: string;
  confidence?: number;
  status?: string;
  lat?: number;
  lng?: number;
  track_name?: string;
  track_id?: string;
  detected_at?: string;
  image_path?: string;
  count?: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  data?: AnomalyData[];
  dataType?: string;
  cypherQuery?: string;
  isLoading?: boolean;
  error?: string;
}

interface ChatResponse {
  answer: string;
  cypher_query: string;
  data: AnomalyData[];
  data_type: string;
  error?: string;
}

// ============================================================================
// Utility Components
// ============================================================================

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const colors: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-800 border-red-200",
    HIGH: "bg-orange-100 text-orange-800 border-orange-200",
    MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200",
    LOW: "bg-green-100 text-green-800 border-green-200",
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${colors[severity] || "bg-gray-100 text-gray-800"}`}>
      {severity}
    </span>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    open: "bg-blue-100 text-blue-800",
    verified: "bg-purple-100 text-purple-800",
    resolved: "bg-green-100 text-green-800",
    dismissed: "bg-gray-100 text-gray-800",
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[status] || "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
};

// ============================================================================
// Data Renderers
// ============================================================================

const AnomalyTable: React.FC<{ data: AnomalyData[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Severity</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Confidence</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Track</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.slice(0, 10).map((item, idx) => (
              <tr key={item.id || idx} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                  {item.type || item.anomaly_type || "—"}
                </td>
                <td className="px-4 py-3">
                  {item.severity && <SeverityBadge severity={item.severity} />}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {item.confidence ? `${(item.confidence * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {item.track_name || item.track_id || "—"}
                </td>
                <td className="px-4 py-3">
                  {item.status && <StatusBadge status={item.status} />}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500 font-mono text-xs">
                  {item.lat && item.lng ? `${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 10 && (
        <div className="px-4 py-2 bg-slate-50 text-sm text-slate-500 text-center border-t">
          Showing 10 of {data.length} results
        </div>
      )}
    </div>
  );
};

const StatsCards: React.FC<{ data: AnomalyData[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
      {data.map((item, idx) => {
        const label = item.anomaly_type || item.type || item.track_name || `Item ${idx + 1}`;
        const count = item.count || 0;

        return (
          <div key={idx} className="bg-white rounded-lg border border-slate-200 p-4 text-center">
            <div className="text-2xl font-bold text-slate-900">{count}</div>
            <div className="text-sm text-slate-600 mt-1 capitalize">{label.replace(/_/g, " ")}</div>
          </div>
        );
      })}
    </div>
  );
};

const TracksList: React.FC<{ data: AnomalyData[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {data.map((item, idx) => (
        <div key={idx} className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-slate-900">{item.track_name || item.track_id}</h4>
              {item.track_id && item.track_name && (
                <p className="text-sm text-slate-500">{item.track_id}</p>
              )}
            </div>
            {(item as any).total_anomalies !== undefined && (
              <div className="text-right">
                <div className="text-lg font-bold text-slate-900">{(item as any).total_anomalies}</div>
                <div className="text-xs text-slate-500">anomalies</div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// Cypher Query Display
// ============================================================================

const CypherQueryBlock: React.FC<{ query: string }> = ({ query }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!query) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
      >
        <Database className="h-3 w-3" />
        <span>Cypher Query</span>
        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {isExpanded && (
        <div className="mt-2 relative">
          <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto font-mono">
            <code>{query}</code>
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1 rounded bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-slate-400" />}
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Message Component
// ============================================================================

const ChatMessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-blue-600" : "bg-slate-700"
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block rounded-2xl px-4 py-2 ${
            isUser
              ? "bg-blue-600 text-white rounded-br-md"
              : "bg-slate-100 text-slate-900 rounded-bl-md"
          }`}
        >
          {message.isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          ) : message.error ? (
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span>{message.content}</span>
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* Data Rendering */}
        {!isUser && !message.isLoading && message.data && message.data.length > 0 && (
          <div className="mt-2">
            {message.dataType === "anomalies" && <AnomalyTable data={message.data} />}
            {message.dataType === "stats" && <StatsCards data={message.data} />}
            {message.dataType === "tracks" && <TracksList data={message.data} />}
          </div>
        )}

        {/* Cypher Query */}
        {!isUser && !message.isLoading && message.cypherQuery && (
          <CypherQueryBlock query={message.cypherQuery} />
        )}

        {/* Timestamp */}
        <div className={`text-xs text-slate-400 mt-1 ${isUser ? "text-right" : ""}`}>
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Suggested Queries
// ============================================================================

const SUGGESTED_QUERIES = [
  "Show me all critical anomalies",
  "How many anomalies are there by type?",
  "What tracks have the most issues?",
  "Find all open HIGH severity issues",
  "Show recent inspections",
];

const SuggestedQueries: React.FC<{ onSelect: (query: string) => void }> = ({ onSelect }) => (
  <div className="flex flex-wrap gap-2 mb-4">
    {SUGGESTED_QUERIES.map((query, idx) => (
      <button
        key={idx}
        onClick={() => onSelect(query)}
        className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-colors text-slate-600"
      >
        {query}
      </button>
    ))}
  </div>
);

// ============================================================================
// Main Chat Component
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChatComponent() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "Analyzing your query...",
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim() }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: ChatResponse = await response.json();

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: data.answer,
        timestamp: new Date(),
        data: data.data,
        dataType: data.data_type,
        cypherQuery: data.cypher_query,
        error: data.error || undefined,
      };

      setMessages((prev) => [...prev.slice(0, -1), assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        content: `Failed to connect to the server. Please ensure the backend is running.`,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      };

      setMessages((prev) => [...prev.slice(0, -1), errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Railway Copilot</h2>
            <p className="text-sm text-slate-500">Graph-RAG powered assistant</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <Bot className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Ask me about railway anomalies
            </h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              I can query the graph database to find anomalies, track issues, inspection history, and more.
            </p>
            <SuggestedQueries onSelect={sendMessage} />
          </div>
        ) : (
          messages.map((msg) => <ChatMessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-200 px-6 py-4">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about anomalies, tracks, or inspections..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
