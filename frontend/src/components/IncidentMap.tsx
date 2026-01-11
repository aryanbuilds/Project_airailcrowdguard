"use client";

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline } from "react-leaflet";
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
        <SimulationLayer />
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

// --- Simulation Data ---
const SCENARIOS = [
  {
    id: 'train-1',
    name: 'Rajdhani (12056)',
    path: [
      [28.6429, 77.2191], // NDLS
      [28.6300, 77.2250],
      [28.6150, 77.2350],
      [28.6000, 77.2450],
      [28.5885, 77.2530], // NZM
    ],
    hasTampering: true,
    tamperingLoc: [28.6150, 77.2350] as [number, number],
    tamperIndex: 0.5, // Approx progress
  },
  {
    id: 'train-2',
    name: 'Shatabdi (12004)',
    path: [
      [28.6608, 77.2285], // Old Delhi
      [28.6500, 77.2000],
      [28.6200, 77.1500],
      [28.5961, 77.1356], // Delhi Cantt
    ],
    hasTampering: false,
  }
];

// Helper to calculate bearing between two points
const getBearing = (start: number[], end: number[]) => {
  const startLat = start[0] * Math.PI / 180;
  const startLng = start[1] * Math.PI / 180;
  const endLat = end[0] * Math.PI / 180;
  const endLng = end[1] * Math.PI / 180;

  const y = Math.sin(endLng - startLng) * Math.cos(endLat);
  const x = Math.cos(startLat) * Math.sin(endLat) -
            Math.sin(startLat) * Math.cos(endLat) * Math.cos(endLng - startLng);
  
  const θ = Math.atan2(y, x);
  const brng = (θ * 180 / Math.PI + 360) % 360; // in degrees
  return brng;
};

function SimulationLayer() {
  // State for all trains
  const [trains, setTrains] = useState(SCENARIOS.map(s => ({
    ...s,
    position: s.path[0] as [number, number],
    bearing: 0,
    progress: 0,
    status: 'IDLE' as 'IDLE' | 'MOVING' | 'STOPPED' | 'CRASHED',
  })));
  
  const [activeAlert, setActiveAlert] = useState<string | null>(null); // ID of detected tampering
  const [isRunning, setIsRunning] = useState(false);
  const requestRef = useRef<number>();

  const updateSim = () => {
    setTrains(prevTrains => {
      let allStopped = true;

      const nextTrains = prevTrains.map(train => {
        if (train.status !== 'MOVING') {
          if (train.status === 'CRASHED') allStopped = false; // Still animating crash potentially? No, just keep running loop to show effect?
           // Actually if all are stopped/crashed/idle, we stop the loop
           return train; 
        }

        allStopped = false;
        let newProgress = train.progress + 0.0015; // Speed factor
        
        // CRASH / STOP LOGIC
        if (train.hasTampering && train.tamperIndex) {
          // If approaching tampering spot
           if (newProgress >= train.tamperIndex - 0.02 && newProgress < train.tamperIndex) {
             if (activeAlert === train.id) {
               // SUCCESSFUL STOP
               return { ...train, progress: newProgress, status: 'STOPPED' };
             }
           }
           // Hit the tampering spot without alert
           if (newProgress >= train.tamperIndex) {
             if (!activeAlert) {
                // CRASH!
                return { ...train, progress: train.tamperIndex, status: 'CRASHED' };
             }
           }
        }

        if (newProgress >= 1) {
          return { ...train, progress: 1, status: 'IDLE', position: train.path[train.path.length-1] as [number, number] };
        }

        // Calculate new position & bearing
        const totalSegments = train.path.length - 1;
        const segmentIndex = Math.floor(newProgress * totalSegments);
        const segmentProgress = (newProgress * totalSegments) - segmentIndex;
        
        const start = train.path[segmentIndex];
        const end = train.path[segmentIndex + 1] || train.path[segmentIndex]; // Safety
        
        const newLat = start[0] + (end[0] - start[0]) * segmentProgress;
        const newLng = start[1] + (end[1] - start[1]) * segmentProgress;
        const newBearing = getBearing(start, end);

        return {
          ...train,
          progress: newProgress,
          position: [newLat, newLng] as [number, number],
          bearing: newBearing
        };
      });

      if (allStopped && isRunning) setIsRunning(false);
      return nextTrains;
    });

    if (isRunning) requestRef.current = requestAnimationFrame(updateSim);
  };

  useEffect(() => {
    if (isRunning) {
      requestRef.current = requestAnimationFrame(updateSim);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isRunning, activeAlert]);

  const startSimulation = () => {
    setTrains(SCENARIOS.map(s => ({
      ...s,
      position: s.path[0] as [number, number],
      bearing: 0,
      progress: 0,
      status: 'MOVING',
    })));
    setActiveAlert(null);
    setIsRunning(true);
  };

  const resetSimulation = () => {
    setIsRunning(false);
    setTrains(SCENARIOS.map(s => ({
      ...s,
      position: s.path[0] as [number, number],
      bearing: 0,
      progress: 0,
      status: 'IDLE',
    })));
    setActiveAlert(null);
  };

  const handleTamperClick = (trainId: string) => {
    if (activeAlert !== trainId) {
       const confirm = window.confirm("⚠ ANOMALY DETECTED on active line!\n\nAuthorize EMERGENCY BRAKES for Train " + trainId.split('-')[1] + "?");
       if (confirm) {
         setActiveAlert(trainId);
         alert("✅ STOP SIGNAL SENT. Brakes engaging.");
       }
    }
  };

  // --- ICONS ---
  const getTrainIcon = (bearing: number, status: string) => L.divIcon({
    className: 'train-marker-rotatable',
    html: `<div style="transform: rotate(${bearing}deg);" class="transition-transform duration-300">
            <div class="-translate-x-1/2 -translate-y-1/2 relative">
              ${status === 'CRASHED' ? 
                '<div class="text-4xl">💥</div>' : 
                // Top-down train SVG pointing NORTH (0 deg) by default
                `<svg width="24" height="48" viewBox="0 0 24 48" fill="none" xmlns="http://www.w3.org/2000/svg" class="drop-shadow-xl">
                  <path d="M12 0C15.3137 0 18 2.68629 18 6V42C18 45.3137 15.3137 48 12 48C8.68629 48 6 45.3137 6 42V6C6 2.68629 8.68629 0 12 0Z" fill="${status === 'STOPPED' ? '#ef4444' : '#3b82f6'}" stroke="white" stroke-width="2"/>
                  <path d="M12 2C13.6569 2 15 3.34315 15 5V12H9V5C9 3.34315 10.3431 2 12 2Z" fill="#1e3a8a"/>
                  <rect x="9" y="14" width="6" height="4" rx="1" fill="#93c5fd"/>
                  <rect x="9" y="20" width="6" height="4" rx="1" fill="#93c5fd"/>
                  <rect x="9" y="26" width="6" height="4" rx="1" fill="#93c5fd"/>
                </svg>`
              }
            </div>
           </div>`,
    iconSize: [24, 48],
    iconAnchor: [12, 24], // Center of the 24x48 icon
  });

  const tamperingIcon = L.divIcon({
    className: 'tamper-marker',
    html: `<div class="animate-pulse text-3xl filter drop-shadow-lg transform -translate-x-1/2 -translate-y-1/2">⚠️</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  return (
    <>
      {/* 1. Paths */}
      {isRunning && trains.map(t => (
        <Polyline 
          key={`path-${t.id}`}
          positions={t.path as [number, number][]} 
          pathOptions={{ color: t.status === 'CRASHED' ? 'red' : 'blue', dashArray: '10, 10', weight: 4, opacity: 0.5 }} 
        />
      ))}

      {/* 2. Trains */}
      {trains.map(t => (
        (t.status !== 'IDLE' || isRunning) && (
          <Marker 
            key={t.id} 
            position={t.position} 
            icon={getTrainIcon(t.bearing, t.status)} 
            zIndexOffset={1000}
          >
            <Popup>
              <strong>{t.name}</strong><br/>
              Status: <span className={t.status === 'CRASHED' ? 'text-red-600 font-bold' : ''}>{t.status}</span><br/>
              Heading: {Math.round(t.bearing)}°
            </Popup>
          </Marker>
        )
      ))}

      {/* 3. Tampering Markers */}
      {isRunning && trains.filter(t => t.hasTampering && t.status !== 'CRASHED' && t.status !== 'IDLE').map(t => (
        <Marker 
          key={`tamper-${t.id}`}
          position={t.tamperingLoc!} 
          icon={tamperingIcon}
          eventHandlers={{ click: () => handleTamperClick(t.id) }}
          zIndexOffset={900}
        >
          <Popup>
            <div className="text-center">
              <strong className="text-red-600">CRITICAL ALERT</strong><br/>
              Action Required<br/>
              <button 
                onClick={() => handleTamperClick(t.id)}
                className="mt-2 bg-red-600 text-white px-3 py-1 rounded font-bold text-xs animate-pulse"
              >
                STOP TRAIN
              </button>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Control Panel */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-white/95 backdrop-blur px-6 py-3 rounded-2xl shadow-2xl border border-slate-200 flex flex-col md:flex-row items-center gap-6">
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Central Control</h3>
          <div className="flex gap-2">
            <button 
              onClick={startSimulation}
              disabled={isRunning || trains.some(t => t.status === 'MOVING')}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all active:scale-95"
            >
              INITIATE TRAFFIC
            </button>
            <button 
              onClick={resetSimulation}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-lg border border-slate-200 transition-all active:scale-95"
            >
              RESET SYSTEMS
            </button>
          </div>
        </div>
        
        {/* Status Indicators */}
        <div className="flex gap-4 border-l pl-6 border-slate-200">
           <div className="flex flex-col gap-1">
             <span className="text-[10px] uppercase font-bold text-slate-400">Net Status</span>
             <div className="flex items-center gap-2">
               <span className={`h-2.5 w-2.5 rounded-full ${trains.some(t => t.status === 'CRASHED') ? 'bg-red-500 animate-ping' : isRunning ? 'bg-green-500' : 'bg-slate-300'}`} />
               <span className="text-xs font-bold text-slate-700">
                 {trains.some(t => t.status === 'CRASHED') ? 'ACCIDENT DETECTED' : isRunning ? 'LIVE TRAFFIC OK' : 'OFFLINE'}
               </span>
             </div>
           </div>
           
           {activeAlert && (
             <div className="flex flex-col gap-1 animate-pulse">
               <span className="text-[10px] uppercase font-bold text-red-400">Alerts</span>
                <span className="text-xs font-bold text-red-600">INTERVENTION ACTIVE</span>
             </div>
           )}
        </div>
      </div>
    </>
  );
}

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
