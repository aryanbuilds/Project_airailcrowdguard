"use client";

import { MapPin, Clock, Fingerprint } from "lucide-react";
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
}

export default function IncidentCard({ 
  incident, 
  onClick 
}: { 
  incident: Incident, 
  onClick: (id: string) => void 
}) {
  const date = new Date(incident.timestamp).toLocaleString();
  const faultTypeLabel = (incident.fault_type ?? "Unknown").replace(/_/g, " ");
  const lat = Number(incident.lat);
  const lng = Number(incident.lng);
  const tamperingScore = Number(incident.tampering_score);

  return (
    <div 
      onClick={() => onClick(incident.id)}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:border-blue-300 hover:shadow-lg hover:shadow-blue-50"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{incident.id}</span>
          <h3 className="mt-1 font-bold text-slate-900 capitalize">{faultTypeLabel}</h3>
        </div>
        <SeverityBadge severity={incident.severity} />
      </div>

      <div className="space-y-2 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          <span>{date}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-400" />
          <span>
            {Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-slate-400" />
          <span>
            Trust Score:{" "}
            <span className="font-bold text-slate-900">
              {Number.isFinite(tamperingScore) ? `${(tamperingScore * 100).toFixed(0)}%` : "—"}
            </span>
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className={`text-xs font-bold uppercase ${incident.status === 'unverified' ? 'text-amber-600' : 'text-emerald-600'}`}>
          {incident.status}
        </span>
        <span className="text-xs font-medium text-blue-600 group-hover:underline">View Details →</span>
      </div>
    </div>
  );
}
