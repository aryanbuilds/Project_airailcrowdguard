"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BadgeCheck,
  Camera,
  CheckCircle2,
  FileUp,
  Loader2,
  MapPin,
  Navigation,
  Upload,
  Video,
} from "lucide-react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) return;
    setFile(selected);
    setError(null);
  };

  const getGeolocation = () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a photo or video first.");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("reporter_name", name);
    formData.append("reporter_phone", phone);
    formData.append("reporter_id", "dummy-admin-user");
    if (location) {
      formData.append("lat", location.lat.toString());
      formData.append("lng", location.lng.toString());
    }

    try {
      const response = await fetch(`${apiUrl}/api/v1/media/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed. Please try again.");
      }

      const data = (await response.json()) as { media_id?: string };
      if (!data.media_id) throw new Error("Upload succeeded but no media_id returned.");

      setSuccess(data.media_id);
      setFile(null);
      setLocation(null);
      setName("");
      setPhone("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="chip">
              <FileUp className="h-3.5 w-3.5" />
              Field Report
            </span>
            <span className="chip">
              <BadgeCheck className="h-3.5 w-3.5" />
              Assisted Upload
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Incident Intake</h1>
          <p className="mt-1 text-sm text-muted-foreground">Capture evidence + optional GPS + reporter metadata.</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="rounded-2xl border bg-white/5 px-4 py-2 text-sm font-extrabold hover:bg-white/10"
          >
            Back to Control
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <div className="neon-edge rounded-3xl bg-white/5 p-4">
          <div className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">Step 1</div>
          <div className="mt-2 text-base font-black">Media Evidence</div>
          <div className="mt-1 text-xs text-muted-foreground">Photo or short video.</div>
        </div>
        <div className="neon-edge rounded-3xl bg-white/5 p-4">
          <div className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">Step 2</div>
          <div className="mt-2 text-base font-black">Location (Optional)</div>
          <div className="mt-1 text-xs text-muted-foreground">GPS capture if available.</div>
        </div>
        <div className="neon-edge rounded-3xl bg-white/5 p-4">
          <div className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">Step 3</div>
          <div className="mt-2 text-base font-black">Submit</div>
          <div className="mt-1 text-xs text-muted-foreground">Dispatch for AI analysis.</div>
        </div>
      </div>

      {success ? (
        <div className="neon-edge rounded-3xl bg-white/5 p-10 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-[color:var(--rail-accent)]/10">
            <CheckCircle2 className="h-8 w-8 text-[color:var(--rail-accent)]" />
          </div>
          <h2 className="mt-4 text-2xl font-black">Report Accepted</h2>
          <p className="mt-2 text-sm text-muted-foreground">AI analysis has started. Track this case using the Media ID.</p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-2xl border bg-white/5 px-4 py-2 font-mono text-sm">
            <span className="text-muted-foreground">MEDIA</span>
            <span className="font-black text-foreground">{success}</span>
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className="rounded-2xl bg-gradient-to-r from-[color:var(--rail-accent)] to-[color:var(--rail-accent-2)] px-6 py-3 text-sm font-black text-slate-950 hover:brightness-110"
            >
              New Report
            </button>
            <Link
              href="/dashboard"
              className="rounded-2xl border bg-white/5 px-6 py-3 text-sm font-extrabold hover:bg-white/10"
            >
              Open Control Center
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <div className="neon-edge rounded-3xl bg-white/5 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">Reporter</div>
                  <div className="mt-1 text-lg font-black">Identity (Optional)</div>
                </div>
                <span className="chip">Bypass Mode</span>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-xs font-extrabold tracking-widest text-muted-foreground uppercase"
                  >
                    Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="mt-2 w-full rounded-2xl border bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/80 focus:border-white/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-xs font-extrabold tracking-widest text-muted-foreground uppercase"
                  >
                    Phone
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="mt-2 w-full rounded-2xl border bg-white/5 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/80 focus:border-white/20"
                  />
                </div>
              </div>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`scanline neon-edge relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 transition-all ${
                file
                  ? "border-[color:var(--rail-accent)] bg-[color:var(--rail-accent)]/5"
                  : "border-white/15 bg-white/5 hover:bg-white/10"
              }`}
            >
              {file ? (
                <div className="flex flex-col items-center p-4">
                  {file.type.startsWith("image/") ? (
                    <Camera className="h-12 w-12 text-[color:var(--rail-accent)]" />
                  ) : (
                    <Video className="h-12 w-12 text-[color:var(--rail-accent)]" />
                  )}
                  <p className="mt-2 max-w-md truncate text-center text-sm font-black">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  <span className="mt-4 text-xs font-extrabold tracking-widest text-[color:var(--rail-accent)] uppercase">
                    Tap to replace
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center p-4">
                  <div className="mb-4 flex gap-2">
                    <div className="rounded-2xl border bg-white/5 p-3">
                      <Camera className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="rounded-2xl border bg-white/5 p-3">
                      <Video className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                  <p className="text-center text-lg font-black">Capture Evidence</p>
                  <p className="mt-1 text-center text-sm text-muted-foreground">
                    Tap to open camera (5–10s recommended for video)
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border bg-white/5 px-4 py-2 text-xs font-extrabold tracking-widest uppercase">
                    <Upload className="h-4 w-4" />
                    Secure Intake
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept="image/*,video/*"
                capture="environment"
                className="hidden"
              />
            </div>

            <div className="neon-edge rounded-3xl bg-white/5 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid size-10 place-items-center rounded-2xl border bg-white/5">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">Location</div>
                    <div className="text-base font-black">GPS Capture (Optional)</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={getGeolocation}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border bg-white/5 px-4 py-2 text-sm font-extrabold hover:bg-white/10 disabled:opacity-50"
                >
                  <Navigation className="h-4 w-4" />
                  {loading ? "Capturing…" : location ? "Re-capture" : "Get GPS"}
                </button>
              </div>

              <div className="mt-4 rounded-2xl border bg-white/5 p-4">
                {location ? (
                  <div className="text-sm">
                    <div className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">Coordinates</div>
                    <div className="mt-2 font-mono text-sm">
                      {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No GPS attached. You can still submit without it.</div>
                )}
              </div>
            </div>

            {error && (
              <div className="neon-edge rounded-3xl bg-[color:var(--rail-danger)]/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 text-[color:var(--rail-danger)]" />
                  <div>
                    <div className="text-sm font-black">Submission blocked</div>
                    <div className="text-sm text-muted-foreground">{error}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={uploading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[color:var(--rail-accent)] to-[color:var(--rail-accent-2)] px-6 py-3 text-sm font-black text-slate-950 hover:brightness-110 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Uploading…" : "Submit Report"}
              </button>
              <Link
                href="/console"
                target="_blank"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border bg-white/5 px-6 py-3 text-sm font-extrabold hover:bg-white/10"
              >
                <AlertCircle className="h-4 w-4" />
                Monitor Logs
              </Link>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="neon-edge rounded-3xl bg-white/5 p-5">
              <div className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">Quick Notes</div>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="mt-1 size-2 rounded-full bg-[color:var(--rail-warning)]" />
                  Keep the track area centered, avoid motion blur.
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 size-2 rounded-full bg-[color:var(--rail-accent)]" />
                  Record 5–10 seconds if tampering suspected.
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 size-2 rounded-full bg-[color:var(--rail-accent-2)]" />
                  GPS improves dispatch accuracy but is optional.
                </div>
              </div>
            </div>

            <div className="neon-edge rounded-3xl bg-white/5 p-5">
              <div className="text-xs font-extrabold tracking-widest text-muted-foreground uppercase">Endpoint</div>
              <div className="mt-2 break-all font-mono text-xs text-muted-foreground">{apiUrl}/api/v1/media/upload</div>
              <div className="mt-3 text-xs text-muted-foreground">Uploads are queued for background processing.</div>
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}
