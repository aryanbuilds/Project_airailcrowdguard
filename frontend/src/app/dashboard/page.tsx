"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, AlertCircle, Map as MapIcon, List as ListIcon, ShieldCheck, Terminal, Upload, Activity, Radar, Siren, Bot } from "lucide-react";

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
    } catch (err: unknown) {
      console.error("Fetch error:", err);
      setError(err instanceof Error ? err.message : "An error occurred");
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
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="chip">
                <Activity className="h-3.5 w-3.5" />
                Operations
              </span>
              <span className="chip">
                <Radar className="h-3.5 w-3.5" />
                Monitoring
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Operator Control Center</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live anomaly stream • {incidents.length} incidents • auto-refresh 10s
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex items-center gap-1 rounded-2xl border bg-white/5 p-1">
              <button
                onClick={() => setView('list')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold transition-all ${
                  view === 'list'
                    ? 'bg-white/10 text-foreground border border-white/10'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ListIcon className="h-4 w-4" />
                List
              </button>
              <button
                onClick={() => setView('map')}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold transition-all ${
                  view === 'map'
                    ? 'bg-white/10 text-foreground border border-white/10'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <MapIcon className="h-4 w-4" />
                Map
              </button>
            </div>

            <button
              onClick={fetchIncidents}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/5 px-4 py-2 text-sm font-extrabold hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Sync
            </button>

            <Link
              href="/copilot"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-black text-white hover:brightness-110"
            >
              <Bot className="h-4 w-4" />
              AI Copilot
            </Link>
            <Link
              href="/console"
              target="_blank"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/5 px-4 py-2 text-sm font-extrabold hover:bg-white/10"
            >
              <Terminal className="h-4 w-4" />
              Console
            </Link>
            <Link
              href="/upload"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[color:var(--rail-accent)] to-[color:var(--rail-accent-2)] px-4 py-2 text-sm font-black text-slate-950 hover:brightness-110"
            >
              <Upload className="h-4 w-4" />
              New Report
            </Link>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="neon-edge rounded-3xl bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">Active Incidents</div>
            <span className="chip">Live</span>
          </div>
          <div className="mt-2 text-3xl font-black">{incidents.length}</div>
          <div className="mt-1 text-xs text-muted-foreground">Includes unverified + verified + dismissed</div>
        </div>
        <div className="neon-edge rounded-3xl bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">High Severity</div>
            <Siren className="h-4 w-4 text-[color:var(--rail-danger)]" />
          </div>
          <div className="mt-2 text-3xl font-black">{incidents.filter(i => i.severity === 'HIGH').length}</div>
          <div className="mt-1 text-xs text-muted-foreground">Immediate dispatch recommended</div>
        </div>
        <div className="neon-edge rounded-3xl bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">System Status</div>
            <span className="chip">Telemetry</span>
          </div>
          <div className="mt-2 text-3xl font-black">{error ? 'Degraded' : 'Nominal'}</div>
          <div className="mt-1 text-xs text-muted-foreground">Backend: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}</div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1">
        {error ? (
          <div className="neon-edge rounded-3xl bg-white/5 p-8 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-[color:var(--rail-danger)]/10">
              <AlertCircle className="h-8 w-8 text-[color:var(--rail-danger)]" />
            </div>
            <h2 className="mt-4 text-xl font-black">Control Link Lost</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Could not reach the analysis engine at {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}.
            </p>
            <button
              onClick={fetchIncidents}
              className="mt-6 rounded-2xl bg-gradient-to-r from-[color:var(--rail-accent)] to-[color:var(--rail-accent-2)] px-6 py-2.5 text-sm font-black text-slate-950 hover:brightness-110"
            >
              Retry Sync
            </button>
          </div>
        ) : loading ? (
          <div className="neon-edge rounded-3xl bg-white/5 p-8">
            <div className="flex items-center gap-3">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-2 animate-ping rounded-full bg-[color:var(--rail-accent)] opacity-40" />
                <span className="relative inline-flex size-2 rounded-full bg-[color:var(--rail-accent)]" />
              </span>
              <div className="text-sm font-bold">Acquiring incident feed…</div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">Waiting for backend response.</div>
          </div>
        ) : incidents.length === 0 ? (
          <div className="neon-edge rounded-3xl bg-white/5 p-10 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-[color:var(--rail-accent)]/10">
              <ShieldCheck className="h-8 w-8 text-[color:var(--rail-accent)]" />
            </div>
            <h2 className="mt-4 text-2xl font-black">All Lines Clear</h2>
            <p className="mt-2 text-sm text-muted-foreground">No anomalies detected in the current reporting window.</p>
          </div>
        ) : (
          <div className={view === 'list' ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4' : ''}>
            {view === 'list' ? (
              incidents.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  onClick={(id) => setSelectedIncidentId(id)}
                />
              ))
            ) : (
              <div className="neon-edge relative h-[620px] w-full overflow-hidden rounded-3xl bg-white/5">
                <IncidentMap incidents={incidents} onMarkerClick={(id) => setSelectedIncidentId(id)} />
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
