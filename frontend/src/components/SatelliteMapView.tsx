import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ArrowLeft, MapPin, Crop, Calendar, Layers,
  Leaf, Compass, RefreshCw, AlertCircle, Plus
} from 'lucide-react';
import { farmsApi, weatherApi } from '../services/api';
import type { Farm, WeatherData, SatelliteData } from '../types';
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

  const [satelliteData, setSatelliteData] = useState<SatelliteData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [satLoading, setSatLoading] = useState(false);
  const [error, setError] = useState('');

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const lowZoomMarkerRef = useRef<L.Marker | null>(null);
  const currentFarmRef = useRef<Farm | null>(null);

  // Sequence token for async requests to prevent stale race conditions
  const activeRequestIdRef = useRef<number>(0);

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
        weatherApi.getWeather({ lat, lon }),
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

  useEffect(() => {
    if (selectedFarm) {
      loadSatelliteForFarm(selectedFarm);
    } else {
      setSatelliteData(null);
      setWeather(null);
    }
  }, [selectedFarm?.id, loadSatelliteForFarm]);

  const getDynamicBoundaryStyle = (zoom: number) => {
    let weight = 2.8;
    let opacity = 0.95;
    let fillOpacity = 0.22;

    if (zoom <= 10) {
      weight = 1.5;
      opacity = 0.85;
      fillOpacity = 0.35;
    } else if (zoom <= 13) {
      weight = 2.0;
      opacity = 0.90;
      fillOpacity = 0.28;
    } else if (zoom <= 16) {
      weight = 2.8;
      opacity = 0.95;
      fillOpacity = 0.22;
    } else if (zoom <= 18) {
      weight = 3.5;
      opacity = 1.0;
      fillOpacity = 0.18;
    } else {
      weight = 4.0;
      opacity = 1.0;
      fillOpacity = 0.15;
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

  const updateMap = (farm: Farm) => {
    if (!mapRef.current) return;

    if (!mapInstance.current) {
      const center: [number, number] = [farm.latitude || 18.6725, farm.longitude || 78.0941];
      const map = L.map(mapRef.current, {
        center,
        zoom: 16,
        zoomControl: true,
        attributionControl: false,
      });

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

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
      }).addTo(map);

      map.on('zoomend', () => {
        applyZoomAwareRendering(map, currentFarmRef.current);
      });

      mapInstance.current = map;
    }

    const map = mapInstance.current;

    // Clear previous layers & markers
    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }
    if (lowZoomMarkerRef.current) {
      map.removeLayer(lowZoomMarkerRef.current);
      lowZoomMarkerRef.current = null;
    }

    // Add farm boundary polygon with smoothFactor: 0 and custom pane
    if (farm.boundary_geojson) {
      try {
        const style = getDynamicBoundaryStyle(map.getZoom());
        const geoLayer = L.geoJSON(farm.boundary_geojson, {
          pane: 'farmBoundaryPane',
          style,
        }).addTo(map);

        const bounds = geoLayer.getBounds();
        if (bounds && bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
        } else if (farm.latitude && farm.longitude) {
          map.flyTo([farm.latitude, farm.longitude], 16, { duration: 1.2 });
        }
        geoJsonLayerRef.current = geoLayer;
      } catch (e) {
        console.error('Failed to parse farm GeoJSON:', e);
        if (farm.latitude && farm.longitude) {
          map.flyTo([farm.latitude, farm.longitude], 16, { duration: 1.2 });
        }
      }
    } else if (farm.latitude && farm.longitude) {
      map.flyTo([farm.latitude, farm.longitude], 16, { duration: 1.2 });
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

    if (z < 14) {
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

  useEffect(() => {
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Invalidate map size on window resize and orientation change
  // so Leaflet recalculates tile positions after layout changes
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
    // Legacy orientation change for iOS Safari
    window.addEventListener('orientationchange', handleResize);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      screen.orientation?.removeEventListener('change', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const healthLegend = [
    { label: t('satellite.legendHealthy', undefined, 'Healthy (NDVI > 0.65)'), color: '#22c55e' },
    { label: t('satellite.legendModerate', undefined, 'Moderate (0.45 - 0.65)'), color: '#eab308' },
    { label: t('satellite.legendStressed', undefined, 'Stressed (0.25 - 0.45)'), color: '#f97316' },
    { label: t('satellite.legendSevere', undefined, 'Severe (< 0.25)'), color: '#ef4444' },
  ];

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

            {/* Land Health Overlay Card — Bottom Left of Map
                On mobile (≤768px), moved to top-left to avoid
                overlap with bottom-right Leaflet zoom controls */}
            <div className="absolute bottom-4 sm:bottom-4 top-3 sm:top-auto left-3 sm:left-4 z-[1000] glass-card p-2.5 sm:p-3 border border-emerald-500/30 shadow-xl backdrop-blur-md">
              <p className="text-[9px] sm:text-[10px] font-bold text-emerald-300/80 mb-1 sm:mb-1.5 uppercase tracking-wider">{t('satellite.ndviHealthKey', undefined, 'NDVI Health Key')}</p>
              <div className="flex flex-col gap-1 sm:gap-1.5">
                {healthLegend.map((h) => (
                  <div key={h.label} className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0" style={{ background: h.color, boxShadow: `0 0 6px ${h.color}` }} />
                    <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-100/90 whitespace-nowrap">{h.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Compass Icon — Bottom Right of Map */}
            <div className="absolute bottom-4 right-4 z-[1000] w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-emerald-950/80 border border-emerald-400/40 flex items-center justify-center shadow-lg backdrop-blur-md">
              <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </div>
          </div>

          {/* Right Panel: Details */}
          <div className="space-y-4 flex flex-col">
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
            <div className="glass-card p-4 space-y-3.5 border border-emerald-500/20">
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
