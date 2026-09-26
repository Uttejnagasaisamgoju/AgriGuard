import React, { useState, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { useFarm } from './context/FarmContext';
import { FarmCreateModal } from './components/FarmCreateModal';
import { Sidebar } from './components/Sidebar';
import { BottomNavBar } from './components/BottomNavBar';
import { LoginView } from './components/LoginView';
import { ForceChangePasswordView } from './components/ForceChangePasswordView';
import { HomeDashboardView } from './components/HomeDashboardView';
import { SatelliteMapView } from './components/SatelliteMapView';
import { DiseaseDetectionView } from './components/DiseaseDetectionView';
import { DiseaseLibraryView } from './components/DiseaseLibraryView';
import { ExpertChatView } from './components/ExpertChatView';
import { OfficerDashboardView } from './components/OfficerDashboardView';
import { ExpertDashboardView } from './components/ExpertDashboardView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { NotificationsModal } from './components/NotificationsModal';
import { InstallAppBanner } from './components/InstallAppBanner';
import { AppSplashScreen } from './components/AppSplashScreen';
import { DownloadView } from './components/DownloadView';
import { DiseaseDetailView } from './components/DiseaseDetailView';
import { AIAssistantView } from './components/AIAssistantView';
import { BASE_REFERENCE_DISEASES } from './utils/diseaseImages';
import { FirstLaunchLanguageModal } from './components/FirstLaunchLanguageModal';
import { NotificationPermissionBanner } from './components/NotificationPermissionBanner';
import { useLanguage } from './context/LanguageContext';
import { Leaf } from 'lucide-react';

export const App: React.FC = () => {
  const { user, isAuthenticated, logout, isVerifyingSession } = useAuth();
  const { isModalOpen, closeModal, farmToEdit, handleFarmSaved } = useFarm();
  const { isLanguageModalOpen, closeLanguageModal, t } = useLanguage();
  
  // Parse deep link parameters from URL search query
  const getInitialDeepLink = (): { screen: string; recordId: string | null } => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlScreen = params.get('screen');
      const recordId =
        params.get('record_id') ||
        params.get('prediction_id') ||
        params.get('case_id') ||
        params.get('farm_id');

      // Check if there is an explicit deep link screen parameter
      if (urlScreen && urlScreen !== '') {
        return { screen: urlScreen, recordId };
      }

      const path = window.location.pathname.substring(1);
      if (path === 'download' || urlScreen === 'download') {
        return { screen: 'download', recordId: null };
      }

      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes('android-app://');

      if (!isStandalone && path && path !== '') {
        return { screen: path, recordId };
      }
    }
    return { screen: 'home', recordId: null };
  };

  const initialDeepLink = getInitialDeepLink();
  const [currentScreen, setCurrentScreen] = useState<string>(initialDeepLink.screen);
  const [deepLinkRecordId, setDeepLinkRecordId] = useState<string | null>(initialDeepLink.recordId);
  const [showNotifications, setShowNotifications] = useState(false);
  const [splashFinished, setSplashFinished] = useState(false);
  const [aiInitialQuery, setAiInitialQuery] = useState<string | undefined>(undefined);

  React.useEffect(() => {
    const onPopState = () => {
      const dl = getInitialDeepLink();
      setCurrentScreen(dl.screen);
      if (dl.recordId) setDeepLinkRecordId(dl.recordId);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Listen to background/foreground push notification clicks via Service Worker
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'NOTIFICATION_DEEP_LINK') {
          const targetScreen = event.data.screen || 'home';
          const recId =
            event.data.record_id ||
            (event.data.payload && event.data.payload.record_id) ||
            null;
          handleNavigate(targetScreen, recId);
        }
      };

      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, []);

  // Preserve deep link destination if user is not authenticated yet
  React.useEffect(() => {
    if (!isAuthenticated && typeof window !== 'undefined') {
      const { screen, recordId } = getInitialDeepLink();
      if (screen && screen !== 'home' && screen !== 'download') {
        sessionStorage.setItem(
          'agriguard_pending_deep_link',
          JSON.stringify({ screen, recordId })
        );
      }
    }
  }, [isAuthenticated]);

  const scrollViewportRef = useRef<HTMLDivElement>(null);

  const handleNavigate = (screen: string, recordId?: string | null) => {
    if (recordId !== undefined) {
      setDeepLinkRecordId(recordId);
    }
    if (currentScreen !== screen) {
      window.history.pushState({}, '', `/${screen === 'home' ? '' : screen}`);
      setCurrentScreen(screen);
      if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleLoginSuccess = () => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('agriguard_pending_deep_link');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          sessionStorage.removeItem('agriguard_pending_deep_link');
          if (parsed.screen) {
            handleNavigate(parsed.screen, parsed.recordId || null);
            return;
          }
        } catch {}
      }
    }
    handleNavigate('home');
  };

  // While checking stored session or showing startup splash, display splash screen
  // This guarantees ZERO flash of the wrong screen (no dashboard flash before login, no login flash before dashboard)
  if (isVerifyingSession || !splashFinished) {
    return (
      <AppSplashScreen
        onFinish={() => {
          setSplashFinished(true);
        }}
      />
    );
  }

  // If not authenticated, route to Login (or download page if explicitly accessed in browser)
  if (!isAuthenticated) {
    if (currentScreen === 'download') {
      return (
        <>
          <DownloadView onBack={() => handleNavigate('home')} />
          <FirstLaunchLanguageModal
            isOpen={isLanguageModalOpen}
            onClose={closeLanguageModal}
          />
        </>
      );
    }
    return (
      <>
        <InstallAppBanner onOpenDownload={() => handleNavigate('download')} />
        <LoginView
          onSuccess={handleLoginSuccess}
          onOpenDownload={() => handleNavigate('download')}
        />
        <FirstLaunchLanguageModal
          isOpen={isLanguageModalOpen}
          onClose={closeLanguageModal}
        />
      </>
    );
  }

  // Mandatory password reset if user signed in with a temporary password
  if (user?.must_change_password) {
    return (
      <ForceChangePasswordView
        onSuccess={() => {
          setCurrentScreen('home');
        }}
      />
    );
  }

  const role = (user?.role || 'farmer').toUpperCase();

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        if (role === 'OFFICER') {
          return (
            <OfficerDashboardView
              onBack={() => handleNavigate('home')}
              onNavigateMap={() => handleNavigate('satellite')}
              onNavigateChat={() => handleNavigate('chat')}
            />
          );
        }
        if (role === 'EXPERT') {
          return (
            <ExpertDashboardView
              onNavigateChat={() => handleNavigate('chat')}
              onNavigateLibrary={() => handleNavigate('disease-library')}
              onNavigateSettings={() => handleNavigate('settings')}
              onOpenNotifications={() => setShowNotifications(true)}
            />
          );
        }
        if (role === 'ADMIN') {
          return (
            <AdminDashboardView onBack={() => handleNavigate('home')} />
          );
        }
        return (
          <HomeDashboardView
            onNavigate={handleNavigate}
            onOpenNotifications={() => setShowNotifications(true)}
          />
        );

      case 'satellite':
        return (
          <SatelliteMapView
            onBack={() => handleNavigate('home')}
            onViewDetails={() => handleNavigate('disease-library')}
          />
        );

      case 'disease-detect':
        return (
          <DiseaseDetectionView
            onBack={() => handleNavigate('home')}
            onOpenConsultation={() => handleNavigate('chat')}
            onNavigateAI={(query) => {
              setAiInitialQuery(query);
              handleNavigate('ai-assistant');
            }}
            initialPredictionId={deepLinkRecordId}
          />
        );

      case 'ai-assistant':
        return (
          <AIAssistantView
            onBack={() => handleNavigate('home')}
            onNavigateExpert={() => handleNavigate('chat')}
            onNavigateScan={() => handleNavigate('disease-detect')}
            initialQuery={aiInitialQuery}
          />
        );

      case 'disease-library':
        return <DiseaseLibraryView onBack={() => handleNavigate('home')} onNavigate={handleNavigate} />;

      case 'chat':
        return <ExpertChatView onBack={() => handleNavigate('home')} />;

      case 'officer':
      case 'visits':
      case 'farmers':
        if (role !== 'OFFICER' && role !== 'ADMIN') {
          return <HomeDashboardView onNavigate={handleNavigate} onOpenNotifications={() => setShowNotifications(true)} />;
        }
        return (
          <OfficerDashboardView
            onBack={() => handleNavigate('home')}
            onNavigateMap={() => handleNavigate('satellite')}
            onNavigateChat={() => handleNavigate('chat')}
          />
        );

      case 'expert':
        if (role !== 'EXPERT' && role !== 'ADMIN') {
          return <HomeDashboardView onNavigate={handleNavigate} onOpenNotifications={() => setShowNotifications(true)} />;
        }
        return (
          <ExpertDashboardView
            onNavigateChat={() => handleNavigate('chat')}
            onNavigateLibrary={() => handleNavigate('disease-library')}
            onNavigateSettings={() => handleNavigate('settings')}
            onOpenNotifications={() => setShowNotifications(true)}
          />
        );

      case 'reports':
        return <ReportsView onBack={() => handleNavigate('home')} initialFarmId={deepLinkRecordId} />;

      case 'download':
        return <DownloadView onBack={() => handleNavigate('home')} />;

      case 'settings':
        return (
          <SettingsView
            onBack={() => handleNavigate('home')}
            onLogout={() => {
              logout();
              setCurrentScreen('home');
            }}
            onNavigateChat={() => handleNavigate('chat')}
            onNavigateLibrary={() => handleNavigate('disease-library')}
            onNavigateDownload={() => handleNavigate('download')}
          />
        );

      default:
        if (currentScreen.startsWith('disease-library/')) {
          const diseaseId = currentScreen.split('/')[1];
          const localMatch = BASE_REFERENCE_DISEASES.find(d => d.id === diseaseId);
          return (
            <DiseaseDetailView 
              disease={localMatch}
              diseaseId={diseaseId}
              onBack={() => handleNavigate('disease-library')}
              onConsultExpert={() => handleNavigate('chat')}
            />
          );
        }
        return <HomeDashboardView onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="app-shell">
      <InstallAppBanner onOpenDownload={() => handleNavigate('download')} />
      {/* Desktop Sidebar */}
      <div className="sidebar-container">
        <Sidebar currentScreen={currentScreen} onNavigate={handleNavigate} />
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="app-scroll-view" id="main-scroll-viewport" ref={scrollViewportRef}>
          <main className="page-container">
            {renderScreen()}
          </main>

          {/* Footer */}
          <footer className="w-full py-3 text-xs text-emerald-300/70 flex flex-wrap items-center justify-between px-6 border-t border-emerald-500/10 bg-emerald-950/30 select-none mt-auto">
            <div className="flex items-center gap-3 mx-auto lg:mx-0 font-medium">
              <Leaf className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('common.footerSlogan1', undefined, 'Smarter Farming')}</span>
              <span className="text-emerald-500/30">|</span>
              <span>{t('common.footerSlogan2', undefined, 'Healthier Crops')}</span>
              <span className="text-emerald-500/30">|</span>
              <span>{t('common.footerSlogan3', undefined, 'Better Tomorrow')}</span>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-sm text-white font-heading mx-auto lg:mx-0 mt-2 lg:mt-0">
              <Leaf className="w-4 h-4 text-emerald-400" />
              <span>{t('auth.appName', undefined, 'AgriGuard')}</span>
            </div>
          </footer>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNavBar currentTab={currentScreen} onTabChange={handleNavigate} />

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onNavigate={(screen, recId) => handleNavigate(screen, recId)}
      />

      {/* Real Device Push Notification Permission Prompt */}
      <NotificationPermissionBanner />

      {/* Global Farm Creation / Edit Modal */}
      <FarmCreateModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSuccess={handleFarmSaved}
        farmToEdit={farmToEdit}
      />

      {/* First Launch & Settings Language Selection Modal */}
      <FirstLaunchLanguageModal
        isOpen={isLanguageModalOpen}
        onClose={closeLanguageModal}
      />
    </div>
  );
};

export default App;
