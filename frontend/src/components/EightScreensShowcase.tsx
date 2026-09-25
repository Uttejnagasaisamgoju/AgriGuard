import React from 'react';
import { Leaf, Sparkles } from 'lucide-react';
import { LoginView } from './LoginView';
import { HomeDashboardView } from './HomeDashboardView';
import { SatelliteMapView } from './SatelliteMapView';
import { DiseaseDetectionView } from './DiseaseDetectionView';
import { DiseaseLibraryView } from './DiseaseLibraryView';
import { ExpertChatView } from './ExpertChatView';
import { OfficerDashboardView } from './OfficerDashboardView';
import { SettingsView } from './SettingsView';

interface EightScreensShowcaseProps {
  onNavigateToScreen: (screenId: string) => void;
}

export const EightScreensShowcase: React.FC<EightScreensShowcaseProps> = ({ onNavigateToScreen }) => {
  return (
    <div className="w-full space-y-6 pb-12">
      {/* Top Banner explaining the 8-Screen Visual Grid matching reference image */}
      <div className="glass-panel px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-emerald-500/30">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <span className="text-xs font-bold text-white">Reference Image 8-Screen Live Grid</span>
            <p className="text-[10px] text-emerald-300/70">
              Screens A–H matching the provided specification. Click any screen to focus or interact live!
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Live Connected to FastAPI Backend & ML</span>
        </div>
      </div>

      {/* TOP ROW: Screens A, B, C */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Screen A: LOGIN (Matches top-left) */}
        <div className="xl:col-span-3">
          <div className="text-[11px] font-bold text-emerald-400/80 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Screen A • Login</span>
            <button 
              onClick={() => onNavigateToScreen('login')}
              className="hover:underline text-[10px] text-emerald-300"
            >
              Expand ↗
            </button>
          </div>
          <div className="rounded-2xl overflow-hidden border border-emerald-500/25 shadow-2xl bg-emerald-950/20 backdrop-blur-md">
            <LoginView onSuccess={() => onNavigateToScreen('home')} />
          </div>
        </div>

        {/* Screen B: HOME DASHBOARD (Matches top-middle) */}
        <div className="xl:col-span-5">
          <div className="text-[11px] font-bold text-emerald-400/80 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Screen B • Home Dashboard</span>
            <button 
              onClick={() => onNavigateToScreen('home')}
              className="hover:underline text-[10px] text-emerald-300"
            >
              Expand ↗
            </button>
          </div>
          <div className="rounded-2xl overflow-hidden border border-emerald-500/25 shadow-2xl bg-emerald-950/20 backdrop-blur-md p-3">
            <HomeDashboardView onNavigate={(screen) => onNavigateToScreen(screen)} />
          </div>
        </div>

        {/* Screen C: SATELLITE VIEW & LAND AREA (Matches top-right) */}
        <div className="xl:col-span-4">
          <div className="text-[11px] font-bold text-emerald-400/80 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Screen C • Satellite View & Land Area</span>
            <button 
              onClick={() => onNavigateToScreen('satellite')}
              className="hover:underline text-[10px] text-emerald-300"
            >
              Expand ↗
            </button>
          </div>
          <div className="rounded-2xl overflow-hidden border border-emerald-500/25 shadow-2xl bg-emerald-950/20 backdrop-blur-md p-3">
            <SatelliteMapView 
              onBack={() => onNavigateToScreen('home')} 
              onViewDetails={() => onNavigateToScreen('disease-library')} 
            />
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: Screens D, E, F, G, H */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5 items-start">
        {/* Screen D: CROP DISEASE DETECTION */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-emerald-400/80 uppercase tracking-wider flex items-center justify-between">
            <span>Screen D • Disease Detect</span>
            <button 
              onClick={() => onNavigateToScreen('disease-detect')}
              className="hover:underline text-[10px] text-emerald-300"
            >
              Expand ↗
            </button>
          </div>
          <div className="rounded-2xl overflow-hidden border border-emerald-500/25 shadow-2xl bg-emerald-950/20 backdrop-blur-md p-3">
            <DiseaseDetectionView 
              onBack={() => onNavigateToScreen('home')} 
              onOpenConsultation={() => onNavigateToScreen('chat')} 
            />
          </div>
        </div>

        {/* Screen E: DISEASE LIBRARY */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-emerald-400/80 uppercase tracking-wider flex items-center justify-between">
            <span>Screen E • Disease Library</span>
            <button 
              onClick={() => onNavigateToScreen('disease-library')}
              className="hover:underline text-[10px] text-emerald-300"
            >
              Expand ↗
            </button>
          </div>
          <div className="rounded-2xl overflow-hidden border border-emerald-500/25 shadow-2xl bg-emerald-950/20 backdrop-blur-md p-3">
            <DiseaseLibraryView 
              onBack={() => onNavigateToScreen('home')} 
              onNavigate={(screen) => onNavigateToScreen(screen)} 
            />
          </div>
        </div>

        {/* Screen F: EXPERT CHAT (Mobile App Layout) */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-emerald-400/80 uppercase tracking-wider flex items-center justify-between">
            <span>Screen F • Expert Chat</span>
            <button 
              onClick={() => onNavigateToScreen('chat')}
              className="hover:underline text-[10px] text-emerald-300"
            >
              Expand ↗
            </button>
          </div>
          <div className="rounded-2xl overflow-hidden border border-emerald-500/25 shadow-2xl bg-emerald-950/20 backdrop-blur-md p-3">
            <ExpertChatView onBack={() => onNavigateToScreen('home')} />
          </div>
        </div>

        {/* Screen G: OFFICER DASHBOARD (Mobile App Layout) */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-emerald-400/80 uppercase tracking-wider flex items-center justify-between">
            <span>Screen G • Officer Panel</span>
            <button 
              onClick={() => onNavigateToScreen('officer')}
              className="hover:underline text-[10px] text-emerald-300"
            >
              Expand ↗
            </button>
          </div>
          <div className="rounded-2xl overflow-hidden border border-emerald-500/25 shadow-2xl bg-emerald-950/20 backdrop-blur-md p-3">
            <OfficerDashboardView 
              onBack={() => onNavigateToScreen('home')} 
              onNavigateMap={() => onNavigateToScreen('satellite')} 
              onNavigateChat={() => onNavigateToScreen('chat')} 
            />
          </div>
        </div>

        {/* Screen H: DISEASE LIBRARY GUIDE & SETTINGS (Mobile App Layout) */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-emerald-400/80 uppercase tracking-wider flex items-center justify-between">
            <span>Screen H • Guide & Settings</span>
            <button 
              onClick={() => onNavigateToScreen('settings')}
              className="hover:underline text-[10px] text-emerald-300"
            >
              Expand ↗
            </button>
          </div>
          <div className="rounded-2xl overflow-hidden border border-emerald-500/25 shadow-2xl bg-emerald-950/20 backdrop-blur-md p-3">
            <SettingsView 
              onBack={() => onNavigateToScreen('home')} 
              onLogout={() => onNavigateToScreen('login')}
              onNavigateChat={() => onNavigateToScreen('chat')}
              onNavigateLibrary={() => onNavigateToScreen('disease-library')}
            />
          </div>
        </div>
      </div>

      {/* BOTTOM BRANDING SIGNATURE - Exactly matching reference image */}
      <div className="py-4 border-t border-emerald-500/20 flex flex-wrap items-center justify-between text-xs text-emerald-300/80 px-3">
        <div className="flex items-center gap-3 mx-auto sm:mx-0 font-medium tracking-wide">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Leaf className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span>Smarter Farming</span>
          <span className="text-emerald-500/40">|</span>
          <span>Healthier Crops</span>
          <span className="text-emerald-500/40">|</span>
          <span>Better Tomorrow</span>
        </div>

        <div className="flex items-center gap-1.5 font-bold text-sm text-white font-heading mt-2 sm:mt-0 mx-auto sm:mx-0">
          <Leaf className="w-4 h-4 text-emerald-400" />
          <span>AgriGuard</span>
        </div>
      </div>
    </div>
  );
};
