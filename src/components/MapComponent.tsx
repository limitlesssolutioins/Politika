"use client";

import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";

interface MapComponentProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[]; // Data from our API (departments)
  onDepartmentClick: (deptName: string) => void;
}

export default function MapComponent({ data, onDepartmentClick }: MapComponentProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [geoData, setGeoData] = useState<any>(null);

  useEffect(() => {
    // Fetch a public GeoJSON of Colombia departments
    fetch("https://gist.githubusercontent.com/john-guerra/43c7656821069d00dcbc/raw/be6a6e239cd5b5b803c6e7c2ec405b793a9064dd/Colombia.geo.json")
      .then(res => res.json())
      .then(json => setGeoData(json))
      .catch(console.error);
  }, []);

  const getDeptColor = (featureName: string) => {
    // Basic normalization for matching
    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const name = normalize(featureName);
    
    // Find matching department in our data
    const dept = data.find(d => normalize(d.nombre).includes(name) || name.includes(normalize(d.nombre)));
    
    if (!dept) return "#e2e8f0"; // slate-200
    if (dept.totalPuestos === 0) return "#f1f5f9"; // slate-100
    if (dept.totalPuestos > 500) return "#1e40af"; // blue-800
    if (dept.totalPuestos > 200) return "#3b82f6"; // blue-500
    if (dept.totalPuestos > 50) return "#60a5fa"; // blue-400
    return "#bfdbfe"; // blue-200
  };

  if (!geoData) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-slate-200 relative z-0">
      <MapContainer 
        center={[4.5709, -74.2973]} 
        zoom={5} 
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <GeoJSON
          data={geoData}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          style={(feature: any) => ({
            fillColor: getDeptColor(feature.properties.NOMBRE_DPT),
            weight: 1,
            opacity: 1,
            color: "white",
            dashArray: "3",
            fillOpacity: 0.7
          })}
          onEachFeature={(feature, layer) => {
            const deptName = feature.properties.NOMBRE_DPT;
            
            layer.bindTooltip(`<strong>${deptName}</strong>`, {
              sticky: true,
              direction: "auto"
            });
            
            layer.on({
              mouseover: (e) => {
                const layer = e.target;
                layer.setStyle({
                  weight: 3,
                  color: "#666",
                  dashArray: "",
                  fillOpacity: 0.9
                });
                layer.bringToFront();
              },
              mouseout: (e) => {
                const layer = e.target;
                layer.setStyle({
                  fillColor: getDeptColor(feature.properties.NOMBRE_DPT),
                  weight: 1,
                  opacity: 1,
                  color: "white",
                  dashArray: "3",
                  fillOpacity: 0.7
                });
              },
              click: () => {
                onDepartmentClick(deptName);
              }
            });
          }}
        />
      </MapContainer>
    </div>
  );
}
