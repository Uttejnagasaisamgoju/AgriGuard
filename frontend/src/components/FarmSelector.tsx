import React, { useState, useRef, useEffect } from 'react';
import { Sprout, ChevronDown, Check, Plus, Search, MapPin, Layers } from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Farm } from '../types';

interface FarmSelectorProps {
  className?: string;
  compact?: boolean;
  onFarmChange?: (farm: Farm) => void;
}

export const FarmSelector: React.FC<FarmSelectorProps> = ({
  className = '',
  compact = false,
  onFarmChange,
}) => {
  const { user } = useAuth();
  const { t, formatNumber } = useLanguage();
  const {
    farms,
    selectedFarm,
    selectFarm,
    loadingFarms,
    openAddFarmModal,
  } = useFarm();

  const role = (user?.role || '').toUpperCase();
  const canAddFarm = role === 'FARMER' || role === 'ADMIN';

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (farm: Farm) => {
    selectFarm(farm);
    onFarmChange?.(farm);
    setIsOpen(false);
    setSearchQuery('');
  };

  // ── Scenario 1: Zero Farms ────────────────────────────────────────────────
  if (!loadingFarms && farms.length === 0) {
    if (!canAddFarm) {
      return (
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/20 text-emerald-300/80 font-bold text-xs select-none ${className}`}
          title={t('farm.noFarmsAvailable', undefined, 'No Farms Available')}
        >
          <Sprout className="w-3.5 h-3.5 text-emerald-400/60" />
          <span>{t('farm.noFarmsAvailable', undefined, 'No Farms Available')}</span>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={openAddFarmModal}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-emerald-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer select-none ${className}`}
        title={t('farm.addFirstFarm', undefined, 'Add Your First Farm')}
      >
        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>{t('farm.addFirstFarm', undefined, 'Add Your First Farm')}</span>
      </button>
    );
  }

  // ── Scenario 2: Exactly One Farm ──────────────────────────────────────────
  if (farms.length === 1 && selectedFarm) {
    const areaStr = selectedFarm.area_hectares
      ? `${formatNumber(Number(selectedFarm.area_hectares.toFixed(1)))} ${t('farm.hectaresUnit', undefined, 'ha')}`
      : t('farm.farmDetails', undefined, 'Field');
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-white select-none backdrop-blur-md shadow-sm ${className}`}
        title={`${selectedFarm.name} (${areaStr} • ${selectedFarm.crop_type || ''})`}
      >
        <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
          <Sprout className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-extrabold text-white truncate max-w-[130px] sm:max-w-[180px]">
            {selectedFarm.name}
          </span>
          <span className="text-[11px] font-semibold text-emerald-300/80">
            ({areaStr}{selectedFarm.crop_type ? ` • ${selectedFarm.crop_type}` : ''})
          </span>
        </div>
      </div>
    );
  }

  // ── Scenario 3: Multiple Farms (Dropdown with Search & Selection) ─────────
  const filteredFarms = farms.filter((f) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      f.name.toLowerCase().includes(q) ||
      (f.crop_type && f.crop_type.toLowerCase().includes(q)) ||
      (f.district && f.district.toLowerCase().includes(q)) ||
      (f.village && f.village.toLowerCase().includes(q))
    );
  });

  const displayTitle = selectedFarm ? selectedFarm.name : t('farm.selectFarm', undefined, 'Select Farm');

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left select-none ${className}`}>
      {/* Selector Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900/60 border border-emerald-500/30 hover:border-emerald-400/50 text-white text-xs transition shadow-sm backdrop-blur-md cursor-pointer group"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
          <Sprout className="w-3.5 h-3.5" />
        </div>

        <div className="text-left min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-white truncate max-w-[120px] sm:max-w-[160px]">
              {displayTitle}
            </span>
            {selectedFarm?.area_hectares !== undefined && (
              <span className="text-[11px] font-semibold text-emerald-300/80 shrink-0">
                ({formatNumber(Number(selectedFarm.area_hectares.toFixed(1)))} {t('farm.hectaresUnit', undefined, 'ha')})
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-emerald-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl bg-[#06241b]/95 border border-emerald-500/40 shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl z-50 overflow-hidden animate-fade-in divide-y divide-emerald-500/15">
          {/* Header & Search */}
          <div className="p-3 space-y-2 bg-emerald-950/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-emerald-300 uppercase tracking-wider">
                {t('farm.switchFarmField', undefined, 'Switch Farm Field')}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {farms.length === 1
                  ? t('farm.farmCountSingle', undefined, '1 Farm')
                  : t('farm.farmCountMultiple', { count: farms.length }, `${farms.length} Farms`)}
              </span>
            </div>

            {/* Search Input when 3 or more farms */}
            {farms.length >= 3 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-emerald-400/70 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('farm.searchPlaceholder', undefined, 'Search by name, crop, district...')}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-emerald-900/40 border border-emerald-500/30 text-white placeholder-emerald-400/50 text-xs outline-none focus:border-emerald-400 transition"
                />
              </div>
            )}
          </div>

          {/* Farms List */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1 divide-y-0">
            {filteredFarms.length > 0 ? (
              filteredFarms.map((farm) => {
                const isSelected = selectedFarm?.id === farm.id;
                return (
                  <button
                    key={farm.id}
                    type="button"
                    onClick={() => handleSelect(farm)}
                    className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition cursor-pointer group ${
                      isSelected
                        ? 'bg-emerald-500/20 border border-emerald-400/40 shadow-sm'
                        : 'hover:bg-emerald-900/30 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-emerald-500 text-emerald-950 border-emerald-400 font-bold'
                            : 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30 group-hover:border-emerald-400/50'
                        }`}
                      >
                        <Sprout className="w-4 h-4" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition">
                            {farm.name}
                          </span>
                          {farm.crop_type && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 shrink-0">
                              {farm.crop_type}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-emerald-300/70 mt-0.5">
                          <span className="font-semibold text-emerald-200">
                            {farm.area_hectares ? `${formatNumber(Number(farm.area_hectares.toFixed(1)))} ${t('farm.hectaresUnit', undefined, 'ha')}` : '—'}
                          </span>
                          {farm.district && (
                            <span className="flex items-center gap-0.5 truncate">
                              <MapPin className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                              {farm.district}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center text-emerald-950 shrink-0 shadow-sm">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-xs text-emerald-300/60">
                {t('farm.noFarmsFound', { query: searchQuery }, `No farms found matching "${searchQuery}"`)}
              </div>
            )}
          </div>

          {/* Footer with Add New Farm Button (Farmer / Admin only) */}
          {canAddFarm && (
            <div className="p-2 bg-emerald-950/40">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  openAddFarmModal();
                }}
                className="w-full py-2 px-3 rounded-xl bg-emerald-900/30 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{t('farm.defineAddNewFarm', undefined, 'Define & Add New Farm')}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
