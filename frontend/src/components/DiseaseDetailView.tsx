import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle2, ImageOff, Share2, Bookmark, MessageSquare, Loader2 } from 'lucide-react';
import type { Disease } from '../types';
import { getDiseaseReferenceImage, BASE_REFERENCE_DISEASES } from '../utils/diseaseImages';
import { diseaseApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { getLocalizedDisease } from '../utils/diseaseTranslations';
import { LanguageSelector } from './LanguageSelector';

interface DiseaseDetailViewProps {
  disease?: any;
  diseaseId?: string;
  onBack: () => void;
  onConsultExpert?: () => void;
}

export const DiseaseDetailView: React.FC<DiseaseDetailViewProps> = ({ disease: initialDisease, diseaseId, onBack, onConsultExpert }) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'symptoms' | 'causes' | 'management'>('overview');
  const [diseaseData, setDiseaseData] = useState<any>(initialDisease || null);
  const [loading, setLoading] = useState<boolean>(!initialDisease && !!diseaseId);
  const [imgError, setImgError] = useState<boolean>(false);

  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Trigger tab switch if horizontal swipe is dominant and exceeds 50px
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      const tabs: Array<'overview' | 'symptoms' | 'causes' | 'management'> = [
        'overview',
        'symptoms',
        'causes',
        'management',
      ];
      const currentIndex = tabs.indexOf(activeTab);
      if (deltaX < 0 && currentIndex < tabs.length - 1) {
        setActiveTab(tabs[currentIndex + 1]);
      } else if (deltaX > 0 && currentIndex > 0) {
        setActiveTab(tabs[currentIndex - 1]);
      }
    }
  };

  const getTabLabel = (tab: 'overview' | 'symptoms' | 'causes' | 'management') => {
    switch (tab) {
      case 'overview':
        return t('library.tabOverview', undefined, 'Overview');
      case 'symptoms':
        return t('library.tabSymptoms', undefined, 'Symptoms');
      case 'causes':
        return t('library.tabCauses', undefined, 'Causes');
      case 'management':
        return t('library.tabManagement', undefined, 'Management');
    }
  };

  useEffect(() => {
    // If disease was passed and is not a stub, use it
    if (initialDisease && initialDisease.crop_type && initialDisease.crop_type !== 'Unknown') {
      setDiseaseData(initialDisease);
      setLoading(false);
      return;
    }

    const targetId = diseaseId || initialDisease?.id;
    if (!targetId) return;

    // 1. Try matching base registry by ID or slug
    const localMatch = BASE_REFERENCE_DISEASES.find(
      (b) => b.id.toLowerCase() === targetId.toLowerCase() || b.name.toLowerCase().replace(/\s+/g, '-') === targetId.toLowerCase()
    );

    if (localMatch) {
      setDiseaseData(localMatch);
      setLoading(false);
      return;
    }

    // 2. Fetch from backend API
    setLoading(true);
    diseaseApi
      .getDiseaseById(targetId)
      .then((d: Disease) => {
        if (d) {
          const img =
            d.reference_images && d.reference_images.length > 0 && d.reference_images[0]
              ? d.reference_images[0]
              : getDiseaseReferenceImage(d.name, d.crop_type) || null;

          const symptomsList = d.symptoms
            ? (Array.isArray(d.symptoms) ? d.symptoms : d.symptoms.split('. ').filter(Boolean).map(s => s.endsWith('.') ? s : s + '.'))
            : ['Foliar symptoms visible on leaf surface.'];

          const managementList = d.management
            ? (Array.isArray(d.management) ? d.management : d.management.split('. ').filter(Boolean).map(m => m.endsWith('.') ? m : m + '.'))
            : d.treatment
            ? [d.treatment]
            : ['Apply recommended agricultural treatment.'];

          setDiseaseData({
            id: d.id,
            name: d.name,
            crop_type: d.crop_type,
            category: (d.category || 'Fungal').charAt(0).toUpperCase() + (d.category || 'Fungal').slice(1),
            image: img,
            symptoms: symptomsList,
            causes: d.causes || 'Crop pathology pathogen.',
            management: managementList,
          });
        }
      })
      .catch((err) => {
        console.warn('Could not load disease from API, checking name match:', err);
        // Fallback search in BASE_REFERENCE_DISEASES by partial name
        const partial = BASE_REFERENCE_DISEASES.find((b) => targetId.toLowerCase().includes(b.id.toLowerCase()));
        if (partial) {
          setDiseaseData(partial);
        }
      })
      .finally(() => setLoading(false));
  }, [diseaseId, initialDisease]);

  const categoryBadgeClass = (category: string = 'Fungal') => {
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

  if (loading) {
    return (
      <div className="glass-card p-12 text-center flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-xs text-emerald-300/80 font-bold">{t('library.loadingProfile', undefined, 'Loading disease pathology profile...')}</p>
      </div>
    );
  }

  if (!diseaseData) {
    return (
      <div className="glass-card p-8 text-center space-y-3">
        <p className="text-sm text-emerald-300">{t('library.profileNotFound', undefined, 'Disease profile not found.')}</p>
        <button onClick={onBack} className="btn-secondary text-xs px-4 py-2">{t('library.returnToLibrary', undefined, 'Return to Library')}</button>
      </div>
    );
  }

  const resolvedImage = !imgError
    ? (diseaseData.image || getDiseaseReferenceImage(diseaseData.name, diseaseData.crop_type, diseaseData.reference_images) || null)
    : null;

  const loc = getLocalizedDisease(diseaseData.name, diseaseData.crop_type, language, diseaseData.id);
  const displayName = loc?.displayName || diseaseData.name;
  const displayCrop = loc?.displayCrop || diseaseData.crop_type;
  const displayCategory = loc?.displayCategory || diseaseData.category;
  const displaySymptoms = loc && loc.symptoms.length > 0 ? loc.symptoms : (diseaseData.symptoms || []);
  const displayCauses = loc && loc.causes ? loc.causes : (diseaseData.causes || 'Pathogen details documented in botanical pathology registry.');
  const displayManagement = loc && loc.management.length > 0 ? loc.management : (diseaseData.management || []);

  return (
    <div className="space-y-4 animate-fade-in-up pb-6">
      {/* Sticky Top Header Bar */}
      <div className="sticky top-0 z-30 -mt-2 py-3 bg-[#031c15]/95 backdrop-blur-xl border-b border-emerald-500/20 -mx-3 sm:-mx-6 px-3 sm:px-6 flex items-center justify-between shadow-lg">
        <button
          onClick={onBack}
          aria-label={t('common.back', undefined, 'Back')}
          className="p-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-500/20 transition text-emerald-300 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <LanguageSelector variant="compact" />
          <button
            aria-label={t('common.share', undefined, 'Share')}
            className="p-2 rounded-xl glass-card text-emerald-300 hover:text-white transition cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            aria-label={t('common.details', undefined, 'Bookmark')}
            className="p-2 rounded-xl glass-card text-emerald-300 hover:text-white transition cursor-pointer"
          >
            <Bookmark className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="glass-card p-5 space-y-5 border border-emerald-500/20">
        {/* Title & Badge */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-0.5">
            <h1 className="text-xl font-black text-white font-heading">
              {displayName} ({displayCrop})
            </h1>
            {loc?.scientificName && (
              <p className="text-xs text-emerald-400/90 italic font-mono">
                {loc.scientificName}
              </p>
            )}
          </div>
          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${categoryBadgeClass(diseaseData.category)}`}>
            {displayCategory}
          </span>
        </div>

        {/* Large Reference Image */}
        <div className="w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-emerald-500/30 shadow-lg relative bg-emerald-950 flex items-center justify-center">
          {resolvedImage ? (
            <>
              <img
                src={resolvedImage}
                alt={displayName}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
              <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] text-emerald-300 font-bold border border-emerald-500/30">
                {t('library.botanicalRefStandard', undefined, 'Botanical Pathology Standard Reference')}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-emerald-400/50 text-xs text-center p-6">
              <ImageOff className="w-10 h-10 text-amber-400/70 mb-1" />
              <span className="font-bold text-amber-300/90 text-sm">{t('library.noRefImageAvailable', undefined, 'No reference image available for this disease yet')}</span>
              <span className="text-[11px] text-emerald-300/60 max-w-xs leading-relaxed">
                {t('library.verifyingPhotography', undefined, 'Our botanical pathology team is verifying authentic field photography for this pathology.')}
              </span>
            </div>
          )}
        </div>

        {/* Tabs - Real horizontal swipeable tab bar */}
        <div className="flex border-b border-emerald-500/20 overflow-x-auto touch-pan-x scrollbar-hide gap-1">
          {(['overview', 'symptoms', 'causes', 'management'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                activeTab === tab 
                  ? 'border-emerald-400 text-emerald-300' 
                  : 'border-transparent text-emerald-300/60 hover:text-emerald-200'
              }`}
            >
              {getTabLabel(tab)}
            </button>
          ))}
        </div>

        {/* Tab Content with Real Touch Swipe Gesture Support */}
        <div
          className="min-h-[150px] touch-pan-y select-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm text-emerald-100/90 leading-relaxed">
                {loc ? `${displayName} (${displayCrop}) - ${displayCauses}` : `${diseaseData.name} (${diseaseData.crop_type})`}
              </p>
              {displayCauses && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-200/80">
                  <span className="font-bold text-emerald-300">{t('library.quickFact', undefined, 'Quick Fact')}: </span>
                  {displayCauses.split('.')[0]}.
                </div>
              )}
            </div>
          )}

          {activeTab === 'symptoms' && (
            <div className="space-y-3 animate-fade-in">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">{t('library.observedSymptoms', undefined, 'Observed Symptoms')}</h3>
              <ul className="space-y-2 text-sm text-emerald-100/90">
                {displaySymptoms.map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'causes' && (
            <div className="space-y-3 animate-fade-in">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">{t('library.pathogenCauses', undefined, 'Pathogen & Etiology')}</h3>
              <p className="text-sm text-emerald-100/90 leading-relaxed p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/10">
                {displayCauses}
              </p>
            </div>
          )}

          {activeTab === 'management' && (
            <div className="space-y-3 animate-fade-in">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">{t('library.controlTreatment', undefined, 'Agronomic Control & Treatment')}</h3>
              <ul className="space-y-2.5 text-sm text-emerald-100/90">
                {displayManagement.map((m: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/10">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="pt-0.5">{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Call to Action */}
        <div className="pt-4 border-t border-emerald-500/20">
          <button 
            onClick={onConsultExpert}
            className="w-full btn-primary py-3 flex items-center justify-center gap-2 text-sm font-bold shadow-[0_0_20px_rgba(16,185,129,0.25)]"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{t('library.consultExpertAbout', undefined, 'Consult Expert About This Disease')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
