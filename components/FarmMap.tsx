"use client";

import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapTree = {
  id: string;
  zone: string;
  variety: string;
  latitude: number;
  longitude: number;
  latestGrade: string | null;
  hasAlert?: boolean;
};

const GRADE_COLOR: Record<string, string> = {
  A: "#10b981",
  B: "#f59e0b",
  C: "#ef4444",
};

function makeIcon(color: string, hasAlert: boolean) {
  const html = `
    <div style="position:relative;width:24px;height:24px;">
      <div style="
        width:24px;height:24px;border-radius:50%;
        background:${color};
        border:3px solid white;
        box-shadow:0 1px 4px rgba(0,0,0,0.4);
      "></div>
      ${
        hasAlert
          ? `<div style="
              position:absolute;top:-2px;right:-2px;
              width:12px;height:12px;border-radius:50%;
              background:#dc2626;border:2px solid white;
            "></div>`
          : ""
      }
    </div>
  `;
  return L.divIcon({
    html,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    className: "",
  });
}

function FitToBounds({ trees }: { trees: MapTree[] }) {
  const map = useMap();
  useEffect(() => {
    if (trees.length === 0) return;
    const bounds = L.latLngBounds(trees.map((t) => [t.latitude, t.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 19 });
  }, [trees, map]);
  return null;
}

export default function FarmMap({ trees }: { trees: MapTree[] }) {
  if (trees.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 text-sm text-slate-500">
        ยังไม่มีต้นไม้ที่บันทึกพิกัด
      </div>
    );
  }

  const center: [number, number] = [trees[0].latitude, trees[0].longitude];

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-slate-200">
      <MapContainer center={center} zoom={18} className="h-96 w-full">
        <TileLayer
          attribution="Imagery © Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        <FitToBounds trees={trees} />
        {trees.map((t) => {
          const color = t.latestGrade ? GRADE_COLOR[t.latestGrade] ?? "#94a3b8" : "#94a3b8";
          return (
            <Marker
              key={t.id}
              position={[t.latitude, t.longitude]}
              icon={makeIcon(color, t.hasAlert ?? false)}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-bold text-base">{t.id}</div>
                  <div>โซน {t.zone} · {t.variety}</div>
                  <div className="mt-1">
                    เกรดล่าสุด:{" "}
                    <span style={{ color }}>{t.latestGrade ?? "ยังไม่ตรวจ"}</span>
                  </div>
                  <a
                    href={`/inspect/${t.id}`}
                    className="mt-2 inline-block rounded bg-emerald-600 px-3 py-1 text-white"
                  >
                    บันทึกการตรวจ →
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
