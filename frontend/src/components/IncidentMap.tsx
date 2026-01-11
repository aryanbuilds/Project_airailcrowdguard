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
        <TileLayer
          attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Map style: &copy; <a href="https://www.OpenRailwayMap.org">OpenRailwayMap</a>'
          url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png"
          maxZoom={19}
          opacity={0.7}
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
        
        <StationMarkers />
      </MapContainer>

      {/* Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-[400] rounded-2xl bg-white/90 p-3 text-[10px] font-bold shadow-2xl backdrop-blur-md border ring-1 ring-slate-900/5">
        <p className="mb-2 uppercase tracking-widest text-slate-400 text-[9px]">Map Legend</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" /> HIGH SEVERITY</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-500 ring-2 ring-white" /> MEDIUM SEVERITY</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" /> LOW SEVERITY</div>
          <div className="flex items-center gap-2"><span className="flex items-center justify-center size-4 bg-blue-600 rounded-full text-white"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="12" x="4" y="3" rx="2"/><path d="M6 15v6"/><path d="M18 15v6"/><path d="M6 21h12"/><path d="m14 10-2-2-2 2"/></svg></span> RAILWAY STATION</div>
        </div>
      </div>
    </div>
  );
}

const DELHI_STATIONS = [
  { name: "New Delhi (NDLS)", lat: 28.6429, lng: 77.2191 },
  { name: "Old Delhi (DLI)", lat: 28.6608, lng: 77.2285 },
  { name: "Hazrat Nizamuddin (NZM)", lat: 28.5885, lng: 77.2530 },
  { name: "Anand Vihar Terminal (ANVT)", lat: 28.6502, lng: 77.3152 },
  { name: "Delhi Sarai Rohilla (DEE)", lat: 28.6664, lng: 77.1750 },
  { name: "Delhi Cantt (DEC)", lat: 28.5961, lng: 77.1356 },
];

function StationMarkers() {
  const icon = L.divIcon({
    className: "station-marker",
    html: `<div class="bg-blue-600 text-white p-1.5 rounded-lg shadow-xl border-2 border-white transform hover:scale-110 transition-transform">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-train-front"><path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="m9 15-1-1"/><path d="m15 15 1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/></svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });

  return (
    <>
      {DELHI_STATIONS.map((station) => (
        <Marker key={station.name} position={[station.lat, station.lng]} icon={icon}>
          <Popup>
            <div className="text-center">
              <div className="font-bold text-slate-900 text-sm">{station.name}</div>
              <div className="text-xs text-slate-500">Major Hub</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
