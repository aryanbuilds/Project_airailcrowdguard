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
    <div className="flex h-[calc(100vh-64px)] flex-col bg-slate-950 text-slate-200 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-800 p-2">
            <Terminal className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">System Console</h1>
            <p className="text-xs text-slate-400">Real-time processing logs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
              isPaused ? "bg-amber-500 text-slate-900 hover:bg-amber-400" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
            {isPaused ? "Resume" : "Pause"}
          </button>
          <button 
            onClick={() => setLogs([])}
            className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Log Window */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-auto p-4 scroll-smooth"
      >
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-600">
            <p className="italic">Waiting for logs...</p>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, i) => (
              <div key={i} className="text-sm border-l-2 border-transparent hover:border-slate-700 pl-2 py-0.5 whitespace-pre-wrap break-all">
                <span className="text-slate-500 select-none mr-3 text-xs">{(i + 1).toString().padStart(4, '0')}</span>
                <span className={
                  log.includes("ERROR") ? "text-red-400" :
                  log.includes("WARNING") ? "text-amber-400" :
                  log.includes("SUCCESS") ? "text-emerald-400" :
                  log.includes("Processing") ? "text-blue-400" :
                  "text-slate-300"
                }>
                  {log}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Status */}
      <div className="border-t border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-500 flex justify-between">
        <span>Status: {isPaused ? "PAUSED" : "LIVE"}</span>
        <span>Polling Rate: 2s</span>
      </div>
    </div>
  );
}
