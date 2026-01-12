"use client";

import dynamic from "next/dynamic";
import { Bot, Database, Activity, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

// Dynamic import to avoid SSR issues with chat component
const ChatComponent = dynamic(() => import("@/components/ChatComponent"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  ),
});

interface HealthStatus {
  neo4j: boolean;
  ollama: boolean;
  models_loaded: boolean;
}

interface GraphStats {
  tracks: number;
  segments: number;
  inspections: number;
  total_anomalies: number;
  open_anomalies: number;
  critical: number;
  high_severity: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function CopilotPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Fetch health status
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/v1/graph/health`);
        const data = await resp.json();
        setHealth(data);
      } catch {
        setHealth({ neo4j: false, ollama: false, models_loaded: false });
      }
    };

    const fetchStats = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/v1/graph/stats`);
        const data = await resp.json();
        setStats(data);
      } catch {
        setStats(null);
      }
    };

    checkHealth();
    fetchStats();

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      checkHealth();
      fetchStats();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const initializeDemo = async () => {
    setIsInitializing(true);
    try {
      // Initialize schema
      await fetch(`${API_BASE}/api/v1/graph/init`, { method: "POST" });
      // Generate demo data
      await fetch(`${API_BASE}/api/v1/graph/demo-data?count=50`, { method: "POST" });
      // Refresh stats
      const resp = await fetch(`${API_BASE}/api/v1/graph/stats`);
      const data = await resp.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to initialize demo:", error);
    } finally {
      setIsInitializing(false);
    }
  };

  const StatusIcon: React.FC<{ ok: boolean }> = ({ ok }) =>
    ok ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-slate-900">Railway Copilot</span>
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                Graph-RAG
              </span>
            </div>

            {/* Status Indicators */}
            {health && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Database className="h-4 w-4" />
                  <span>Neo4j</span>
                  <StatusIcon ok={health.neo4j} />
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Bot className="h-4 w-4" />
                  <span>Ollama</span>
                  <StatusIcon ok={health.ollama} />
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Activity className="h-4 w-4" />
                  <span>YOLO</span>
                  <StatusIcon ok={health.models_loaded} />
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar - Stats */}
          <div className="col-span-12 lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h3 className="font-semibold text-slate-900 mb-4">Graph Statistics</h3>

              {stats ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Total Anomalies</span>
                    <span className="font-bold text-slate-900">{stats.total_anomalies}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Open Issues</span>
                    <span className="font-bold text-blue-600">{stats.open_anomalies}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Critical</span>
                    <span className="font-bold text-red-600">{stats.critical}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">High Severity</span>
                    <span className="font-bold text-orange-600">{stats.high_severity}</span>
                  </div>
                  <hr className="border-slate-200" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Tracks</span>
                    <span className="font-medium text-slate-700">{stats.tracks}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Segments</span>
                    <span className="font-medium text-slate-700">{stats.segments}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Inspections</span>
                    <span className="font-medium text-slate-700">{stats.inspections}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-sm text-slate-500 mb-4">
                    No graph data available
                  </p>
                  <button
                    onClick={initializeDemo}
                    disabled={isInitializing || !health?.neo4j}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isInitializing ? "Initializing..." : "Initialize Demo Data"}
                  </button>
                </div>
              )}
            </div>

            {/* Connection Warning */}
            {health && !health.neo4j && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-800">Neo4j Not Connected</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Start Neo4j to enable Graph-RAG queries.
                    </p>
                    <pre className="mt-2 text-xs bg-amber-100 p-2 rounded font-mono">
                      docker run -d \{"\n"}
                      {"  "}-p 7474:7474 -p 7687:7687 \{"\n"}
                      {"  "}-e NEO4J_AUTH=neo4j/password \{"\n"}
                      {"  "}neo4j:latest
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {health && !health.ollama && (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-800">Ollama Not Running</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Start Ollama with Llama 3 for AI responses.
                    </p>
                    <pre className="mt-2 text-xs bg-amber-100 p-2 rounded font-mono">
                      ollama pull llama3{"\n"}
                      ollama serve
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Main Chat Area */}
          <div className="col-span-12 lg:col-span-9">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-[calc(100vh-180px)] overflow-hidden">
              <ChatComponent />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
