"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, AlertCircle, Map as MapIcon, List as ListIcon, ShieldCheck } from "lucide-react";
import IncidentCard from "@/components/IncidentCard";
import SeverityBadge from "@/components/SeverityBadge";
import IncidentDetailModal from "@/components/IncidentDetailModal";
import dynamic from "next/dynamic";

const IncidentMap = dynamic(() => import("@/components/IncidentMap"), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-100 flex items-center justify-center animate-pulse">Loading Map...</div>
});

interface Incident {
  id: string;
  media_id: string;
  lat: number;
  lng: number;
  timestamp: string;
  tampering_score: number;
  fault_type: string;
  severity: string;
  status: string;
}

export default function Dashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'list'>('list');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const fetchIncidents = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/incidents`);
      if (!response.ok) throw new Error("Failed to fetch incidents");
      const data = await response.json();
      setIncidents(data);
      setError(null);
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleVerify = async (id: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/incidents/${id}?status=verified`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      });
      fetchIncidents();
      setSelectedIncidentId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/incidents/${id}?status=dismissed`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      });
      fetchIncidents();
      setSelectedIncidentId(null);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);


  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-slate-50">
      {/* Dashboard Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-slate-900">Operator Dashboard</h1>
            <p className="text-sm text-slate-500">Monitoring {incidents.length} active anomalies</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg bg-slate-100 p-1">
              <button 
                onClick={() => setView('list')}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${view === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <ListIcon className="h-4 w-4" />
                List
              </button>
              <button 
                onClick={() => setView('map')}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${view === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <MapIcon className="h-4 w-4" />
                Map
              </button>
            </div>
            <button 
              onClick={fetchIncidents}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Sync
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="rounded-full bg-red-50 p-6">
              <AlertCircle className="h-12 w-12 text-red-500" />
            </div>
            <h2 className="mt-4 text-xl font-bold">API Connection Error</h2>
            <p className="mt-2 text-slate-600 max-w-md">Could not connect to the analysis engine. Ensure the FastAPI backend is running on {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}.</p>
            <button onClick={fetchIncidents} className="mt-6 text-blue-600 font-bold hover:underline">Retry Connection</button>
          </div>
        ) : incidents.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="rounded-full bg-emerald-50 p-6">
              <ShieldCheck className="h-12 w-12 text-emerald-500" />
            </div>
            <h2 className="mt-4 text-xl font-bold font-serif italic text-slate-900">All Tracks Clear</h2>
            <p className="mt-2 text-slate-600">No railway track anomalies detected in recent reports.</p>
          </div>
        ) : (
          <div className={`h-full ${view === 'list' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 content-start' : ''}`}>
            {view === 'list' ? (
              incidents.map(incident => (
                <IncidentCard 
                  key={incident.id} 
                  incident={incident} 
                  onClick={(id) => setSelectedIncidentId(id)} 
                />
              ))
            ) : (
              <div className="h-full w-full min-h-[500px] rounded-2xl border-4 border-white bg-white shadow-xl overflow-hidden relative">
                <IncidentMap 
                  incidents={incidents} 
                  onMarkerClick={(id) => setSelectedIncidentId(id)} 
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Incident Detail Modal */}
      {selectedIncidentId && (
        <IncidentDetailModal 
          incidentId={selectedIncidentId}
          onClose={() => setSelectedIncidentId(null)}
          onVerify={handleVerify}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
}
