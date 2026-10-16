"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export type MapSite = { id: number; address: string; suburb: string; stage: number; stageName: string; color: string; lat: number; lng: number; sample: boolean };
export type MapDemand = { suburb: string; lat: number; lng: number; count: number };
export type MapListing = { id: string; address: string; lat: number; lng: number };

export default function MapView({ sites, demand, listings, center }: { sites: MapSite[]; demand: MapDemand[]; listings: MapListing[]; center: [number, number] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<{ kind: string; m: maplibregl.Marker }[]>([]);
  const [layers, setLayers] = useState({ sites: true, demand: true, listings: true });

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      center: [center[1], center[0]],
      zoom: 11.2,
      attributionControl: { compact: true, customAttribution: "© OpenStreetMap contributors © CARTO" },
      style: {
        version: 8,
        sources: { base: { type: "raster", tileSize: 256, tiles: ["a", "b", "c", "d"].map((s) => `https://${s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png`) } },
        layers: [{ id: "base", type: "raster", source: "base" }],
      },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.current = m;

    const max = Math.max(1, ...demand.map((d) => d.count));
    for (const d of demand) {
      const size = 28 + Math.round((d.count / max) * 44);
      const e = document.createElement("div");
      e.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:rgba(228,30,38,${0.12 + (d.count / max) * 0.3});display:flex;align-items:center;justify-content:center;font:500 11px Poppins,sans-serif;color:#b3141b;pointer-events:none;text-align:center`;
      e.textContent = d.count ? String(d.count) : "";
      e.title = `${d.suburb}: ${d.count} enquiries`;
      markers.current.push({ kind: "demand", m: new maplibregl.Marker({ element: e }).setLngLat([d.lng, d.lat]).addTo(m) });
    }
    for (const l of listings) {
      const e = document.createElement("div");
      e.style.cssText = "width:10px;height:10px;border-radius:2px;background:#2b2b33;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)";
      e.title = `Listing: ${l.address}`;
      markers.current.push({ kind: "listings", m: new maplibregl.Marker({ element: e }).setLngLat([l.lng, l.lat]).addTo(m) });
    }
    for (const s of sites) {
      const a = document.createElement("a");
      a.href = `/pipeline?tab=board&site=${s.id}`;
      a.title = `${s.address} (${s.stageName})${s.sample ? " · data under testing" : ""}`;
      a.style.cssText = `width:14px;height:14px;border-radius:50%;background:${s.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(20,20,40,.4);display:block;${s.sample ? "opacity:.7;outline:1px dashed #6c5ce7;" : ""}`;
      markers.current.push({ kind: "sites", m: new maplibregl.Marker({ element: a }).setLngLat([s.lng, s.lat]).addTo(m) });
    }
    const list = markers.current;
    return () => {
      list.length = 0;
      m.remove();
    };
  }, [sites, demand, listings, center]);

  useEffect(() => {
    for (const { kind, m } of markers.current) m.getElement().style.display = layers[kind as keyof typeof layers] ? "" : "none";
  }, [layers]);

  const toggle = (k: keyof typeof layers, label: string) => (
    <button key={k} className={layers[k] ? "on" : ""} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}>{label}</button>
  );

  return (
    <div style={{ position: "relative" }}>
      <div ref={el} style={{ height: 480, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }} />
      <div className="seg" style={{ position: "absolute", top: 10, left: 10, boxShadow: "0 1px 4px rgba(20,20,40,.2)", background: "#fff" }}>
        {toggle("sites", "Sites")}
        {toggle("demand", "Buyer demand")}
        {toggle("listings", "Listings")}
      </div>
    </div>
  );
}
