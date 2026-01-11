"use client";

import { useState, useEffect } from "react";
import { X, MapPin, Clock, Fingerprint, ShieldAlert, FileText, CheckCircle, ExternalLink } from "lucide-react";
import SeverityBadge from "./SeverityBadge";

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
  evidence_frames?: string[];
  reporter_name?: string;
  reporter_phone?: string;
}

export default function IncidentDetailModal({ 
  incidentId, 
  onClose,
  onVerify,
  onDismiss
}: { 
  incidentId: string; 
  onClose: () => void;
  onVerify: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/incidents/${incidentId}`);
        if (!response.ok) throw new Error("Failed to fetch incident details");
        const data = await response.json();
        setIncident(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [incidentId]);

  if (loading) return null;
  if (!incident) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col md:flex-row">
        {/* Media Preview Section */}
        <div className="w-full md:w-1/2 bg-slate-900 flex items-center justify-center relative min-h-[300px]">
          {incident.evidence_frames && incident.evidence_frames.length > 0 ? (
            <img 
              src={`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/frames/${incident.media_id}/${incident.evidence_frames[0]}`}
              alt="Evidence"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-slate-500 flex flex-col items-center italic">
              <ShieldAlert className="h-12 w-12 mb-2" />
              <span>Media not available</span>
            </div>
          )}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full bg-black/20 p-2 text-white hover:bg-black/40 md:hidden"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 p-6 flex flex-col overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{incident.id}</span>
              <h2 className="text-2xl font-bold text-slate-900 capitalize">{incident.fault_type.replace(/_/g, ' ')}</h2>
            </div>
            <button 
              onClick={onClose}
              className="hidden md:block rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Severity</p>
              <SeverityBadge severity={incident.severity} />
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Confidence</p>
              <span className="text-lg font-bold text-slate-900">{(incident.tampering_score * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-900 italic">Reported At</p>
                <p className="text-sm text-slate-600">{new Date(incident.timestamp).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-slate-900 italic">Location</p>
                <p className="text-sm text-slate-600">{incident.lat.toFixed(6)}, {incident.lng.toFixed(6)}</p>
                <a href={`https://www.google.com/maps?q=${incident.lat},${incident.lng}`} target="_blank" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                  View on Google Maps <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            
            {(incident.reporter_name || incident.reporter_phone) && (
              <div className="flex items-start gap-3 pt-2 border-t border-slate-100">
                <Fingerprint className="h-5 w-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-900 italic">Reported By</p>
                  <p className="text-sm text-slate-600">
                    {incident.reporter_name || "Anonymous"} 
                    {incident.reporter_phone && <span className="text-slate-400"> ({incident.reporter_phone})</span>}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto space-y-3 pt-6 border-t">
            <div className="flex gap-3">
              <button 
                onClick={() => onVerify(incident.id)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 transition-colors"
              >
                <CheckCircle className="h-4 w-4" />
                Mark as Verified
              </button>
              <button 
                onClick={() => onDismiss(incident.id)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="h-4 w-4" />
                Dismiss
              </button>
            </div>
            <button className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 py-3 text-sm font-bold text-slate-900 hover:bg-slate-50 transition-colors capitalize italic">
              <FileText className="h-4 w-4" />
              Generate Safety Audit report (PDF)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
