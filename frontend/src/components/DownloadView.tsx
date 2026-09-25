import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Leaf, Download, Smartphone, Share, ArrowLeft, CheckCircle2,
  ShieldCheck, WifiOff, Sprout, Satellite, AlertTriangle, Monitor,
  ExternalLink, Sparkles, QrCode, Copy, Check, Share2
} from 'lucide-react';
import { getNetworkInfo, NetworkInfo } from '../services/network';
import { useLanguage } from '../context/LanguageContext';

interface DownloadViewProps {
  onBack: () => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const DownloadView: React.FC<DownloadViewProps> = ({ onBack }) => {
  const { t } = useLanguage();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deviceType, setDeviceType] = useState<'android' | 'ios' | 'desktop'>('desktop');
  const [downloadingApk, setDownloadingApk] = useState(false);
  const [installStatus, setInstallStatus] = useState<string>('');
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // 1. Detect Device / OS
    const ua = navigator.userAgent.toLowerCase();
    if (/android/i.test(ua)) {
      setDeviceType('android');
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      setDeviceType('ios');
    } else {
      setDeviceType('desktop');
    }

    // 2. Check if already running in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
    }

    // 3. Listen for browser install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setInstallStatus('AgriGuard installed successfully! You can now launch it from your home screen.');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handlePwaInstall = async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setInstallStatus('AgriGuard installed successfully! Launch it from your home screen.');
        } else {
          setInstallStatus('Installation was dismissed. You can install anytime.');
        }
      } catch (err) {
        console.error('PWA install error:', err);
      }
    } else {
      setInstallStatus('To install, open your browser menu (⋮) and tap "Install App" or "Add to Home Screen".');
    }
  };

  const handleApkDownload = () => {
    setDownloadingApk(true);
    // Trigger download of real hosted APK
    const link = document.createElement('a');
    link.href = '/downloads/AgriGuard.apk';
    link.download = 'AgriGuard.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloadingApk(false);
      setInstallStatus('Download started! Open AgriGuard.apk from your phone notifications/downloads folder to complete installation.');
    }, 1500);
  };

  const shareUrl = networkInfo?.share_url || `${window.location.origin}/?screen=download`;

  useEffect(() => {
    getNetworkInfo().then(setNetworkInfo);
  }, []);

  useEffect(() => {
    if (!qrCanvasRef.current || !shareUrl) return;
    QRCode.toCanvas(
      qrCanvasRef.current,
      shareUrl,
      {
        width: 150,
        margin: 2,
        color: {
          dark: '#022c22',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      },
      (err) => {
        if (err) console.error('QR code render error:', err);
      }
    );
  }, [shareUrl, networkInfo]);

  const handleNativeShare = async () => {
    const shareData = {
      title: 'AgriGuard — Smart Farming & Crop Protection',
      text: 'Install AgriGuard — Smart Farming, Healthier Crops & AI Disease Scans:',
      url: shareUrl,
    };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        setInstallStatus('Install link shared successfully!');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyShareLink();
        }
      }
    } else {
      handleCopyShareLink();
    }
  };

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setInstallStatus('Install link copied to clipboard! Send to any phone via WhatsApp or SMS.');
      setTimeout(() => setCopiedLink(false), 3000);
    } catch (err) {
      setInstallStatus(`Install link: ${shareUrl}`);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between p-4 sm:p-6 select-none animate-fade-in-up max-w-2xl mx-auto">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between pb-4 border-b border-emerald-500/20">
        <button
          onClick={onBack}
          className="py-2 px-3 rounded-xl border border-emerald-500/30 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('common.back', undefined, 'Back')}</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-emerald-300/80 font-bold uppercase tracking-wider">
            {t('download.title', undefined, 'Distribution Hub')}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-5 my-auto py-6 text-left">
        {/* Brand Banner */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-green-300 p-0.5 shadow-[0_0_40px_rgba(16,185,129,0.5)] mx-auto">
            <div className="w-full h-full bg-[#022c22] rounded-[22px] flex items-center justify-center border border-emerald-500/30">
              <Leaf className="w-10 h-10 text-emerald-400 stroke-[2.5]" />
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-black text-white font-heading tracking-tight">
              {t('download.title', undefined, 'Get the AgriGuard App')}
            </h1>
            <p className="text-xs text-emerald-300/80 max-w-md mx-auto mt-1">
              {t('download.subtitle', undefined, 'AI crop disease scanning, satellite vegetation tracking, and agronomist support directly on your mobile device.')}
            </p>
          </div>

          {/* Detected Device Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/40 border border-emerald-500/30 text-[11px] text-emerald-300 font-medium">
            <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {t('download.androidDevices', undefined, 'Device')}: <strong className="text-white capitalize">{deviceType}</strong>
            </span>
          </div>
        </div>

        {/* Status Notification */}
        {installStatus && (
          <div className="glass-card p-3.5 border border-emerald-500/40 bg-emerald-950/80 text-emerald-200 text-xs flex items-start gap-2.5 shadow-lg animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{installStatus}</p>
          </div>
        )}

        {/* ============================================================
            PLATFORM INSTALLATION OPTIONS
            ============================================================ */}

        {/* Option 1: Android Section */}
        <div
          className={`glass-card p-5 space-y-4 border transition-all ${
            deviceType === 'android'
              ? 'border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.25)] bg-emerald-950/70'
              : 'border-emerald-500/20'
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{t('download.androidDevices', undefined, 'Android Devices')}</h3>
                <p className="text-[10px] text-emerald-300/70">{t('download.fastInstall', undefined, 'Fast one-tap install or direct APK package')}</p>
              </div>
            </div>
            {deviceType === 'android' && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-emerald-950">
                {t('common.verified', undefined, 'Recommended')}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1A: One-Tap PWA Install */}
            <button
              onClick={handlePwaInstall}
              disabled={isInstalled}
              className="btn-primary py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-emerald-950" />
              <span>{isInstalled ? t('common.installed', undefined, 'App Already Installed') : t('common.installApp', undefined, 'Install to Home Screen')}</span>
            </button>

            {/* 1B: Direct APK Download */}
            <button
              onClick={handleApkDownload}
              disabled={downloadingApk}
              className="btn-secondary py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/40 hover:bg-emerald-900/40 transition"
            >
              <Download className={`w-4 h-4 text-emerald-400 ${downloadingApk ? 'animate-bounce' : ''}`} />
              <span>{downloadingApk ? t('common.loading', undefined, 'Downloading APK...') : t('download.downloadApk', undefined, 'Download APK (.apk)')}</span>
            </button>
          </div>

          {/* Sideloading Notice & Step-by-Step Instructions */}
          <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-xs text-emerald-200/90 space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs border-b border-emerald-500/20 pb-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Android Direct Installation Guide (Unknown Sources)</span>
            </div>
            <div className="space-y-1.5 text-[11px] leading-relaxed text-emerald-300/90">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0">1</span>
                <span>Tap <strong>Download APK (.apk)</strong>. When Chrome asks <em>"File might be harmful"</em>, tap <strong>Download anyway</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0">2</span>
                <span>When downloaded, swipe down your notification panel or tap <strong>Open</strong> in Chrome.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0">3</span>
                <span>If prompted <em>"For security, your phone is not allowed to install unknown apps"</em>, tap <strong>Settings</strong> and toggle on <strong>Allow from this source</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] flex-shrink-0">4</span>
                <span>Tap <strong>Install</strong> to complete setup. Launch AgriGuard anytime from your home screen or app drawer!</span>
              </div>
            </div>
          </div>
        </div>

        {/* Option 2: iOS Safari Section */}
        <div
          className={`glass-card p-5 space-y-4 border transition-all ${
            deviceType === 'ios'
              ? 'border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.25)] bg-emerald-950/70'
              : 'border-emerald-500/20'
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Share className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Apple iOS (iPhone &amp; iPad)</h3>
                <p className="text-[10px] text-emerald-300/70">Install directly via Safari Share Sheet</p>
              </div>
            </div>
            {deviceType === 'ios' && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-emerald-950">
                Recommended
              </span>
            )}
          </div>

          {/* 3 Step Visual Guide */}
          <div className="space-y-2.5">
            <div className="flex items-start gap-3 text-xs">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">
                1
              </div>
              <p className="text-emerald-100">
                Open this page in <strong>Safari</strong> and tap the <strong className="text-white">Share</strong> button <Share className="w-3.5 h-3.5 inline mx-1 text-emerald-400" /> at the bottom.
              </p>
            </div>

            <div className="flex items-start gap-3 text-xs">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">
                2
              </div>
              <p className="text-emerald-100">
                Scroll down the menu and tap <strong className="text-white">"Add to Home Screen"</strong> (with the ⊞ icon).
              </p>
            </div>

            <div className="flex items-start gap-3 text-xs">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-bold flex items-center justify-center text-[11px] flex-shrink-0 mt-0.5">
                3
              </div>
              <p className="text-emerald-100">
                Tap <strong className="text-white">"Add"</strong> in the top-right corner. AgriGuard will launch in fullscreen app mode!
              </p>
            </div>
          </div>
        </div>

        {/* Option 3: Desktop Section */}
        <div
          className={`glass-card p-4 space-y-3 border transition-all ${
            deviceType === 'desktop' ? 'border-emerald-500/30' : 'border-emerald-500/15 opacity-80'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white">Desktop (Chrome / Edge / macOS)</h4>
            </div>
            {installPrompt && (
              <button
                onClick={handlePwaInstall}
                className="btn-primary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-950" />
                <span>{t('common.installApp', undefined, 'Install Standalone App')}</span>
              </button>
            )}
          </div>
          <p className="text-[11px] text-emerald-300/70">
            {t('download.fastInstall', undefined, 'Run AgriGuard as a standalone desktop app.')}
          </p>
        </div>

        {/* App Features Checklist */}
        <div className="grid grid-cols-3 gap-2.5 pt-2 text-center">
          <div className="glass-card p-3 space-y-1">
            <WifiOff className="w-4 h-4 text-emerald-400 mx-auto" />
            <p className="text-[10px] font-bold text-white">{t('detection.offlineQueued', undefined, 'Offline Scans')}</p>
          </div>
          <div className="glass-card p-3 space-y-1">
            <Satellite className="w-4 h-4 text-emerald-400 mx-auto" />
            <p className="text-[10px] font-bold text-white">{t('satellite.title', undefined, 'Satellite GIS')}</p>
          </div>
          <div className="glass-card p-3 space-y-1">
            <Sprout className="w-4 h-4 text-emerald-400 mx-auto" />
            <p className="text-[10px] font-bold text-white">{t('expert.title', undefined, 'Expert Guidance')}</p>
          </div>
        </div>

        {/* Share & QR Code Cross-Device Install Section */}
        <div className="glass-card p-5 space-y-4 border border-emerald-400/30 bg-emerald-950/60 shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Share2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{t('download.scanQr', undefined, 'Share to Install on Another Phone')}</h3>
                <p className="text-[10px] text-emerald-300/70">{t('download.scanQr', undefined, 'Scan QR code')}</p>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              QR
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Real QR Code Canvas */}
            <div className="p-2.5 rounded-2xl bg-white shadow-xl flex-shrink-0">
              <canvas ref={qrCanvasRef} className="rounded-lg" />
            </div>

            <div className="flex-1 space-y-2.5 text-center sm:text-left w-full">
              <div className="p-2 rounded-lg bg-emerald-900/40 border border-emerald-500/20 font-mono text-[10px] text-emerald-300 truncate">
                {shareUrl}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={handleNativeShare}
                  className="btn-primary py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-950" />
                  <span>{t('common.share', undefined, 'Share Link')}</span>
                </button>

                <button
                  onClick={handleCopyShareLink}
                  className="py-2.5 px-3 rounded-xl border border-emerald-500/40 bg-emerald-900/30 hover:bg-emerald-900/60 text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>{copiedLink ? t('toasts.copiedToClipboard', undefined, 'Copied!') : t('common.copy', undefined, 'Copy Link')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* App Store Status Transparent Notice */}
        <div className="text-center pt-2">
          <p className="text-[10px] text-emerald-400/60 leading-relaxed">
            Direct distribution hub (PWA &amp; Standalone APK package). Google Play Store and Apple App Store packages are currently in certification review.
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="pt-4 border-t border-emerald-500/20 text-center">
        <button
          onClick={onBack}
          className="text-xs text-emerald-300 hover:text-white font-bold underline cursor-pointer"
        >
          Return to AgriGuard Dashboard / Login
        </button>
      </div>
    </div>
  );
};
