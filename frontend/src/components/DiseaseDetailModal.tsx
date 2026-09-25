import React, { useState } from 'react';
import { X, CheckCircle2, Bookmark, BookmarkCheck, AlertTriangle, ImageOff } from 'lucide-react';
import { Disease } from '../types';
import { getDiseaseReferenceImage } from '../utils/diseaseImages';

interface DiseaseDetailModalProps {
  disease: Disease | null;
  onClose: () => void;
}

export const DiseaseDetailModal: React.FC<DiseaseDetailModalProps> = ({ disease, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'symptoms' | 'causes' | 'management'>('overview');
  const [isSaved, setIsSaved] = useState(false);

  if (!disease) return null;

  const refImage = getDiseaseReferenceImage(disease.name, disease.crop_type, disease.reference_images);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-md max-h-[92vh] overflow-y-auto flex flex-col p-4 border-emerald-500/30 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 hover:text-white flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Hero Leaf Image */}
        <div className="w-full h-44 rounded-2xl overflow-hidden relative mb-3 border border-emerald-500/30 bg-emerald-950 flex items-center justify-center">
          {refImage ? (
            <img
              src={refImage}
              alt={disease.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5 text-emerald-400/50 text-xs">
              <ImageOff className="w-7 h-7" />
              <span>No reference image available</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-3 left-3">
            <span className={`badge-risk-${disease.risk_level} font-bold`}>
              {disease.risk_level} Risk
            </span>
          </div>
        </div>

        {/* Title and Category */}
        <div className="mb-3">
          <h3 className="text-xl font-bold text-white font-heading">{disease.name}</h3>
          <p className="text-xs text-emerald-300/80 font-medium italic">
            {disease.scientific_name || 'Cochliobolus oryzae'} • {disease.category} pathogen
          </p>
        </div>

        {/* 4 Tabs (Screen 12 from reference image) */}
        <div className="flex border-b border-emerald-500/20 mb-3 text-xs font-bold">
          {(['overview', 'symptoms', 'causes', 'management'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 pb-2 text-center capitalize transition border-b-2 ${
                activeTab === tab
                  ? 'border-emerald-400 text-emerald-300 font-extrabold'
                  : 'border-transparent text-emerald-400/50 hover:text-emerald-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 text-xs text-emerald-100/90 space-y-2 mb-4">
          {activeTab === 'overview' && (
            <div>
              <p className="leading-relaxed">
                {disease.name} is a serious {disease.category} disorder impacting {disease.crop_type} crop yields.
                It produces distinctive lesions that inhibit chlorophyll synthesis, leading to leaf chlorosis, poor
                photosynthesis, and substantial grain loss if unchecked.
              </p>
            </div>
          )}

          {activeTab === 'symptoms' && (
            <ul className="space-y-1.5 list-disc pl-4 text-emerald-200/90 leading-relaxed">
              <li>Circular to oval brownish lesions with grey or whitish centers on leaf blades.</li>
              <li>Yellow chlorotic halo appearing around primary spots.</li>
              <li>Blackish-brown discolorations on glumes and seeds reducing grain quality.</li>
              <li>Premature drying and withering of heavily infected leaves.</li>
            </ul>
          )}

          {activeTab === 'causes' && (
            <ul className="space-y-1.5 list-disc pl-4 text-emerald-200/90 leading-relaxed">
              <li>High relative humidity (&gt;85%) combined with warm ambient temperatures (25-30°C).</li>
              <li>Nutrient deficient soil, particularly silicon and potassium deficiencies.</li>
              <li>Water stress or erratic irrigation causing host tissue weakness.</li>
              <li>Infected seed stock transmitting fungal spores during seedling growth.</li>
            </ul>
          )}

          {activeTab === 'management' && (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Apply recommended fungicide (e.g. Mancozeb, Tricyclazole, or Propiconazole).</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Maintain balanced soil nutrition with supplementary potassium and silicon fertilizers.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Ensure proper spacing between crops to allow optimal sun penetration and air circulation.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>Treat seeds prior to sowing with carbendazim or bio-control Trichoderma agents.</span>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={() => setIsSaved(!isSaved)}
          className={`w-full py-3 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition ${
            isSaved
              ? 'bg-emerald-600 text-white'
              : 'btn-primary'
          }`}
        >
          {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
          <span>{isSaved ? 'Saved in My Library' : 'Save to Library'}</span>
        </button>
      </div>
    </div>
  );
};
