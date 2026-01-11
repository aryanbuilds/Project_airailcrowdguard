"use client";

import { useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { Camera, Video, MapPin, Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export default function UploadPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [file, setFile] = useState<File | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type.startsWith("video/")) {
        console.log("Video selected");
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const getGeolocation = () => {
    setLoading(true);
    setError(null);
    
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

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
        // Soft error, don't block
        setLoading(false);
      },
      options
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
    
    if (location) {
      formData.append("lat", location.lat.toString());
      formData.append("lng", location.lng.toString());
    }
    if (user) {
      formData.append("reporter_id", user.id);
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/media/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed. please try again.");
      }

      const data = await response.json();
      setSuccess(data.media_id);
      setFile(null);
      setLocation(null);
      setName("");
      setPhone("");
    } catch (err: any) {
      setError(err.message || "An error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  if (!isLoaded) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;

  return (
    <div className="container mx-auto max-w-lg px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-slate-900">Report an Issue</h1>
        <p className="mt-2 text-slate-600">Submit evidence of track defects or tampering.</p>
      </div>

      {success ? (
        <div className="rounded-2xl border-2 border-green-100 bg-green-50 p-8 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
          <h2 className="mt-4 text-2xl font-bold text-slate-900">Upload Successful!</h2>
          <p className="mt-2 text-slate-600">
            Thank you for your report. Our AI is now analyzing the evidence.
          </p>
          <p className="mt-4 text-sm font-mono text-slate-400">ID: {success}</p>
          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={() => setSuccess(null)}
              className="rounded-full bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Submit Another Report
            </button>
            <Link
              href="/dashboard"
              className="rounded-full bg-white px-6 py-3 font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              View Dashboard
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">Reporter Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700">Phone Number</label>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-3 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Media Capture Area */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all ${
              file ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50"
            }`}
          >
            {file ? (
              <div className="flex flex-col items-center p-4">
                {file.type.startsWith("image/") ? (
                  <Camera className="h-12 w-12 text-blue-500" />
                ) : (
                  <Video className="h-12 w-12 text-blue-500" />
                )}
                <p className="mt-2 text-center text-sm font-medium text-slate-900 truncate max-w-xs">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <span className="mt-4 text-xs font-bold text-blue-600 uppercase">Click to change</span>
              </div>
            ) : (
              <div className="flex flex-col items-center p-4">
                <div className="mb-4 flex gap-2">
                  <div className="rounded-full bg-slate-100 p-3"><Camera className="h-6 w-6 text-slate-600" /></div>
                  <div className="rounded-full bg-slate-100 p-3"><Video className="h-6 w-6 text-slate-600" /></div>
                </div>
                <p className="text-lg font-semibold text-slate-900 text-center">Capture Photo or Video</p>
                <p className="mt-1 text-sm text-slate-500 text-center">Tap to open camera (approx. 5-10s for video)</p>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
            />
          </div>

          {/* Location Area (Optional) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-slate-400" />
                <span className="font-semibold text-slate-900">Incident Location <span className="text-xs font-normal text-slate-500">(Optional)</span></span>
              </div>
              <button
                type="button"
                onClick={getGeolocation}
                disabled={loading}
                className="text-sm font-bold text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                {loading ? "Capturing..." : location ? "Re-capture" : "Get Location"}
              </button>
            </div>
            
            {location ? (
              <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                Location captured: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">Location is optional but helps in faster response.</p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!file || uploading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-lg font-bold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-blue-200 disabled:bg-slate-300 disabled:shadow-none"
          >
            {uploading ? (
              <><Loader2 className="h-6 w-6 animate-spin" /> Submitting...</>
            ) : (
              <><Upload className="h-6 w-6" /> Submit Report</>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
