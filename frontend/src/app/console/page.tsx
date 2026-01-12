"use client";

import { useEffect, useState, useRef } from "react";
import { Terminal, RefreshCw, Pause, Play, Download } from "lucide-react";

export default function ConsolePage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    if (isPaused) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/logs`);
      if (response.ok) {
        const data = await response.json();
        setLogs(prev => {
          // Avoid duplicate appends if using a simpler list approach, but for full replacement:
          return data.logs;
        });
      }
    } catch (err) {
      console.error("Failed to fetch logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [isPaused]);

  useEffect(() => {
    if (scrollRef.current && !isPaused) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  return (
    <div className="flex min-h-[70vh] flex-col font-mono">
      {/* Header */}
      <div className="flex items-center justify-between rounded-3xl border bg-white/5 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border bg-white/5 p-2">
            <Terminal className="h-5 w-5 text-[color:var(--rail-accent)]" />
          </div>
          <div>
            <h1 className="text-lg font-bold">System Console</h1>
            <p className="text-xs text-muted-foreground">Real-time processing logs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors border ${
              isPaused ? "bg-[color:var(--rail-warning)] text-slate-950 border-white/10" : "bg-white/5 text-muted-foreground hover:text-foreground border-white/10"
            }`}
          >
            {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {isPaused ? "Resume" : "Pause"}
          </button>
          <button 
            onClick={() => setLogs([])}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-muted-foreground hover:bg-white/10 hover:text-foreground"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Log Window */}
      <div 
        ref={scrollRef}
        className="mt-4 flex-1 overflow-auto rounded-3xl border bg-black/30 p-4 scroll-smooth"
      >
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <p className="italic">Waiting for logs...</p>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, i) => (
              <div key={i} className="text-sm border-l-2 border-transparent hover:border-white/10 pl-2 py-0.5 whitespace-pre-wrap break-all">
                <span className="text-muted-foreground select-none mr-3 text-xs">{(i + 1).toString().padStart(4, '0')}</span>
                <span className={
                  log.includes("ERROR") ? "text-red-400" :
                  log.includes("WARNING") ? "text-amber-400" :
                  log.includes("SUCCESS") ? "text-emerald-400" :
                  log.includes("Processing") ? "text-blue-400" :
                  "text-slate-200"
                }>
                  {log}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Status */}
      <div className="mt-4 rounded-3xl border bg-white/5 px-4 py-2 text-xs text-muted-foreground flex justify-between">
        <span>Status: {isPaused ? "PAUSED" : "LIVE"}</span>
        <span>Polling Rate: 2s</span>
      </div>
    </div>
  );
}
