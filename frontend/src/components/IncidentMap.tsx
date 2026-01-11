"use client";

import React from 'react';
import { 
  Map, 
  MapMarker, 
  MarkerContent, 
  MarkerPopup, 
  MapControls 
} from "@/components/ui/map";

interface Incident {
  id: string;
  lat: number;
  lng: number;
  severity: string;
  fault_type: string;
}

interface IncidentMapProps {
  incidents: Incident[];
  onMarkerClick: (id: string) => void;
}

export default function IncidentMap({ incidents, onMarkerClick }: IncidentMapProps) {
  // Map settings
  const initialViewState = {
    longitude: 78.9629,
    latitude: 20.5937,
    zoom: 4,
  };

  return (
    <div className="h-full w-full relative group">
      <Map
        {...initialViewState}
        attributionControl={false}
      >
        <MapControls 
          showZoom 
          showLocate 
          showCompass 
          showFullscreen
          position="top-right"
        />

        {incidents.map((incident) => {
          const color = 
            incident.severity === 'HIGH' ? 'bg-red-500' : 
            incident.severity === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500';

          return (
            <MapMarker
              key={incident.id}
              longitude={incident.lng}
              latitude={incident.lat}
              onClick={() => onMarkerClick(incident.id)}
            >
              <MarkerContent>
                <div className={`size-5 rounded-full border-2 border-white shadow-lg cursor-pointer transform transition-transform group-hover:scale-110 ${color}`} />
              </MarkerContent>
              <MarkerPopup className="w-48 p-0 border-none shadow-none">
                <div className="p-3 bg-white rounded-xl border-2 shadow-xl ring-1 ring-slate-900/5">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{incident.id}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                        incident.severity === 'HIGH' ? 'bg-red-100 text-red-700' : 
                        incident.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {incident.severity}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 capitalize text-sm mt-1">{incident.fault_type.replace(/_/g, ' ')}</p>
                    <button 
                      onClick={() => onMarkerClick(incident.id)}
                      className="mt-2 w-full py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      View Full Incident Detail
                    </button>
                  </div>
                </div>
              </MarkerPopup>
            </MapMarker>
          );
        })}
      </Map>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 rounded-2xl bg-white/90 p-3 text-[10px] font-bold shadow-2xl backdrop-blur-md border ring-1 ring-slate-900/5">
        <p className="mb-2 uppercase tracking-widest text-slate-400 text-[9px]">MapCN Visualization Active</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" /> HIGH SEVERITY</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500 ring-2 ring-white" /> MEDIUM SEVERITY</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" /> LOW SEVERITY</div>
        </div>
      </div>
    </div>
  );
}
