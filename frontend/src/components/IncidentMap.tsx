"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { ExternalLink } from "lucide-react";

// Fix for default marker icons in Next.js
const deleteIcon = (L.Icon.Default.prototype as any)._getIconUrl;
if (deleteIcon) {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
}

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

// Component to handle map center updates
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Custom hook to fix map sizing
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(map.getContainer());
    return () => resizeObserver.disconnect();
  }, [map]);
  return null;
}

export default function IncidentMap({ incidents, onMarkerClick }: IncidentMapProps) {
  // Delhi coordinates as default center
  const defaultCenter: [number, number] = [28.6139, 77.2090];
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-full w-full bg-slate-100 flex items-center justify-center">Loading Map...</div>;

  const createCustomIcon = (severity: string) => {
    let colorClass = "";
    switch (severity) {
      case "HIGH": colorClass = "bg-red-500"; break;
      case "MEDIUM": colorClass = "bg-amber-500"; break;
      case "LOW": colorClass = "bg-emerald-500"; break;
      default: colorClass = "bg-blue-500";
    }

    // Using L.divIcon to render a Tailwind styled marker
    return L.divIcon({
      className: "custom-marker",
      html: `<div class="${colorClass} w-5 h-5 rounded-full border-2 border-white shadow-lg transform transition-transform hover:scale-110"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10], // Center the icon
      popupAnchor: [0, -10]
    });
  };

  return (
    <div className="h-full w-full relative z-0">
       {/* Force z-index 0 to prevent markers from overlapping modals */}
      <MapContainer 
        center={defaultCenter} 
        zoom={11} 
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapResizer />
        
        {incidents.map((incident) => (
          <Marker 
            key={incident.id} 
            position={[incident.lat, incident.lng]}
            icon={createCustomIcon(incident.severity)}
            eventHandlers={{
              click: () => onMarkerClick(incident.id),
            }}
          >
            <Popup>
              <div className="p-1 min-w-[160px]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{incident.id}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                    incident.severity === 'HIGH' ? 'bg-red-100 text-red-700' : 
                    incident.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {incident.severity}
                  </span>
                </div>
                <p className="font-bold text-slate-900 capitalize text-sm mb-2">{incident.fault_type.replace(/_/g, ' ')}</p>
                
                <button 
                  onClick={() => onMarkerClick(incident.id)}
                  className="w-full py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  View Full Detail
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-[400] rounded-2xl bg-white/90 p-3 text-[10px] font-bold shadow-2xl backdrop-blur-md border ring-1 ring-slate-900/5">
        <p className="mb-2 uppercase tracking-widest text-slate-400 text-[9px]">Live Incidents</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" /> HIGH SEVERITY</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500 ring-2 ring-white" /> MEDIUM SEVERITY</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" /> LOW SEVERITY</div>
        </div>
      </div>
    </div>
  );
}
