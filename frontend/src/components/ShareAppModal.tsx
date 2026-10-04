import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Share2, Copy, Check, QrCode, X, Download, Smartphone,
  ExternalLink, Sparkles, ShieldCheck, CheckCircle2, Apple
} from 'lucide-react';
import { getNetworkInfo, NetworkInfo } from '../services/network';

interface ShareAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTarget?: 'hub' | 'apk';
}

export const ShareAppModal: React.FC<ShareAppModalProps> = ({
  isOpen,
  onClose,
  defaultTarget = 'hub',
}) => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [targetType, setTargetType] = useState<'hub' | 'apk'>(defaultTarget);
  const [copied, setCopied] = useState(false);
  const [shareStatus, setShareStatus] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    getNetworkInfo().then((info) => {
      setNetworkInfo(info);
    });
  }, []);

  const activeUrl = targetType === 'apk'
    ? (networkInfo?.apk_url || `${window.location.origin}/downloads/AgriGuard.apk`)
    : (networkInfo?.share_url || `${window.location.origin}/?screen=download`);

  // Generate QR Code on canvas whenever activeUrl changes
  useEffect(() => {
    if (!isOpen || !canvasRef.current || !activeUrl) return;

    QRCode.toCanvas(
      canvasRef.current,
      activeUrl,
      {
        width: 220,
        margin: 2,
        color: {
          dark: '#022c22', // Deep emerald dark
          light: '#ffffff', // Crisp white for instant camera optical scanning
        },
        errorCorrectionLevel: 'M',
      },
      (err) => {
        if (err) console.error('QR code render error:', err);
      }
    );
  }, [isOpen, activeUrl]);

  if (!isOpen) return null;

  const handleNativeShare = async () => {
    const shareData = {
      title: 'AgriGuard — Smart Farming & Crop Protection',
      text: targetType === 'apk'
        ? 'Download AgriGuard Android APK directly for offline crop protection and AI scans:'
        : 'Install AgriGuard — Smart Farming, Healthier Crops & AI Disease Scans:',
      url: activeUrl,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        setShareStatus('Shared successfully via device share sheet!');
        setTimeout(() => setShareStatus(''), 3000);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Web Share error:', err);
          handleFallbackCopy();
        }
      }
    } else {
      handleFallbackCopy();
    }
  };

  const handleFallbackCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeUrl);
      setCopied(true);
      setShareStatus('Install link copied to clipboard! Paste into WhatsApp, SMS, or Email.');
      setTimeout(() => {
        setCopied(false);
        setShareStatus('');
      }, 3500);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      setShareStatus(`Copy failed. Please manually copy: ${activeUrl}`);
    }
  };

  const handleDownloadQr = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `AgriGuard-Install-QR-${targetType}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShareStatus('QR Code image saved to downloads!');
    setTimeout(() => setShareStatus(''), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#064e3b]/95 to-[#022c22]/98 border border-emerald-500/40 p-5 sm:p-6 shadow-[0_0_50px_rgba(16,185,129,0.3)] text-left space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header with Close */}
        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">Share AgriGuard</h2>
              <p className="text-[11px] text-emerald-300/70">Share to install on another phone or device</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-emerald-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Share Target Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-emerald-950/70 border border-emerald-500/30">
          <button
            onClick={() => setTargetType('hub')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${targetType === 'hub'
                ? 'bg-emerald-500 text-emerald-950 shadow-md'
                : 'text-emerald-300 hover:text-white'
              }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Install Hub (All)</span>
          </button>
          <button
            onClick={() => setTargetType('apk')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${targetType === 'apk'
                ? 'bg-emerald-500 text-emerald-950 shadow-md'
                : 'text-emerald-300 hover:text-white'
              }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Direct APK (.apk)</span>
          </button>
        </div>

        {/* QR Code Canvas Card */}
        <div className="text-center space-y-3 p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/25">
          <div className="inline-block p-3 rounded-2xl bg-white shadow-xl">
            <canvas ref={canvasRef} className="rounded-lg mx-auto" />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-emerald-400" />
              <span>Scan with any phone camera to install</span>
            </p>
            <p className="text-[11px] text-emerald-300/70 truncate px-2 font-mono bg-emerald-900/30 py-1 rounded border border-emerald-500/20">
              {activeUrl}
            </p>
          </div>
        </div>

        {/* Status Toast / Alert */}
        {shareStatus && (
          <div className="p-2.5 rounded-xl bg-emerald-900/60 border border-emerald-400/40 text-emerald-100 text-xs flex items-center gap-2 animate-fade-in shadow-md">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="leading-tight">{shareStatus}</span>
          </div>
        )}

        {/* Action Buttons: Native Share + Copy Link */}
        <div className="space-y-2">
          {/* Native Share Sheet */}
          <button
            onClick={handleNativeShare}
            className="btn-primary w-full py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.35)]"
          >
            <Share2 className="w-4 h-4 text-emerald-950" />
            <span>Share via WhatsApp / Share Sheet</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            {/* Copy Link Button */}
            <button
              onClick={handleFallbackCopy}
              className="py-2.5 px-3 rounded-xl border border-emerald-500/40 bg-emerald-900/30 hover:bg-emerald-900/60 text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-emerald-400" />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>

            {/* Save QR Code */}
            <button
              onClick={handleDownloadQr}
              className="py-2.5 px-3 rounded-xl border border-emerald-500/40 bg-emerald-900/30 hover:bg-emerald-900/60 text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Save QR</span>
            </button>
          </div>
        </div>

        {/* Recipient Experience Assurance */}
        <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/15 text-[10px] text-emerald-300/70 space-y-1">
          <div className="flex items-center gap-1 text-emerald-300 font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Recipient Installation Guarantee:</span>
          </div>
          <p>
            When opened on Android, it triggers one-tap home screen install or direct APK. On iOS, it displays the 3-step Safari "Add to Home Screen" instructions.
          </p>
        </div>
      </div>
    </div>
  );
};
