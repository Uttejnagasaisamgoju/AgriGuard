import React, { useState, useEffect } from 'react';
import { Leaf, Sparkles } from 'lucide-react';

interface AppSplashScreenProps {
  onFinish?: () => void;
  durationMs?: number;
}

export const AppSplashScreen: React.FC<AppSplashScreenProps> = ({
  onFinish,
  durationMs = 1400,
}) => {
  const [progress, setProgress] = useState(15);
  const [fading, setFading] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => setProgress(65), 300);
    const timer2 = setTimeout(() => setProgress(98), 850);

    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, durationMs - 300);

    const completeTimer = setTimeout(() => {
      setHidden(true);
      if (onFinish) onFinish();
    }, durationMs);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [durationMs, onFinish]);

  if (hidden) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between p-8 bg-[#022c22] transition-opacity duration-300 select-none ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Top spacer */}
      <div className="w-full flex items-center justify-between opacity-60">
        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
          Mobile App Core
        </span>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-300">
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>v1.0.0</span>
        </div>
      </div>

      {/* Center Brand & Emblem */}
      <div className="flex flex-col items-center text-center space-y-4 my-auto">
        {/* Glowing Leaf Emblem */}
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-emerald-500 to-green-300 p-0.5 shadow-[0_0_50px_rgba(16,185,129,0.55)] animate-pulse">
            <div className="w-full h-full bg-[#022c22] rounded-[22px] flex items-center justify-center border border-emerald-500/30">
              <Leaf className="w-12 h-12 text-emerald-400 stroke-[2.5]" />
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 text-emerald-950 flex items-center justify-center text-xs font-black shadow-lg">
            ✓
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-black text-white font-heading tracking-tight">
            Agri<span className="text-emerald-400">Guard</span>
          </h1>
          <p className="text-xs font-semibold text-emerald-300/80 tracking-wide mt-1">
            Smart Farming • Healthy Crops • Better Tomorrow
          </p>
        </div>
      </div>

      {/* Bottom Loading Progress Bar */}
      <div className="w-full max-w-xs space-y-2 pb-6 text-center">
        <div className="flex items-center justify-between text-[10px] font-bold text-emerald-300/80">
          <span>Initializing offline engine...</span>
          <span className="text-emerald-400">{progress}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
