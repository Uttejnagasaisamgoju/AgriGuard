import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Farm } from '../types';

interface FarmThumbnailMapProps {
  farm: Farm;
}

export const FarmThumbnailMap: React.FC<FarmThumbnailMapProps> = ({ farm }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const lat = farm.latitude || 17.7265;
    const lon = farm.longitude || 78.2916;

    try {
      const map = L.map(containerRef.current, {
        center: [lat, lon],
        zoom: 15,
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        touchZoom: false,
        attributionControl: false,
      });

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      ).addTo(map);

      if (farm.boundary_geojson) {
        try {
          const geoLayer = L.geoJSON(farm.boundary_geojson as any, {
            style: {
              color: '#10b981',
              weight: 2,
              fillColor: '#10b981',
              fillOpacity: 0.35,
            },
          }).addTo(map);

          map.fitBounds(geoLayer.getBounds(), { padding: [10, 10], maxZoom: 17 });
        } catch {
          // If GeoJSON parse fails, marker fallback
          L.marker([lat, lon]).addTo(map);
        }
      } else {
        const pinIcon = L.divIcon({
          html: `<div style="width: 10px; height: 10px; background: #10b981; border: 2px solid #ffffff; border-radius: 50%;"></div>`,
          className: '',
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });
        L.marker([lat, lon], { icon: pinIcon }).addTo(map);
      }

      mapRef.current = map;

      // Invalidate after initial render so tiles fill the container correctly
      setTimeout(() => {
        map.invalidateSize({ animate: false });
      }, 100);
    } catch (e) {
      console.warn('Thumbnail map error:', e);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [farm]);

  // Keep map tiles correct when the container is resized (orientation change, etc.)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize({ animate: false });
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // overflow-hidden prevents Leaflet tiles from painting outside the card boundary
  return <div ref={containerRef} className="w-full h-full pointer-events-none overflow-hidden" />;
};
