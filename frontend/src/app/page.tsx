import { ArrowRight, ShieldAlert, BadgeInfo, FileUp, Radar, Activity, Siren } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="neon-edge scanline rounded-3xl bg-white/5 p-8 sm:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">
              <Radar className="h-3.5 w-3.5" />
              Network Watch
            </span>
            <span className="chip">
              <Activity className="h-3.5 w-3.5" />
              Real-time AI
            </span>
            <span className="chip">
              <Siren className="h-3.5 w-3.5" />
              High Priority Dispatch
            </span>
          </div>

          <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
            Rail Safety Command
            <span className="block text-muted-foreground text-lg sm:text-xl font-extrabold mt-2">
              AI-powered anomaly detection for track defects & tampering
            </span>
          </h1>

          <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
            Upload field evidence (photo/video). The system runs a two-stage detection pipeline, assigns severity, and streams incidents to the Control Center for response.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/upload"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[color:var(--rail-accent)] to-[color:var(--rail-accent-2)] px-6 py-3 text-sm font-black text-slate-950 hover:brightness-110"
            >
              <FileUp className="h-4 w-4" />
              Create Field Report
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/5 px-6 py-3 text-sm font-extrabold hover:bg-white/10"
            >
              Open Control Center
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border bg-white/5 p-4">
              <div className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">Response</div>
              <div className="mt-2 text-lg font-black">Faster triage</div>
              <div className="mt-1 text-xs text-muted-foreground">Auto severity + evidence frames</div>
            </div>
            <div className="rounded-2xl border bg-white/5 p-4">
              <div className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">Coverage</div>
              <div className="mt-2 text-lg font-black">Mobile-first</div>
              <div className="mt-1 text-xs text-muted-foreground">Camera capture + GPS optional</div>
            </div>
            <div className="rounded-2xl border bg-white/5 p-4">
              <div className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">Audit</div>
              <div className="mt-2 text-lg font-black">Traceable</div>
              <div className="mt-1 text-xs text-muted-foreground">Incident IDs + status workflow</div>
            </div>
          </div>
        </div>

        <div className="neon-edge rounded-3xl bg-white/5 p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">System Panel</div>
              <div className="mt-1 text-xl font-black">Operational Readiness</div>
            </div>
            <span className="chip">Live</span>
          </div>

          <div className="mt-6 grid gap-3">
            <div className="scanline rounded-3xl border bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[color:var(--rail-warning)]" />
                  <div className="text-sm font-black">Signal Integrity</div>
                </div>
                <div className="text-xs font-extrabold text-[color:var(--rail-accent)]">OK</div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Monitors tampering patterns in critical components.</div>
            </div>

            <div className="rounded-3xl border bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BadgeInfo className="h-4 w-4 text-[color:var(--rail-accent-2)]" />
                  <div className="text-sm font-black">Vision Pipeline</div>
                </div>
                <div className="text-xs font-extrabold text-[color:var(--rail-accent)]">READY</div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Two-stage detection, severity grading, evidence extraction.</div>
            </div>

            <div className="rounded-3xl border bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radar className="h-4 w-4 text-[color:var(--rail-accent)]" />
                  <div className="text-sm font-black">Incident Feed</div>
                </div>
                <div className="text-xs font-extrabold text-muted-foreground">10s</div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Dashboard auto-refresh interval.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
