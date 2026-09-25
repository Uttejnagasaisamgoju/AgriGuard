import React, { useEffect, useState } from 'react';
import { ArrowLeft, Search, ChevronRight, RefreshCw, ImageOff, AlertCircle } from 'lucide-react';
import { diseaseApi } from '../services/api';
import type { Disease } from '../types';
import { getDiseaseReferenceImage, BASE_REFERENCE_DISEASES } from '../utils/diseaseImages';
import { useLanguage } from '../context/LanguageContext';
import {
  getLocalizedDisease,
  matchesDiseaseSearch,
  CROP_LOCALIZATIONS,
} from '../utils/diseaseTranslations';
import { LanguageSelector } from './LanguageSelector';

interface DiseaseLibraryViewProps {
  onBack: () => void;
  onNavigate: (screen: string) => void;
}

const CROP_FILTER_KEYS = [
  'all crops',
  'rice',
  'wheat',
  'maize',
  'tomato',
  'potato',
  'cucumber',
  'cotton',
];

const DiseaseCardImage: React.FC<{ src?: string | null; alt: string; noImageText?: string; noImageTitle?: string }> = ({
  src,
  alt,
  noImageText,
  noImageTitle,
}) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div 
        className="w-full h-full flex flex-col items-center justify-center p-1 text-center bg-emerald-950/80" 
        title={noImageTitle || 'No reference image available for this disease yet'}
      >
        <ImageOff className="w-4 h-4 text-amber-400/80 mb-0.5" />
        <span className="text-[7.5px] text-amber-300/90 font-bold leading-tight">{noImageText || 'No image'}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover"
      onError={() => setHasError(true)}
    />
  );
};

export const DiseaseLibraryView: React.FC<DiseaseLibraryViewProps> = ({ onBack, onNavigate }) => {
  const { t, language } = useLanguage();
  const [selectedCrop, setSelectedCrop] = useState('all crops');
  const [search, setSearch] = useState('');
  const [diseases, setDiseases] = useState(BASE_REFERENCE_DISEASES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDiseasesFromBackend();
  }, []);

  const loadDiseasesFromBackend = async () => {
    setLoading(true);
    try {
      const res = await diseaseApi.getDiseases();
      if (res && res.diseases && res.diseases.length > 0) {
        const mapped = res.diseases.map((d: Disease) => {
          const img =
            (d.reference_images && d.reference_images.length > 0 && d.reference_images[0])
              ? d.reference_images[0]
              : getDiseaseReferenceImage(d.name, d.crop_type) || null;

          const symptomsList = d.symptoms
            ? d.symptoms.split('. ').filter(Boolean).map(s => s.endsWith('.') ? s : s + '.')
            : ['Foliar symptoms visible on leaf surface.'];

          const managementList = d.management
            ? d.management.split('. ').filter(Boolean).map(m => m.endsWith('.') ? m : m + '.')
            : d.treatment
            ? [d.treatment]
            : ['Apply recommended agricultural treatment.'];

          return {
            id: d.id,
            name: d.name,
            crop_type: d.crop_type,
            category: (d.category || 'Fungal').charAt(0).toUpperCase() + (d.category || 'Fungal').slice(1),
            image: img,
            symptoms: symptomsList,
            causes: d.causes || 'Crop pathology pathogen.',
            management: managementList,
          };
        });

        const combined = [...mapped];
        BASE_REFERENCE_DISEASES.forEach((base) => {
          if (!combined.some((c) => c.name.toLowerCase() === base.name.toLowerCase() && c.crop_type.toLowerCase() === base.crop_type.toLowerCase())) {
            combined.push(base);
          }
        });

        setDiseases(combined);
      }
    } catch (e) {
      console.warn('Using local dedicated disease registry:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredDiseases = diseases.filter((d) => {
    const cropMatch =
      selectedCrop === 'all crops' ||
      d.crop_type.toLowerCase().includes(selectedCrop.toLowerCase()) ||
      d.crop_type.toLowerCase().includes('multiple');

    const searchMatch = matchesDiseaseSearch(d, search, language);

    return cropMatch && searchMatch;
  });

  const categoryBadgeClass = (category: string) => {
    switch (category.toLowerCase()) {
      case 'fungal':
        return 'bg-red-500/20 text-red-400 border border-red-500/35';
      case 'bacterial':
        return 'bg-amber-500/20 text-amber-300 border border-amber-500/35';
      case 'pest':
      case 'insect':
        return 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/35';
      case 'viral':
        return 'bg-purple-500/20 text-purple-300 border border-purple-500/35';
      default:
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/35';
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} aria-label={t('common.back', undefined, 'Back')} className="lg:hidden p-2 rounded-xl hover:bg-emerald-900/30 transition">
            <ArrowLeft className="w-5 h-5 text-emerald-300" />
          </button>
          <div>
            <h1 className="text-xl font-black text-white font-heading">
              {t('library.title', undefined, 'Disease & Pest Library')}
            </h1>
            <p className="text-emerald-300/70 text-xs mt-0.5">
              {t('library.botanicalDatabaseSubtitle', undefined, 'Botanical pathology database with dedicated symptomatic photography')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelector variant="compact" />
          <button
            onClick={loadDiseasesFromBackend}
            disabled={loading}
            aria-label={t('library.refreshLibrary', undefined, 'Refresh Library')}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('library.refreshLibrary', undefined, 'Refresh Library')}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {CROP_FILTER_KEYS.map((cropKey) => {
          const isActive = selectedCrop === cropKey;
          const label = CROP_LOCALIZATIONS[cropKey]?.[language] || CROP_LOCALIZATIONS[cropKey]?.en || cropKey;
          return (
            <button
              key={cropKey}
              onClick={() => setSelectedCrop(cropKey)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-500 text-emerald-950 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                  : 'glass-card border border-emerald-500/20 text-emerald-300/80 hover:text-white hover:border-emerald-400/40'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/60" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('library.searchPlaceholder', undefined, 'Search disease name, crop, or pathogen category...')}
          className="glass-input pl-11 text-xs py-2.5 font-medium border border-emerald-500/25"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
        {filteredDiseases.length === 0 ? (
          <div className="col-span-full p-8 text-center text-emerald-300/50 text-xs space-y-2 glass-card">
            <AlertCircle className="w-8 h-8 text-emerald-500/40 mx-auto" />
            <p>{t('library.noDiseasesFound', { query: search }, `No diseases found matching "${search}".`)}</p>
          </div>
        ) : (
          filteredDiseases.map((d) => {
            const loc = getLocalizedDisease(d.name, d.crop_type, language, d.id);
            return (
              <button
                key={`${d.id}-${d.name}`}
                onClick={() => onNavigate(`disease-library/${d.id}`)}
                aria-label={`${loc.displayName}, ${loc.displayCrop}, ${loc.displayCategory}. ${t('library.viewDetails', undefined, 'View Details')}`}
                className="w-full glass-card p-3 rounded-xl flex items-center gap-3 transition-all text-left cursor-pointer hover:bg-emerald-900/30 border border-emerald-500/20 hover:border-emerald-400/50"
              >
                <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-emerald-500/30 bg-emerald-950 relative flex items-center justify-center">
                  <DiseaseCardImage
                    src={d.image}
                    alt={`${loc.displayName} (${loc.displayCrop})`}
                    noImageText={t('common.none', undefined, 'No image')}
                    noImageTitle={t('library.noRefImageAvailable', undefined, 'No reference image available for this disease yet')}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-white truncate">
                    {loc.displayName}
                  </div>
                  <div className="text-xs text-emerald-300/80 truncate mb-1.5">{loc.displayCrop}</div>
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full inline-block ${categoryBadgeClass(d.category)}`}>
                    {loc.displayCategory}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-emerald-400/50 flex-shrink-0" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

