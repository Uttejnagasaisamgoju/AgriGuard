import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useFarm } from '../context/FarmContext';
import { FarmSelector } from './FarmSelector';
import {
  Sprout, Heart, ShieldCheck, Cloud, MapPin,
  Scan, BookOpen, MessageSquare, Satellite, ChevronRight,
  Bell, RefreshCw, Bot, Sparkles, Plus,
} from 'lucide-react';
import { dashboardApi, weatherApi } from '../services/api';
import type { DashboardData, WeatherData, Farm } from '../types';
import L from 'leaflet';

import { formatStatSentence } from '../utils/pronunciation';

interface HomeDashboardViewProps {
  onNavigate: (screen: string) => void;
  onOpenNotifications?: () => void;
}

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({ onNavigate, onOpenNotifications }) => {
  const { user } = useAuth();
  const { t, formatNumber, language } = useLanguage();
  const role = (user?.role || '').toUpperCase();
  const canAddFarm = role === 'FARMER' || role === 'ADMIN';
  const { farms, selectedFarm, selectFarm, openAddFarmModal, loadingFarms } = useFarm();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  // Update weather whenever selected farm changes
  useEffect(() => {
    if (selectedFarm?.latitude && selectedFarm?.longitude) {
      weatherApi
        .getWeather({ lat: selectedFarm.latitude, lon: selectedFarm.longitude })
        .then((w) => setWeather(w))
        .catch(() => {});
    }
  }, [selectedFarm?.id, selectedFarm?.latitude, selectedFarm?.longitude]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const dash = await dashboardApi.getDashboard();
      setDashboard(dash);

      // Fetch weather for first farm or default location if selectedFarm not loaded yet
      const lat = selectedFarm?.latitude ?? 18.6725;
      const lon = selectedFarm?.longitude ?? 78.0941;
      try {
        const w = await weatherApi.getWeather({ lat, lon });
        setWeather(w);
      } catch {}
    } catch {
      setError('Unable to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  // Stats purely derived from real backend data
  const rawStats = dashboard?.stats;
  const stats = {
    total_farms: rawStats?.total_farms ?? farms.length,
    healthy_crops: rawStats?.healthy_crops ?? 0,
    active_officers: rawStats?.active_officers ?? 0,
  };

  const statCards = [
    { key: 'totalFarms', label: t('dashboard.totalFarms', undefined, 'Total Farms'), value: stats.total_farms, icon: Sprout, color: 'bg-emerald-500/20', iconColor: 'text-emerald-400', border: 'border-emerald-500/30' },
    { key: 'healthyCrops', label: t('dashboard.healthyCrops', undefined, 'Healthy Crops'), value: stats.healthy_crops, icon: Heart, color: 'bg-emerald-500/20', iconColor: 'text-emerald-400', border: 'border-emerald-500/30' },
    { key: 'activeOfficers', label: t('dashboard.activeOfficers', undefined, 'Active Officers'), value: stats.active_officers, icon: ShieldCheck, color: 'bg-amber-500/20', iconColor: 'text-amber-400', border: 'border-amber-500/30' },
  ];

  const quickActions = [
    { label: t('dashboard.detectDisease', undefined, 'Detect Disease'), subtitle: t('detection.uploadPhoto', undefined, 'Upload crop images'), icon: Scan, color: 'bg-emerald-500/20', screen: 'disease-detect' },
    { label: t('dashboard.diseaseLibrary', undefined, 'Disease Library'), subtitle: t('library.title', undefined, 'Explore crop diseases'), icon: BookOpen, color: 'bg-emerald-500/20', screen: 'disease-library' },
    { label: t('dashboard.expertChat', undefined, 'Expert Chat'), subtitle: t('nav.expertChat', undefined, 'Explore agriculture experts'), icon: MessageSquare, color: 'bg-emerald-500/20', screen: 'chat' },
    { label: t('dashboard.viewSatellite', undefined, 'View Satellite'), subtitle: t('nav.satellite', undefined, 'Check your land & crops'), icon: Satellite, color: 'bg-emerald-500/20', screen: 'satellite' },
  ];

  if (loading && !dashboard && farms.length === 0 && loadingFarms) {
    return (
      <div className="space-y-5 animate-fade-in-up">
        <div className="h-16 skeleton w-2/3" />
        <div className="dashboard-stats-grid dashboard-stats-3-col">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 skeleton" />
          ))}
        </div>
        <div className="dashboard-main-grid">
          <div className="h-72 skeleton" />
          <div className="h-72 skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Sticky Top Greeting & Controls Bar — Stays pinned on scroll */}
      <div className="sticky top-0 z-30 -mt-2 py-3 bg-[#031c15]/95 backdrop-blur-xl border-b border-emerald-500/20 -mx-3 sm:-mx-6 px-3 sm:px-6 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-heading">
            {t('common.welcome', undefined, 'Hello')}, {user?.name || t('roles.farmer')} 👋
          </h1>
          <p className="text-emerald-300/80 text-xs mt-0.5">{t('common.brandTagline', undefined, 'Healthy crops, better tomorrow!')}</p>
        </div>

        {/* Farm Selector + Weather card + Notification Bell */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <FarmSelector />

          <div
            tabIndex={0}
            role="button"
            onClick={() => onNavigate('satellite')}
            title="View Weather Hotspot Map in Satellite View"
            aria-label={`Current weather: ${weather?.temperature ? `${weather.temperature} degrees Celsius` : '28 degrees Celsius'}, ${weather?.description || 'Partly Cloudy'}. Click to view Weather Hotspot Map.`}
            data-read-aloud-text={`Current local weather is ${weather?.temperature ? `${weather.temperature} degrees Celsius` : '28 degrees Celsius'}, with ${weather?.description || 'Partly Cloudy'} skies.`}
            className="glass-card px-3.5 py-2 flex items-center gap-2.5 border border-emerald-500/25 hover:border-cyan-400/50 hover:bg-emerald-900/30 transition cursor-pointer"
          >
            <Cloud className="w-6 h-6 text-cyan-300 flex-shrink-0" />
            <div className="text-left">
              <div className="text-base font-black text-white leading-tight">
                {weather?.temperature ? `${weather.temperature}°C` : '28°C'}
              </div>
              <div className="text-[10px] text-emerald-200/90 font-semibold truncate max-w-[100px]">
                {weather?.description || 'Partly Cloudy'}
              </div>
            </div>
          </div>

          <button
            onClick={onOpenNotifications}
            className="glass-card p-2.5 hover:bg-emerald-500/20 text-emerald-300 hover:text-white transition-colors relative cursor-pointer border border-emerald-500/25"
            title={t('nav.notifications', undefined, 'Notifications')}
            aria-label={t('nav.notifications', undefined, 'Notifications')}
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-400 rounded-full animate-pulse" />
          </button>
        </div>
      </div>

      {/* Horizontal Swipeable Farm Cards Row (Farmer Role) */}
      {farms.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sprout className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('farmer.myFarms', undefined, 'Your Registered Farms')} ({farms.length})</span>
            </h3>
            {canAddFarm && (
              <button
                type="button"
                onClick={openAddFarmModal}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('farmer.addFarm', undefined, 'Add Farm')}</span>
              </button>
            )}
          </div>

          <div className="horizontal-swipe-row py-1">
            {farms.map((farm) => {
              const isSelected = selectedFarm?.id === farm.id;
              const areaStr = farm.area_hectares
                ? `${formatNumber(Number(farm.area_hectares.toFixed(1)))} ${t('farm.hectaresUnit', undefined, 'ha')}`
                : (farm.crop_type || 'Field');

              return (
                <div
                  key={farm.id}
                  onClick={() => selectFarm(farm)}
                  className={`horizontal-swipe-item w-56 sm:w-64 glass-card p-3 rounded-2xl border transition-all cursor-pointer select-none text-left ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-900/40 shadow-[0_0_20px_rgba(52,211,153,0.3)] scale-[1.02]'
                      : 'border-emerald-500/20 hover:border-emerald-400/50 hover:bg-emerald-950/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 truncate max-w-[120px]">
                      {farm.crop_type || 'Crop'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-emerald-400 text-emerald-950 font-black'
                        : 'bg-emerald-950 text-emerald-400/80 border border-emerald-500/30'
                    }`}>
                      {isSelected ? t('common.active', undefined, 'Active') : t('common.view', undefined, 'Select')}
                    </span>
                  </div>

                  <h4 className="text-sm font-black text-white truncate">{farm.name}</h4>
                  <p className="text-[11px] text-emerald-200/80 mt-0.5 font-medium">{areaStr}</p>

                  <div className="flex items-center justify-between text-[10px] text-emerald-400/70 mt-2.5 pt-2 border-t border-emerald-500/15">
                    <span className="truncate">{farm.village || farm.district || 'Telangana'}</span>
                    <span className="text-emerald-300 font-bold">{t('satellite.statusGood', undefined, 'Healthy')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="glass-card p-3 flex items-center justify-between border-red-500/30">
          <span className="text-red-300 text-xs">{error}</span>
          <button onClick={loadData} className="btn-secondary text-xs py-1 px-2.5">
            <RefreshCw className="w-3 h-3" /> {t('common.tryAgain', undefined, 'Retry')}
          </button>
        </div>
      )}

      {/* AI Agriculture Assistant Quick Banner */}
      <div className="glass-card p-4 sm:p-5 border border-emerald-500/30 bg-gradient-to-r from-emerald-950/80 via-slate-900/90 to-teal-950/80 shadow-2xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <Bot className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-black text-white text-base">{t('ai.title', undefined, 'AgriGuard AI Assistant')}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {t('ai.groundedRag', undefined, 'Grounded RAG')}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {t('ai.bannerPrompt', undefined, 'Ask about rice blast, fertilizer splits, organic IPM, or irrigation schedules tailored to your plot.')}
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('ai-assistant')}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold text-xs hover:from-emerald-400 hover:to-teal-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>{t('ai.chatWithAI', undefined, 'Chat with AI')}</span>
        </button>
      </div>

      {/* 3 Stat Cards — Rebalanced 3-column layout */}
      <div className="dashboard-stats-grid dashboard-stats-3-col stagger-children" role="region" aria-label="Key Agricultural Statistics">
        {statCards.map((card) => {
          const Icon = card.icon;
          const spokenSentence = formatStatSentence(card.key, card.label, card.value, language);
          return (
            <div
              key={card.key}
              tabIndex={0}
              role="group"
              aria-label={spokenSentence}
              data-stat-label={card.key}
              data-stat-value={card.value}
              data-stat-raw-label={card.label}
              data-read-aloud-text={spokenSentence}
              className={`stat-card ${card.border} animate-fade-in-up cursor-pointer`}
            >
              <div className={`stat-card-icon ${card.color}`}>
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
              <div className="min-w-0 text-left">
                <div className="text-[11px] text-emerald-300/80 font-bold truncate">{card.label}</div>
                <div className="text-2xl font-black text-white">{card.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Farm Overview Map + Quick Actions Grid */}
      <div className="dashboard-main-grid">
        {/* Your Farm Overview Map Card */}
        <div className="glass-card p-4 space-y-3 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">{t('dashboard.farmOverview', undefined, 'Your Farm Overview')}</h3>
              {selectedFarm && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {selectedFarm.name}
                </span>
              )}
            </div>
            <button
              onClick={() => onNavigate('satellite')}
              className="text-xs text-emerald-400 font-bold hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition"
            >
              {t('dashboard.viewSatellite', undefined, 'Satellite View')} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="map-container flex-1 min-h-[260px] rounded-xl overflow-hidden border border-emerald-500/20">
            <FarmMiniMap
              farms={farms}
              selectedFarm={selectedFarm}
              onAddFarm={canAddFarm ? openAddFarmModal : undefined}
            />
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="glass-card p-4 space-y-3 flex flex-col justify-between">
          <div className="text-left">
            <h3 className="text-sm font-bold text-white">{t('dashboard.quickActions', undefined, 'Quick Actions')}</h3>
            <p className="text-[11px] text-emerald-300/70 mt-0.5">{t('dashboard.quickActionsSubtitle', undefined, 'Key diagnostic and agricultural management tools')}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 flex-1">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => onNavigate(action.screen)}
                  className="glass-card p-3 flex flex-col items-center justify-center text-center gap-2 hover:border-emerald-400/50 hover:bg-emerald-900/30 transition-all cursor-pointer group border border-emerald-500/20"
                >
                  <div className={`w-10 h-10 rounded-xl ${action.color} border border-emerald-400/30 flex items-center justify-center group-hover:scale-105 transition shadow-[0_0_12px_rgba(16,185,129,0.2)]`}>
                    <Icon className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                      {action.label}
                    </div>
                    <div className="text-[10px] text-emerald-300/60 font-medium mt-0.5 line-clamp-1">
                      {action.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

// Mini Map with Selected Farm Focusing and Empty State
const FarmMiniMap: React.FC<{
  farms: Farm[];
  selectedFarm: Farm | null;
  onAddFarm?: () => void;
}> = ({ farms, selectedFarm, onAddFarm }) => {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const mapInstance = React.useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    if (farms.length === 0) return;

    const defaultCenter: [number, number] = [17.7265, 78.2916];
    const targetFarm = selectedFarm || farms.find((f) => f.latitude && f.longitude);
    const center: [number, number] = targetFarm && targetFarm.latitude && targetFarm.longitude
      ? [targetFarm.latitude, targetFarm.longitude]
      : defaultCenter;

    const map = L.map(mapRef.current, {
      center,
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
    }).addTo(map);

    const boundsGroup = L.featureGroup();

    farms.forEach((farm) => {
      const isCurrent = selectedFarm?.id === farm.id;
      const farmCenter: [number, number] = [
        farm.latitude || defaultCenter[0],
        farm.longitude || defaultCenter[1],
      ];

      if (farm.boundary_geojson) {
        try {
          const geoLayer = L.geoJSON(farm.boundary_geojson, {
            style: {
              color: isCurrent ? '#34d399' : '#10b981',
              weight: isCurrent ? 3.5 : 2.0,
              fillColor: isCurrent ? '#34d399' : '#10b981',
              fillOpacity: isCurrent ? 0.35 : 0.2,
            },
          }).addTo(map);
          boundsGroup.addLayer(geoLayer);
        } catch {}
      }

      // Add real marker pin for each farm
      const areaLabel = farm.area_hectares ? `${farm.area_hectares.toFixed(1)} ha` : (farm.crop_type || 'Field');
      const icon = L.divIcon({
        html: `
          <div class="flex flex-col items-center select-none" style="transform: translate(-50%, -100%);">
            <div class="px-2 py-0.5 rounded-lg ${
              isCurrent
                ? 'bg-emerald-900 border-2 border-emerald-300 text-white shadow-[0_0_15px_rgba(52,211,153,0.8)] scale-105'
                : 'bg-emerald-950/90 border border-emerald-400 text-emerald-300'
            } font-extrabold text-[10px] shadow-[0_4px_12px_rgba(0,0,0,0.7)] whitespace-nowrap flex flex-col items-center leading-tight transition-transform">
              <span class="${isCurrent ? 'text-white font-black' : 'text-emerald-100'}">${farm.name}</span>
              <span class="text-[9px] ${isCurrent ? 'text-emerald-300' : 'text-emerald-400'}">${areaLabel}</span>
            </div>
            <div class="w-2.5 h-2.5 ${isCurrent ? 'bg-emerald-300' : 'bg-emerald-400'} rotate-45 border border-emerald-950 -mt-1 shadow"></div>
          </div>
        `,
        className: '',
        iconSize: [0, 0],
      });

      const marker = L.marker(farmCenter, { icon }).addTo(map);
      boundsGroup.addLayer(marker);
    });

    if (selectedFarm?.latitude && selectedFarm?.longitude) {
      map.flyTo([selectedFarm.latitude, selectedFarm.longitude], 15, { duration: 1.0 });
    } else if (boundsGroup.getLayers().length > 0) {
      map.fitBounds(boundsGroup.getBounds(), { padding: [30, 30], maxZoom: 16 });
    }

    mapInstance.current = map;

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [farms, selectedFarm?.id]);

  const { t } = useLanguage();
  if (farms.length === 0) {
    return (
      <div className="w-full h-full min-h-[260px] flex flex-col items-center justify-center p-6 text-center bg-[#05231a]/80 space-y-3">
        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-md">
          <Sprout className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-black text-white font-heading">{t('farmer.noFarms', undefined, 'No Farms Registered Yet')}</p>
          <p className="text-xs text-emerald-300/70 mt-0.5 max-w-xs leading-relaxed">
            {t('farmer.noFarmsSubtitle', undefined, 'Outline your field boundaries to see your land and activate NDVI tracking.')}
          </p>
        </div>
        {onAddFarm && (
          <button
            type="button"
            onClick={onAddFarm}
            className="btn-primary py-2 px-4 text-xs font-bold inline-flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{t('farmer.addFarm', undefined, 'Add Your First Farm')}</span>
          </button>
        )}
      </div>
    );
  }

  return <div ref={mapRef} className="w-full h-full" />;
};

