import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ArrowLeft, MapPin, Crop, Calendar, Layers,
  Leaf, Compass, RefreshCw, AlertCircle, Plus,
  CloudRain, Thermometer, Droplets, Wind, ShieldAlert,
  ChevronRight, Info, CheckCircle2, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { farmsApi, weatherApi } from '../services/api';
import type {
  Farm, WeatherData, SatelliteData,
  WeatherHotspotData, WeatherHotspotGridCell, WeatherHotspotLayerType,
  SatelliteViewMode, PathogenThreat
} from '../types';
import { useFarm } from '../context/FarmContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { FarmSelector } from './FarmSelector';
import L from 'leaflet';

interface SatelliteMapViewProps {
  onBack: () => void;
  onViewDetails: () => void;
}

export const SatelliteMapView: React.FC<SatelliteMapViewProps> = ({ onBack, onViewDetails }) => {
  const { user } = useAuth();
  const { t, formatDate, formatNumber } = useLanguage();
  const role = (user?.role || '').toUpperCase();
  const canAddFarm = role === 'FARMER' || role === 'ADMIN';

  const {
    farms,
    selectedFarm,
    loadingFarms,
    farmsError,
    refreshFarms,
    openAddFarmModal,
  } = useFarm();

  // Mode & Layer State
  const [viewMode, setViewMode] = useState<SatelliteViewMode>('satellite');
  const [activeHotspotLayer, setActiveHotspotLayer] = useState<WeatherHotspotLayerType>('temperature');

  // Satellite State
  const [satelliteData, setSatelliteData] = useState<SatelliteData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [satLoading, setSatLoading] = useState(false);
  const [error, setError] = useState('');

  // Hotspot State
  const [hotspotData, setHotspotData] = useState<WeatherHotspotData | null>(null);
  const [hotspotLoading, setHotspotLoading] = useState(false);
  const [hotspotError, setHotspotError] = useState('');
  const [selectedGridCell, setSelectedGridCell] = useState<WeatherHotspotGridCell | null>(null);
  const [showFullMatrix, setShowFullMatrix] = useState(false);

  // Map Refs
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const lowZoomMarkerRef = useRef<L.Marker | null>(null);
  const hotspotLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const currentFarmRef = useRef<Farm | null>(null);

  // Sequence token for async requests to prevent stale race conditions
  const activeRequestIdRef = useRef<number>(0);
  const activeHotspotRequestIdRef = useRef<number>(0);

  // Load Satellite Data
  const loadSatelliteForFarm = useCallback(async (farm: Farm) => {
    currentFarmRef.current = farm;
    const reqId = ++activeRequestIdRef.current;
    setSatLoading(true);
    setError('');

    const lat = farm.latitude || 18.6725;
    const lon = farm.longitude || 78.0941;

    try {
      const [satRes, weatherRes] = await Promise.allSettled([
        farmsApi.getSatellite(farm.id),
        weatherApi.getWeather({ lat, lon, farm_id: farm.id }),
      ]);

      if (reqId !== activeRequestIdRef.current) return;

      if (satRes.status === 'fulfilled') {
        setSatelliteData(satRes.value);
      } else {
        setSatelliteData(null);
      }

      if (weatherRes.status === 'fulfilled') {
        setWeather(weatherRes.value);
      } else {
        setWeather(null);
      }
    } catch {
      if (reqId !== activeRequestIdRef.current) return;
      setSatelliteData(null);
    } finally {
      if (reqId === activeRequestIdRef.current) {
        setSatLoading(false);
        updateMap(farm);
      }
    }
  }, []);

  // Load Weather Hotspot Data
  const loadHotspotForFarm = useCallback(async (farm: Farm, forceRefresh = false) => {
    const reqId = ++activeHotspotRequestIdRef.current;
    setHotspotLoading(true);
    setHotspotError('');

    const lat = farm.latitude || 18.6725;
    const lon = farm.longitude || 78.0941;

    try {
      const res = await weatherApi.getHotspot({
        farm_id: farm.id,
        lat,
        lon,
        force_refresh: forceRefresh,
      });

      if (reqId !== activeHotspotRequestIdRef.current) return;

      if (res && res.available) {
        setHotspotData(res);
        setSelectedGridCell(res.center_readings || (res.grid_cells && res.grid_cells[0]) || null);
      } else {
        setHotspotError(res?.message || 'Unable to load real weather data — Try Again');
      }
    } catch (err: any) {
      if (reqId !== activeHotspotRequestIdRef.current) return;
      const msg = err?.response?.data?.detail || err?.message || 'Unable to load weather data — Try Again';
      setHotspotError(msg);
      setHotspotData(null);
    } finally {
      if (reqId === activeHotspotRequestIdRef.current) {
        setHotspotLoading(false);
      }
    }
  }, []);

  // Fetch when farm changes
  useEffect(() => {
    if (selectedFarm) {
      loadSatelliteForFarm(selectedFarm);
      loadHotspotForFarm(selectedFarm);
    } else {
      setSatelliteData(null);
      setWeather(null);
      setHotspotData(null);
      setSelectedGridCell(null);
    }
  }, [selectedFarm?.id, loadSatelliteForFarm, loadHotspotForFarm]);

  // Dynamic Farm Boundary Style
  const getDynamicBoundaryStyle = (zoom: number) => {
    let weight = 2.8;
    let opacity = 0.95;
    let fillOpacity = viewMode === 'weather_hotspot' ? 0.12 : 0.22;

    if (zoom <= 10) {
      weight = 1.5;
      opacity = 0.85;
      fillOpacity = viewMode === 'weather_hotspot' ? 0.18 : 0.35;
    } else if (zoom <= 13) {
      weight = 2.0;
      opacity = 0.90;
      fillOpacity = viewMode === 'weather_hotspot' ? 0.15 : 0.28;
    } else if (zoom <= 16) {
      weight = 3.0;
      opacity = 0.98;
      fillOpacity = viewMode === 'weather_hotspot' ? 0.12 : 0.22;
    } else if (zoom <= 18) {
      weight = 3.8;
      opacity = 1.0;
      fillOpacity = viewMode === 'weather_hotspot' ? 0.10 : 0.18;
    } else {
      weight = 4.2;
      opacity = 1.0;
      fillOpacity = viewMode === 'weather_hotspot' ? 0.08 : 0.15;
    }

    return {
      pane: 'farmBoundaryPane',
      smoothFactor: 0,
      color: '#10b981',
      weight,
      opacity,
      lineCap: 'round' as const,
      lineJoin: 'round' as const,
      fillColor: '#10b981',
      fillOpacity,
    };
  };

  // Base map initialization & update
  const updateMap = (farm: Farm) => {
    if (!mapRef.current) return;

    if (!mapInstance.current) {
      const center: [number, number] = [farm.latitude || 18.6725, farm.longitude || 78.0941];
      const map = L.map(mapRef.current, {
        center,
        zoom: 15,
        zoomControl: true,
        attributionControl: false,
      });

      // Custom Panes for layer ordering
      if (!map.getPane('weatherHotspotPane')) {
        const hotspotPane = map.createPane('weatherHotspotPane');
        hotspotPane.style.zIndex = '550';
        hotspotPane.style.pointerEvents = 'auto';
      }
      if (!map.getPane('farmBoundaryPane')) {
        const boundaryPane = map.createPane('farmBoundaryPane');
        boundaryPane.style.zIndex = '620';
        boundaryPane.style.pointerEvents = 'auto';
      }
      if (!map.getPane('farmMarkerPane')) {
        const markerPane = map.createPane('farmMarkerPane');
        markerPane.style.zIndex = '650';
        markerPane.style.pointerEvents = 'auto';
      }

      // ArcGIS World Imagery Base Layer
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
      }).addTo(map);

      map.on('zoomend', () => {
        applyZoomAwareRendering(map, currentFarmRef.current);
      });

      mapInstance.current = map;
    }

    const map = mapInstance.current;

    // Clear previous farm boundary layer & markers
    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }
    if (lowZoomMarkerRef.current) {
      map.removeLayer(lowZoomMarkerRef.current);
      lowZoomMarkerRef.current = null;
    }

    // Add farm boundary polygon with custom pane (zIndex: 620)
    if (farm.boundary_geojson) {
      try {
        const style = getDynamicBoundaryStyle(map.getZoom());
        const geoLayer = L.geoJSON(farm.boundary_geojson, {
          pane: 'farmBoundaryPane',
          style,
        }).addTo(map);

        const bounds = geoLayer.getBounds();
        if (bounds && bounds.isValid()) {
          map.fitBounds(bounds, { padding: [45, 45], maxZoom: 17 });
        } else if (farm.latitude && farm.longitude) {
          map.flyTo([farm.latitude, farm.longitude], 15, { duration: 1.2 });
        }
        geoJsonLayerRef.current = geoLayer;
      } catch (e) {
        console.error('Failed to parse farm GeoJSON:', e);
        if (farm.latitude && farm.longitude) {
          map.flyTo([farm.latitude, farm.longitude], 15, { duration: 1.2 });
        }
      }
    } else if (farm.latitude && farm.longitude) {
      map.flyTo([farm.latitude, farm.longitude], 15, { duration: 1.2 });
    }

    applyZoomAwareRendering(map, farm);
  };

  const applyZoomAwareRendering = (map: L.Map, farm: Farm | null) => {
    if (!farm) return;
    const z = map.getZoom();

    if (geoJsonLayerRef.current) {
      const style = getDynamicBoundaryStyle(z);
      geoJsonLayerRef.current.setStyle(style);
    }

    if (z < 13) {
      if (!lowZoomMarkerRef.current) {
        const center: [number, number] = [farm.latitude || 18.6725, farm.longitude || 78.0941];
        const badgeIcon = L.divIcon({
          html: `
            <div class="flex flex-col items-center select-none filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)]" style="transform: translate(-50%, -100%);">
              <div class="px-2.5 py-1 rounded-lg bg-emerald-950/95 border border-emerald-400 text-emerald-300 font-extrabold text-[11px] shadow-[0_0_15px_rgba(16,185,129,0.35)] whitespace-nowrap flex items-center gap-1.5 backdrop-blur-md">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>${farm.name} (${farm.area_hectares ? farm.area_hectares.toFixed(1) + ' ha' : 'Farm'})</span>
              </div>
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" class="-mt-[1px]">
                <path d="M6 8L0 0H12L6 8Z" fill="#064e3b" stroke="#34d399" stroke-width="1.5" />
              </svg>
            </div>
          `,
          className: '',
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        lowZoomMarkerRef.current = L.marker(center, { icon: badgeIcon, pane: 'farmMarkerPane' }).addTo(map);
      }
    } else {
      if (lowZoomMarkerRef.current) {
        map.removeLayer(lowZoomMarkerRef.current);
        lowZoomMarkerRef.current = null;
      }
    }
  };

  // ── Render Weather Hotspot Overlay on Map ───────────────────────────
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear previous weather hotspot layer group
    if (hotspotLayerGroupRef.current) {
      map.removeLayer(hotspotLayerGroupRef.current);
      hotspotLayerGroupRef.current = null;
    }

    // Only render if in weather_hotspot mode and data exists
    if (viewMode !== 'weather_hotspot' || !hotspotData?.grid_cells) {
      return;
    }

    const newGroup = L.layerGroup();

    hotspotData.grid_cells.forEach((cell) => {
      const { lat, lon } = cell;

      // Determine visual style according to active layer
      let color = '#38bdf8';
      let fillOpacity = 0.35;
      let badgeLabel = '';
      let badgeSub = '';

      switch (activeHotspotLayer) {
        case 'rainfall': {
          const p = cell.precipitation;
          const prob = cell.rain_probability;
          if (p > 7.5 || prob >= 80) {
            color = '#7c3aed'; // Heavy - Violet
            fillOpacity = 0.65;
          } else if (p > 2.5 || prob >= 60) {
            color = '#2563eb'; // Moderate - Royal Blue
            fillOpacity = 0.55;
          } else if (p > 0.5 || prob >= 40) {
            color = '#0284c7'; // Light - Sky Blue
            fillOpacity = 0.45;
          } else if (p > 0.0 || prob >= 20) {
            color = '#38bdf8'; // Trace - Cyan
            fillOpacity = 0.32;
          } else {
            color = '#0ea5e9'; // Dry
            fillOpacity = 0.20;
          }
          badgeLabel = p > 0 ? `${p.toFixed(1)} mm` : `${prob}%`;
          badgeSub = p > 0 ? 'rain' : 'prob';
          break;
        }

        case 'temperature': {
          const tVal = cell.temperature;
          if (tVal >= 36) {
            color = '#ef4444'; // Red
            fillOpacity = 0.60;
          } else if (tVal >= 30) {
            color = '#f97316'; // Orange
            fillOpacity = 0.52;
          } else if (tVal >= 24) {
            color = '#eab308'; // Yellow
            fillOpacity = 0.44;
          } else if (tVal >= 18) {
            color = '#10b981'; // Green
            fillOpacity = 0.38;
          } else {
            color = '#38bdf8'; // Blue
            fillOpacity = 0.45;
          }
          badgeLabel = `${tVal.toFixed(1)}°C`;
          badgeSub = `feels ${cell.feels_like.toFixed(0)}°`;
          break;
        }

        case 'humidity': {
          const hVal = cell.humidity;
          if (hVal >= 85) {
            color = '#3b82f6'; // Deep Blue - Saturated
            fillOpacity = 0.65;
          } else if (hVal >= 70) {
            color = '#06b6d4'; // Cyan - Humid
            fillOpacity = 0.50;
          } else if (hVal >= 50) {
            color = '#22c55e'; // Green - Optimal
            fillOpacity = 0.38;
          } else if (hVal >= 35) {
            color = '#eab308'; // Yellow - Dry
            fillOpacity = 0.32;
          } else {
            color = '#f97316'; // Orange - Arid
            fillOpacity = 0.38;
          }
          badgeLabel = `${hVal}%`;
          badgeSub = 'RH';
          break;
        }

        case 'wind': {
          const wVal = cell.wind_speed;
          if (wVal >= 40) {
            color = '#ef4444'; // Red
            fillOpacity = 0.60;
          } else if (wVal >= 28) {
            color = '#f97316'; // Orange
            fillOpacity = 0.50;
          } else if (wVal >= 18) {
            color = '#f59e0b'; // Amber
            fillOpacity = 0.42;
          } else if (wVal >= 10) {
            color = '#14b8a6'; // Teal
            fillOpacity = 0.35;
          } else {
            color = '#38bdf8'; // Cyan
            fillOpacity = 0.25;
          }
          badgeLabel = `${wVal.toFixed(0)} km/h`;
          badgeSub = `${cell.wind_direction}°`;
          break;
        }

        case 'disease_risk': {
          const rObj = cell.disease_risk;
          const score = rObj.overall_score;
          if (score >= 80) {
            color = '#ef4444'; // Red
            fillOpacity = 0.65;
          } else if (score >= 65) {
            color = '#f97316'; // Orange
            fillOpacity = 0.55;
          } else if (score >= 40) {
            color = '#eab308'; // Yellow
            fillOpacity = 0.45;
          } else {
            color = '#10b981'; // Green
            fillOpacity = 0.32;
          }
          badgeLabel = `${score.toFixed(0)}`;
          badgeSub = rObj.risk_level;
          break;
        }
      }

      // Smooth overlapping radial zone circle
      const circle = L.circle([lat, lon], {
        radius: 1650, // Approx ~1.65 km radius coverage per cell
        fillColor: color,
        fillOpacity,
        color,
        weight: cell.is_center ? 2.5 : 1.2,
        dashArray: cell.is_center ? '4, 4' : undefined,
        pane: 'weatherHotspotPane',
      });

      // Interactive Click Handler
      circle.on('click', () => {
        setSelectedGridCell(cell);
      });

      circle.addTo(newGroup);

      // Node Marker Badge
      const isSelected = selectedGridCell?.id === cell.id;
      const isCenter = cell.is_center;

      let arrowSvg = '';
      if (activeHotspotLayer === 'wind') {
        arrowSvg = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${cell.wind_direction}deg);" class="text-white">
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
          </svg>
        `;
      }

      const markerHtml = `
        <div class="cursor-pointer select-none transition-transform hover:scale-110 flex flex-col items-center" style="transform: translate(-50%, -50%);">
          <div class="px-2 py-0.5 rounded-full flex items-center gap-1 font-black text-[10px] tracking-tight backdrop-blur-md shadow-lg border ${
            isSelected
              ? 'ring-2 ring-white scale-110 border-white text-white bg-slate-950/95'
              : isCenter
              ? 'border-emerald-300 text-emerald-200 bg-emerald-950/90 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
              : 'border-slate-700/80 text-white bg-slate-900/85'
          }" style="box-shadow: 0 0 10px ${color}55;">
            ${arrowSvg}
            <span>${badgeLabel}</span>
            ${isCenter ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>' : ''}
          </div>
          <span class="text-[8px] font-semibold text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] -mt-0.5">${badgeSub}</span>
        </div>
      `;

      const markerIcon = L.divIcon({
        html: markerHtml,
        className: '',
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([lat, lon], {
        icon: markerIcon,
        pane: 'weatherHotspotPane',
      });

      // Bind Rich Popup
      const popupHtml = `
        <div class="p-2 space-y-2 text-slate-100 font-sans" style="min-width: 200px;">
          <div class="flex items-center justify-between border-b border-slate-700/80 pb-1.5">
            <span class="font-extrabold text-xs text-white">${cell.is_center ? '📍 Farm Boundary Center' : `Regional Node (${cell.distance_km} km)`}</span>
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${cell.disease_risk.color} text-white">${cell.disease_risk.risk_level} Risk</span>
          </div>
          <div class="grid grid-cols-2 gap-1.5 text-[11px]">
            <div><span class="text-slate-400">Temp:</span> <b class="text-white">${cell.temperature}°C</b></div>
            <div><span class="text-slate-400">Feels:</span> <b class="text-white">${cell.feels_like}°C</b></div>
            <div><span class="text-slate-400">Humidity:</span> <b class="text-white">${cell.humidity}%</b></div>
            <div><span class="text-slate-400">Rain:</span> <b class="text-white">${cell.precipitation} mm (${cell.rain_probability}%)</b></div>
            <div><span class="text-slate-400">Wind:</span> <b class="text-white">${cell.wind_speed} km/h</b></div>
            <div><span class="text-slate-400">Sky:</span> <b class="text-white">${cell.weather_description}</b></div>
          </div>
          ${
            cell.disease_risk.threats.length > 0
              ? `<div class="pt-1.5 border-t border-slate-700/80 text-[10px] text-amber-300">
                   <b>Pathology Alert:</b> ${cell.disease_risk.threats[0].disease_name}
                 </div>`
              : ''
          }
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: 'glass-popup',
        offset: [0, -10],
      });

      marker.on('click', () => {
        setSelectedGridCell(cell);
      });

      marker.addTo(newGroup);
    });

    newGroup.addTo(map);
    hotspotLayerGroupRef.current = newGroup;
  }, [viewMode, activeHotspotLayer, hotspotData, selectedGridCell?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Map resize handler
  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (mapInstance.current) {
          mapInstance.current.invalidateSize({ animate: false });
        }
      }, 150);
    };

    window.addEventListener('resize', handleResize);
    screen.orientation?.addEventListener('change', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      screen.orientation?.removeEventListener('change', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // ── Legends Definition ───────────────────────────────────────────
  const healthLegend = [
    { label: t('satellite.legendHealthy', undefined, 'Healthy (NDVI > 0.65)'), color: '#22c55e' },
    { label: t('satellite.legendModerate', undefined, 'Moderate (0.45 - 0.65)'), color: '#eab308' },
    { label: t('satellite.legendStressed', undefined, 'Stressed (0.25 - 0.45)'), color: '#f97316' },
    { label: t('satellite.legendSevere', undefined, 'Severe (< 0.25)'), color: '#ef4444' },
  ];

  const hotspotLegends: Record<WeatherHotspotLayerType, { title: string; items: { label: string; color: string }[] }> = {
    rainfall: {
      title: 'Rainfall Intensity & Chance',
      items: [
        { label: 'Heavy (> 7.5 mm/h)', color: '#7c3aed' },
        { label: 'Moderate (2.5 - 7.5 mm/h)', color: '#2563eb' },
        { label: 'Light (0.5 - 2.5 mm/h)', color: '#0284c7' },
        { label: 'Trace / Probability (0.1 - 0.5 mm)', color: '#38bdf8' },
        { label: 'Dry / No Precipitation', color: '#0ea5e9' },
      ],
    },
    temperature: {
      title: 'Temperature Zones',
      items: [
        { label: 'Extreme Heat (≥ 36°C)', color: '#ef4444' },
        { label: 'Hot (30 - 35°C)', color: '#f97316' },
        { label: 'Warm (24 - 29°C)', color: '#eab308' },
        { label: 'Mild (18 - 23°C)', color: '#10b981' },
        { label: 'Cool (< 18°C)', color: '#38bdf8' },
      ],
    },
    humidity: {
      title: 'Relative Humidity',
      items: [
        { label: 'Saturated (> 85% Spore Risk)', color: '#3b82f6' },
        { label: 'Humid (70 - 85%)', color: '#06b6d4' },
        { label: 'Balanced (50 - 70%)', color: '#22c55e' },
        { label: 'Dry (35 - 50%)', color: '#eab308' },
        { label: 'Arid (< 35%)', color: '#f97316' },
      ],
    },
    wind: {
      title: 'Wind Speed & Vectors',
      items: [
        { label: 'Gale / High Wind (≥ 40 km/h)', color: '#ef4444' },
        { label: 'Strong (28 - 40 km/h)', color: '#f97316' },
        { label: 'Moderate (18 - 28 km/h)', color: '#f59e0b' },
        { label: 'Gentle (10 - 18 km/h)', color: '#14b8a6' },
        { label: 'Calm (< 10 km/h)', color: '#38bdf8' },
      ],
    },
    disease_risk: {
      title: 'Disease & Pest Pathology Risk',
      items: [
        { label: 'Critical Risk (≥ 80)', color: '#ef4444' },
        { label: 'Elevated Risk (65 - 80)', color: '#f97316' },
        { label: 'Moderate Risk (40 - 65)', color: '#eab308' },
        { label: 'Low Risk (< 40)', color: '#10b981' },
      ],
    },
  };

  // Satellite Metric Values
  const ndviValue = satelliteData?.ndvi_mean ?? (satelliteData?.ndvi?.value ?? 0);
  const soilMoistureValue: number = typeof satelliteData?.soil_moisture === 'number'
    ? satelliteData.soil_moisture
    : (satelliteData?.soil_moisture?.percentage ?? (weather?.humidity ? Math.round(weather.humidity * 0.4) : 0));
  const tempValue = satelliteData?.surface_temp ?? (satelliteData?.temperature?.surface_c ?? (weather?.temperature ?? 0));
  const healthStatus = satelliteData?.health_status || (satelliteData?.ndvi?.health_category as any) || (ndviValue > 0.6 ? 'Good' : ndviValue > 0.4 ? 'Moderate' : 'Stressed');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Good':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'Moderate':
        return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
      case 'Stressed':
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
      default:
        return 'bg-red-500/20 text-red-400 border border-red-500/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'Good':
        return t('satellite.statusGood', undefined, 'Good');
      case 'Moderate':
        return t('satellite.statusModerate', undefined, 'Moderate');
      case 'Stressed':
        return t('satellite.statusStressed', undefined, 'Stressed');
      default:
        return t('satellite.statusSevere', undefined, 'Severe');
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return t('satellite.activeObservation', undefined, 'Active Observation');
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return formatDate(d, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Inspect reading active cell (clicked node or center parcel)
  const activeReadingCell = selectedGridCell || hotspotData?.center_readings || null;

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Pinned Header with Reference-Matched Farm Selector */}
      <div className="sticky top-0 z-30 -mt-2 py-3 bg-[#031c15]/95 backdrop-blur-xl border-b border-emerald-500/20 -mx-3 sm:-mx-6 px-3 sm:px-6 flex items-center justify-between flex-wrap gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="lg:hidden p-2 rounded-xl hover:bg-emerald-900/30 transition">
            <ArrowLeft className="w-5 h-5 text-emerald-300" />
          </button>
          <div>
            <h1 className="text-xl font-black text-white font-heading">{t('satellite.pageTitle', undefined, 'Satellite View & Land Area')}</h1>
            <p className="text-emerald-300/70 text-xs mt-0.5">{t('satellite.pageSubtitle', undefined, 'Real-time Sentinel-2 L2A & Land Surface Analysis')}</p>
          </div>
        </div>

        {/* Dynamic Farm Selector Component */}
        <FarmSelector />
      </div>

      {(error || farmsError) && (
        <div className="glass-card p-3 flex items-center justify-between border-red-500/30">
          <span className="text-red-300 text-xs">{error || farmsError}</span>
          <button onClick={refreshFarms} className="btn-secondary text-xs py-1 px-2.5">
            <RefreshCw className="w-3 h-3" /> {t('common.tryAgain', undefined, 'Retry')}
          </button>
        </div>
      )}

      {farms.length === 0 && !loadingFarms ? (
        <div className="glass-card p-8 flex flex-col items-center justify-center text-center space-y-4 border-emerald-500/20">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-base font-black text-white font-heading">
              {canAddFarm
                ? t('satellite.noFarmsTitle', undefined, 'No Farm Records Registered')
                : t('satellite.noParcelsOfficerTitle', undefined, 'No Farm Records Available')}
            </h3>
            <p className="text-xs text-emerald-300/70">
              {canAddFarm
                ? t('satellite.noFarmsSubtitle', undefined, 'Define your farm perimeter on the satellite map to activate automated Sentinel-2 vegetation monitoring, NDVI health tracking, and soil moisture analytics.')
                : t('satellite.noParcelsOfficerSubtitle', undefined, 'No registered farmer parcels are currently available for satellite GIS inspection in your monitored zone.')}
            </p>
          </div>
          {canAddFarm && (
            <button
              type="button"
              onClick={openAddFarmModal}
              className="btn-primary py-2.5 px-5 text-xs font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{t('satellite.addFirstFarm', undefined, 'Add Your First Farm')}</span>
            </button>
          )}
        </div>
      ) : (
        /* Main Map + Right Details Grid */
        <div className="satellite-layout">
          {/* Map Container */}
          <div className="glass-card overflow-hidden flex flex-col relative border border-emerald-500/20" style={{ minHeight: 0 }}>
            <div ref={mapRef} className="satellite-map-canvas" />

            {/* Top Bar on Map: View Mode & Hotspot Sublayers Switcher */}
            <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pointer-events-none">
              {/* Primary View Toggle: Satellite vs Weather Hotspot */}
              <div className="pointer-events-auto flex items-center bg-[#061811]/90 backdrop-blur-xl border border-emerald-500/30 rounded-xl p-1 shadow-2xl">
                <button
                  type="button"
                  onClick={() => setViewMode('satellite')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'satellite'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                      : 'text-emerald-300 hover:text-white hover:bg-emerald-900/40'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Sentinel Satellite</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setViewMode('weather_hotspot');
                    if (selectedFarm && !hotspotData && !hotspotLoading) {
                      loadHotspotForFarm(selectedFarm);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewMode === 'weather_hotspot'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                      : 'text-cyan-300 hover:text-white hover:bg-cyan-900/40'
                  }`}
                >
                  <CloudRain className="w-3.5 h-3.5" />
                  <span>Weather Hotspot</span>
                  {hotspotData?.elevated_threats && hotspotData.elevated_threats.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse ml-0.5" />
                  )}
                </button>
              </div>

              {/* Weather Hotspot Sublayer Switcher (When Hotspot is active) */}
              {viewMode === 'weather_hotspot' && (
                <div className="pointer-events-auto flex items-center bg-[#061811]/95 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-1 shadow-2xl overflow-x-auto max-w-full">
                  <button
                    type="button"
                    onClick={() => setActiveHotspotLayer('rainfall')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                      activeHotspotLayer === 'rainfall'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <CloudRain className="w-3 h-3 text-blue-300" />
                    <span>Rainfall</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveHotspotLayer('temperature')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                      activeHotspotLayer === 'temperature'
                        ? 'bg-amber-500 text-slate-950 shadow-md'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <Thermometer className="w-3 h-3 text-amber-400" />
                    <span>Temp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveHotspotLayer('humidity')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                      activeHotspotLayer === 'humidity'
                        ? 'bg-cyan-500 text-slate-950 shadow-md'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <Droplets className="w-3 h-3 text-cyan-400" />
                    <span>Humidity</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveHotspotLayer('wind')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                      activeHotspotLayer === 'wind'
                        ? 'bg-teal-500 text-slate-950 shadow-md'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <Wind className="w-3 h-3 text-teal-300" />
                    <span>Wind</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveHotspotLayer('disease_risk')}
                    className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                      activeHotspotLayer === 'disease_risk'
                        ? 'bg-red-500 text-white shadow-md'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <ShieldAlert className="w-3 h-3 text-red-400" />
                    <span>Disease Risk</span>
                  </button>

                  {/* Manual Refresh Button */}
                  <button
                    type="button"
                    onClick={() => selectedFarm && loadHotspotForFarm(selectedFarm, true)}
                    disabled={hotspotLoading}
                    title="Refresh live real weather data"
                    className="p-1 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-800/40 transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${hotspotLoading ? 'animate-spin text-emerald-400' : ''}`} />
                  </button>
                </div>
              )}
            </div>

            {/* Dynamic Map Legend Overlay — Bottom Left of Map */}
            <div className="absolute bottom-3 left-3 sm:left-4 z-[1000] glass-card p-2 sm:p-2.5 border border-emerald-500/30 shadow-2xl backdrop-blur-md max-w-[240px]">
              {viewMode === 'satellite' ? (
                <>
                  <p className="text-[9px] sm:text-[10px] font-bold text-emerald-300/80 mb-1 sm:mb-1.5 uppercase tracking-wider">
                    {t('satellite.ndviHealthKey', undefined, 'NDVI Health Key')}
                  </p>
                  <div className="flex flex-col gap-1 sm:gap-1.5">
                    {healthLegend.map((h) => (
                      <div key={h.label} className="flex items-center gap-1.5 sm:gap-2">
                        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0" style={{ background: h.color, boxShadow: `0 0 6px ${h.color}` }} />
                        <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-100/90 whitespace-nowrap">{h.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1 sm:mb-1.5">
                    <p className="text-[9px] sm:text-[10px] font-bold text-cyan-300/90 uppercase tracking-wider">
                      {hotspotLegends[activeHotspotLayer].title}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 sm:gap-1.5">
                    {hotspotLegends[activeHotspotLayer].items.map((item) => (
                      <div key={item.label} className="flex items-center gap-1.5 sm:gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }} />
                        <span className="text-[10px] sm:text-[11px] font-medium text-slate-200 truncate">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Farm Center Badge Indicator — Top/Center when Hotspot Active */}
            {viewMode === 'weather_hotspot' && selectedFarm && (
              <div className="absolute bottom-4 right-14 z-[1000] hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/85 border border-emerald-400/40 text-xs text-white shadow-xl backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="font-bold text-emerald-300">Framed Farm:</span>
                <span className="font-semibold truncate max-w-[120px]">{selectedFarm.name}</span>
                <span className="text-emerald-400/60 text-[10px]">({selectedFarm.crop_type || 'Crop'})</span>
              </div>
            )}

            {/* Compass Icon — Bottom Right of Map */}
            <div className="absolute bottom-4 right-4 z-[1000] w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-950/80 border border-emerald-400/40 flex items-center justify-center shadow-lg backdrop-blur-md">
              <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </div>
          </div>

          {/* Right Panel: Details (Dynamically Switches based on View Mode) */}
          <div className="space-y-4 flex flex-col">
            {viewMode === 'satellite' ? (
              /* SATELLITE MODE DETAILS */
              <>
                {/* Land Details Card */}
                <div className="glass-card p-4 space-y-3.5 border border-emerald-500/20 relative overflow-hidden">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    {t('satellite.landDetails', undefined, 'Land Details')}
                  </h3>

                  {satLoading ? (
                    <div className="space-y-3 py-1 animate-pulse">
                      <div className="h-10 skeleton rounded-lg" />
                      <div className="h-10 skeleton rounded-lg" />
                      <div className="h-10 skeleton rounded-lg" />
                      <div className="h-10 skeleton rounded-lg" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <DetailRow
                        icon={<Leaf className="w-3.5 h-3.5" />}
                        label={t('satellite.farmName', undefined, 'Farm Name')}
                        value={selectedFarm?.name || t('farm.farmDetails', undefined, 'Farm Area')}
                      />
                      <DetailRow
                        icon={<Layers className="w-3.5 h-3.5" />}
                        label={t('satellite.registeredArea', undefined, 'Registered Area')}
                        value={
                          selectedFarm?.area_hectares
                            ? `${formatNumber(Number(selectedFarm.area_hectares.toFixed(2)))} ${t('satellite.hectares', undefined, 'hectares')}`
                            : `0 ${t('satellite.hectares', undefined, 'hectares')}`
                        }
                      />
                      <DetailRow
                        icon={<Crop className="w-3.5 h-3.5" />}
                        label={t('satellite.cropType', undefined, 'Crop Type')}
                        value={selectedFarm?.crop_type || t('satellite.unspecified', undefined, 'Unspecified')}
                      />
                      <DetailRow
                        icon={<Calendar className="w-3.5 h-3.5" />}
                        label={t('satellite.observationTime', undefined, 'Observation Time')}
                        value={formatDateTime(satelliteData?.captured_at || satelliteData?.acquisition_date || selectedFarm?.updated_at)}
                      />
                    </div>
                  )}
                </div>

                {/* Satellite Information Card */}
                <div
                  tabIndex={0}
                  role="region"
                  aria-label={t('satellite.analytics', undefined, 'Satellite Analytics')}
                  className="glass-card p-4 space-y-3.5 border border-emerald-500/20 text-left"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">{t('satellite.analytics', undefined, 'Satellite Analytics')}</h3>
                    {satLoading && <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" />}
                  </div>

                  {satLoading ? (
                    <div className="space-y-3 py-1 animate-pulse">
                      <div className="h-8 skeleton rounded-lg" />
                      <div className="h-8 skeleton rounded-lg" />
                      <div className="h-8 skeleton rounded-lg" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-emerald-300/80 font-medium">{t('satellite.ndviVegetationIndex', undefined, 'NDVI (Vegetation Index)')}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {ndviValue > 0 ? formatNumber(Number(ndviValue.toFixed(2))) : '--'}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusBadge(healthStatus)}`}>
                            {getStatusLabel(healthStatus)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-emerald-300/80 font-medium">{t('satellite.soilMoisture', undefined, 'Soil Moisture (0-7cm)')}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {soilMoistureValue > 0 ? `${formatNumber(soilMoistureValue)}%` : '--'}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            {soilMoistureValue >= 25 && soilMoistureValue <= 45
                              ? t('satellite.moistureOptimal', undefined, 'Optimal')
                              : soilMoistureValue < 25
                              ? t('satellite.moistureLow', undefined, 'Low')
                              : t('satellite.moistureWet', undefined, 'Wet')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-emerald-300/80 font-medium">{t('satellite.canopyTemp', undefined, 'Canopy / Surface Temp')}</span>
                        <span className="text-sm font-bold text-white">
                          {tempValue > 0 ? `${formatNumber(tempValue)}°C` : '--'}
                        </span>
                      </div>

                      {(satelliteData?.imagery_source || satelliteData?.satellite_provider) && (
                        <div className="pt-2 border-t border-emerald-500/15 text-[10px] text-emerald-400/60 font-medium">
                          {t('satellite.sensor', undefined, 'Sensor')}: {satelliteData?.imagery_source || satelliteData?.satellite_provider}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* View Crop Details Button */}
                <button
                  onClick={onViewDetails}
                  className="btn-primary w-full py-3 text-xs font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.3)] mt-auto cursor-pointer"
                >
                  {t('satellite.viewCropHistory', undefined, 'View Crop Pathology History')}
                </button>
              </>
            ) : (
              /* WEATHER HOTSPOT MODE DETAILS */
              <>
                {/* Weather Hotspot Loading State */}
                {hotspotLoading && !hotspotData && (
                  <div className="glass-card p-5 space-y-3.5 border border-cyan-500/30 animate-pulse text-left">
                    <div className="h-5 skeleton w-1/2 rounded" />
                    <div className="h-16 skeleton rounded-xl" />
                    <div className="h-24 skeleton rounded-xl" />
                    <div className="h-32 skeleton rounded-xl" />
                  </div>
                )}

                {/* Weather Hotspot Error State */}
                {hotspotError && (
                  <div className="glass-card p-4 space-y-3 border-red-500/40 text-left">
                    <div className="flex items-center gap-2 text-red-400 text-sm font-bold">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span>Unable to load weather data</span>
                    </div>
                    <p className="text-xs text-slate-300">{hotspotError}</p>
                    <button
                      type="button"
                      onClick={() => selectedFarm && loadHotspotForFarm(selectedFarm, true)}
                      className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-2 cursor-pointer w-full justify-center"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Try Again</span>
                    </button>
                  </div>
                )}

                {/* Normal Hotspot Details Content */}
                {hotspotData && (
                  <>
                    {/* Microclimate Summary Card */}
                    <div className="glass-card p-4 space-y-3.5 border border-cyan-500/30 text-left relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                            <Thermometer className="w-4 h-4 text-cyan-400" />
                            <span>Microclimate Readings</span>
                          </h3>
                          <p className="text-[10px] text-cyan-300/70 mt-0.5">
                            {activeReadingCell?.is_center
                              ? `📍 ${selectedFarm?.name || 'Farm Boundary Center'}`
                              : `🌐 Node (${activeReadingCell?.distance_km} km from farm)`}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                          {activeReadingCell?.weather_description || 'Live'}
                        </span>
                      </div>

                      {/* Microclimate 4-Box Grid */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/60">
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Thermometer className="w-3 h-3 text-amber-400" />
                            <span>Temperature</span>
                          </div>
                          <div className="text-lg font-black text-white mt-1">
                            {activeReadingCell ? `${activeReadingCell.temperature}°C` : '--'}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            Feels like {activeReadingCell?.feels_like}°C
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/60">
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Droplets className="w-3 h-3 text-cyan-400" />
                            <span>Humidity</span>
                          </div>
                          <div className="text-lg font-black text-white mt-1">
                            {activeReadingCell ? `${activeReadingCell.humidity}%` : '--'}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {activeReadingCell && activeReadingCell.humidity >= 85 ? '⚠️ Spore Wetness' : 'Relative Humidity'}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/60">
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <CloudRain className="w-3 h-3 text-blue-400" />
                            <span>Precipitation</span>
                          </div>
                          <div className="text-lg font-black text-white mt-1">
                            {activeReadingCell ? `${activeReadingCell.precipitation} mm` : '--'}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            Chance {activeReadingCell?.rain_probability}%
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/60">
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Wind className="w-3 h-3 text-teal-400" />
                            <span>Wind Speed</span>
                          </div>
                          <div className="text-lg font-black text-white mt-1">
                            {activeReadingCell ? `${activeReadingCell.wind_speed} km/h` : '--'}
                          </div>
                          <div className="text-[9px] text-slate-400">
                            Direction {activeReadingCell?.wind_direction}°
                          </div>
                        </div>
                      </div>

                      {/* Source Citation */}
                      <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[9px] text-slate-400">
                        <span>Source: Open-Meteo ECMWF/DWD/NOAA</span>
                        <span className="text-emerald-400 font-semibold">100% Real Meteorological Data</span>
                      </div>

                      {/* Active Hotspot Sublayer Legend */}
                      <div className="mt-3 pt-2.5 border-t border-cyan-500/20 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                            <Info className="w-3 h-3 text-cyan-400" />
                            <span>{hotspotLegends[activeHotspotLayer].title}</span>
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 uppercase">
                            {activeHotspotLayer.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {hotspotLegends[activeHotspotLayer].items.map((item) => (
                            <div key={item.label} className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }} />
                              <span className="text-[10px] font-medium text-slate-300 truncate">{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Short-Term 6-Hour Forecast Timeline */}
                    {activeReadingCell?.forecast_short_term && activeReadingCell.forecast_short_term.length > 0 && (
                      <div className="glass-card p-3.5 space-y-2 border border-cyan-500/20 text-left">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                            <span>6-Hour Short-Term Forecast</span>
                          </h4>
                          <span className="text-[10px] text-slate-400">Hourly Model</span>
                        </div>

                        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                          {activeReadingCell.forecast_short_term.map((item, idx) => {
                            const timeStr = item.time ? item.time.split('T')[1] || item.time : `+${idx}h`;
                            return (
                              <div
                                key={idx}
                                className="flex flex-col items-center p-2 rounded-xl bg-slate-900/70 border border-slate-700/50 min-w-[58px] flex-shrink-0 text-center"
                              >
                                <span className="text-[10px] text-slate-400 font-semibold">{timeStr}</span>
                                <span className="text-xs font-extrabold text-white mt-1">{item.temp}°C</span>
                                <div className="flex items-center gap-0.5 text-[9px] text-blue-300 font-bold mt-1">
                                  <CloudRain className="w-2.5 h-2.5" />
                                  <span>{item.rain_prob}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Agronomic Disease & Pest Risk Advisory Card */}
                    <div className="glass-card p-4 space-y-3 border border-red-500/30 text-left relative overflow-hidden bg-gradient-to-br from-slate-950/80 to-[#180a0a]/70">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-red-400" />
                          <h3 className="text-sm font-bold text-white">Pathology Risk Advisory</h3>
                        </div>
                        <span
                          className="text-[10px] font-black px-2 py-0.5 rounded-full border text-white"
                          style={{
                            backgroundColor: `${activeReadingCell?.disease_risk.color}33`,
                            borderColor: activeReadingCell?.disease_risk.color,
                          }}
                        >
                          {activeReadingCell?.disease_risk.risk_level.toUpperCase()} (Score: {activeReadingCell?.disease_risk.overall_score})
                        </span>
                      </div>

                      <p className="text-xs text-slate-200">
                        {activeReadingCell?.disease_risk.guidance}
                      </p>

                      {/* Primary Identified Threat */}
                      {activeReadingCell?.disease_risk.threats && activeReadingCell.disease_risk.threats.length > 0 && (
                        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/70 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold text-amber-300">
                              {activeReadingCell.disease_risk.threats[0].disease_name}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {activeReadingCell.disease_risk.threats[0].risk_level} Risk
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-300">
                            <b>Documented Threshold:</b> {activeReadingCell.disease_risk.threats[0].threshold_reason}
                          </div>

                          <div className="text-[11px] text-emerald-300 pt-1 border-t border-slate-700/50">
                            <b>Guidance Recommendation:</b> {activeReadingCell.disease_risk.threats[0].recommended_action}
                          </div>
                        </div>
                      )}

                      {/* Full Pathology Matrix Toggle */}
                      {activeReadingCell?.disease_risk.pathology_matrix && activeReadingCell.disease_risk.pathology_matrix.length > 1 && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setShowFullMatrix(!showFullMatrix)}
                            className="text-xs text-cyan-300 font-semibold flex items-center gap-1 hover:text-cyan-200 transition cursor-pointer"
                          >
                            <span>{showFullMatrix ? 'Hide other crop pathogen tests' : `View all crop pathogens (${activeReadingCell.disease_risk.pathology_matrix.length})`}</span>
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showFullMatrix ? 'rotate-90' : ''}`} />
                          </button>

                          {showFullMatrix && (
                            <div className="mt-2 space-y-2 pt-2 border-t border-slate-800">
                              {activeReadingCell.disease_risk.pathology_matrix.slice(1).map((pm, idx) => (
                                <div key={idx} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-[10px] space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-white">{pm.disease_name}</span>
                                    <span className="font-semibold text-slate-300">{pm.risk_level} ({pm.risk_score} pts)</span>
                                  </div>
                                  <div className="text-slate-400">{pm.threshold_reason}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Elevated Notification Dispatch Alert */}
                      {hotspotData.alert_dispatched && (
                        <div className="p-2.5 rounded-lg bg-red-950/70 border border-red-500/40 flex items-center gap-2 text-red-200 text-xs font-semibold">
                          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          <span>Advisory dispatched to Recent Activity & in-app notifications.</span>
                        </div>
                      )}

                      {/* Mandatory Scientific Guidance Disclaimer */}
                      <div className="text-[9px] text-slate-400 italic pt-1 border-t border-slate-800">
                        {activeReadingCell?.disease_risk.disclaimer}
                      </div>
                    </div>

                    {/* View Crop Details Button */}
                    <button
                      onClick={onViewDetails}
                      className="btn-primary w-full py-3 text-xs font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.3)] mt-auto cursor-pointer"
                    >
                      {t('satellite.viewCropHistory', undefined, 'View Crop Pathology History')}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const DetailRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3">
    <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 flex-shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-[10px] text-emerald-300/60 font-medium">{label}</div>
      <div className="text-xs text-white font-bold truncate">{value}</div>
    </div>
  </div>
);
