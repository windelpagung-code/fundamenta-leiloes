'use client';

import { useEffect, useRef } from 'react';
import { Property } from '@/types/property';
import { formatCurrency } from '@/lib/utils';

interface MapViewProps {
  properties: Property[];
  onPropertyClick?: (id: string) => void;
}

// Cluster properties that share the same coordinates (city-level geocoding)
function groupByCoords(properties: Property[]) {
  const map = new Map<string, { lat: number; lng: number; items: Property[] }>();
  for (const p of properties) {
    if (!p.latitude || !p.longitude) continue;
    const key = `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`;
    if (!map.has(key)) map.set(key, { lat: p.latitude, lng: p.longitude, items: [] });
    map.get(key)!.items.push(p);
  }
  return Array.from(map.values());
}

// Cluster marker HTML — size and color scale with property count
function clusterHtml(count: number, minBid: number): string {
  const isSmall  = count === 1;
  const isMed    = count < 10;
  const isLarge  = count < 100;

  const size  = isSmall ? 36 : isMed ? 42 : isLarge ? 50 : 58;
  const bg    = isSmall ? '#1E6BB8' : isMed ? '#0A2E50' : isLarge ? '#0A2E50' : '#0A2E50';
  const label = isSmall
    ? `${(minBid / 1000).toFixed(0)}k`
    : count > 999
    ? `${(count / 1000).toFixed(1)}k`
    : String(count);

  return `<div style="
    width:${size}px; height:${size}px;
    background:${bg};
    border-radius:50%;
    border: 3px solid rgba(255,255,255,0.85);
    display:flex; align-items:center; justify-content:center;
    box-shadow: 0 3px 10px rgba(0,0,0,0.35);
    cursor:pointer;
    font-family: sans-serif;
  ">
    <span style="color:white; font-size:${isSmall ? 10 : isMed ? 11 : 12}px; font-weight:800; line-height:1; text-align:center;">${label}</span>
  </div>`;
}

// Popup HTML for a location cluster
function popupHtml(group: { lat: number; lng: number; items: Property[] }): string {
  const { items } = group;
  const sorted = [...items].sort((a, b) => b.discountPercentage - a.discountPercentage);
  const preview = sorted.slice(0, 6);
  const city  = items[0].city || '';
  const state = items[0].state || '';

  const rows = preview.map((p) => `
    <tr style="border-bottom:1px solid #f0f0f0;">
      <td style="padding:5px 4px; font-size:11px; color:#333; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        ${p.title.split('–')[0].trim().substring(0, 32)}
      </td>
      <td style="padding:5px 4px; font-size:11px; font-weight:700; color:#1E6BB8; white-space:nowrap;">
        ${formatCurrency(p.initialBid)}
      </td>
      <td style="padding:5px 4px;">
        <span style="background:#2ECC71;color:white;padding:2px 5px;border-radius:4px;font-size:10px;font-weight:700;">-${p.discountPercentage}%</span>
      </td>
      <td style="padding:5px 4px;">
        <a href="/dashboard/analise/${p.id}" style="font-size:10px;color:#1E6BB8;font-weight:600;text-decoration:none;">Ver</a>
      </td>
    </tr>
  `).join('');

  return `
    <div style="min-width:320px; font-family:sans-serif; padding:2px;">
      <div style="font-weight:800; font-size:13px; color:#0A2E50; margin-bottom:6px;">
        ${city}${state ? `/${state}` : ''} — <span style="color:#1E6BB8;">${items.length.toLocaleString('pt-BR')} imóveis</span>
      </div>
      <table style="width:100%; border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:2px solid #e0e0e0;">
            <th style="text-align:left;font-size:10px;color:#888;padding:3px 4px;font-weight:600;">Imóvel</th>
            <th style="text-align:left;font-size:10px;color:#888;padding:3px 4px;font-weight:600;">Lance</th>
            <th style="font-size:10px;color:#888;padding:3px 4px;font-weight:600;">Desc.</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${items.length > 6 ? `<p style="margin:6px 0 0;font-size:11px;color:#888;text-align:center;">+${(items.length - 6).toLocaleString('pt-BR')} mais nesta cidade</p>` : ''}
    </div>
  `;
}

export default function MapView({ properties, onPropertyClick }: MapViewProps) {
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<import('leaflet').Map | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    let map: import('leaflet').Map;

    async function initMap() {
      const L = (await import('leaflet')).default;

      // Clean up existing instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (!mapRef.current) return;

      map = L.map(mapRef.current, {
        center:      [-15.7801, -47.9292],
        zoom:        5,
        zoomControl: true,
        // Canvas renderer is much faster than SVG for many markers
        renderer:    L.canvas(),
        // Reduce tile requests while panning
        preferCanvas: true,
      });

      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map);

      // ── Group by coordinates (city-level) ────────────────
      const groups = groupByCoords(properties);
      if (groups.length === 0) return;

      const bounds: [number, number][] = [];

      for (const group of groups) {
        const { lat, lng, items } = group;
        bounds.push([lat, lng]);

        const minBid = Math.min(...items.map((p) => p.initialBid));
        const size   = items.length === 1 ? 18 : items.length < 10 ? 21 : items.length < 100 ? 25 : 29;

        const icon = L.divIcon({
          className:  '',
          html:       clusterHtml(items.length, minBid),
          iconSize:   [size * 2, size * 2],
          iconAnchor: [size, size],
        });

        const marker = L.marker([lat, lng], { icon });
        marker.addTo(map);
        marker.bindPopup(popupHtml(group), { maxWidth: 360, minWidth: 320 });

        if (onPropertyClick && items.length === 1) {
          marker.on('click', () => onPropertyClick(items[0].id));
        }
      }

      map.fitBounds(bounds as [number, number][], { padding: [40, 40], maxZoom: 9 });
    }

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties]);

  // Count groups for the info badge
  const groupCount = groupByCoords(properties).length;
  const validCount = properties.filter((p) => p.latitude && p.longitude).length;

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} style={{ height: '100%', width: '100%', borderRadius: '12px', minHeight: '400px' }} />

      {/* Info badge */}
      <div style={{
        position: 'absolute', bottom: '12px', left: '12px', zIndex: 1000,
        backgroundColor: 'rgba(10,46,80,0.85)', color: 'white',
        padding: '0.35rem 0.75rem', borderRadius: '8px',
        fontSize: '0.72rem', fontWeight: 600, pointerEvents: 'none',
        backdropFilter: 'blur(4px)',
      }}>
        {groupCount.toLocaleString('pt-BR')} localizações · {validCount.toLocaleString('pt-BR')} imóveis
      </div>
    </div>
  );
}
