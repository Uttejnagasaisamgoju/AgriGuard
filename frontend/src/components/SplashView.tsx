import React from 'react';
import { Leaf, ArrowRight, ShieldCheck, Sprout, Satellite } from 'lucide-react';

interface SplashViewProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export const SplashView: React.FC<SplashViewProps> = ({ onGetStarted, onLogin }) => {
  return (
    <div className="relative min-h-[90vh] flex flex-col justify-between p-6 overflow-hidden rounded-3xl">
      {/* Background with overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-1000 scale-105"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1200&auto=format&fit=crop&q=80')`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/80 via-emerald-950/60 to-[#03110c] backdrop-blur-[2px]" />
      </div>

      {/* Top Brand Hero */}
      <div className="relative z-10 pt-10 text-center flex flex-col items-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-green-300 p-0.5 shadow-[0_0_40px_rgba(16,185,129,0.5)] mb-4 animate-pulse-glow">
          <div className="w-full h-full bg-emerald-950 rounded-[22px] flex items-center justify-center">
            <Leaf className="w-11 h-11 text-emerald-400 stroke-[2.5]" />
          </div>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2 font-heading">
          Agri<span className="text-emerald-400">Guard</span>
        </h1>
        <p className="text-xs font-semibold tracking-wider text-emerald-300/90 uppercase px-4 py-1 rounded-full bg-emerald-900/50 border border-emerald-500/20">
          Smart Farming • Healthy Crops • Sustainable Future
        </p>
      </div>

      {/* Feature Pills */}
      <div className="relative z-10 space-y-2.5 my-8">
        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">AI Disease Detection</h4>
            <p className="text-[11px] text-emerald-300/70">Instant diagnosis with 92%+ confidence</p>
          </div>
        </div>

        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-400">
            <Satellite className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">GIS Satellite Land Health</h4>
            <p className="text-[11px] text-emerald-300/70">Multi-spectral vegetation index & boundaries</p>
          </div>
        </div>

        <div className="glass-card p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Direct Agronomist Connect</h4>
            <p className="text-[11px] text-emerald-300/70">Live guidance from verified specialists</p>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="relative z-10 pb-4 text-center">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white leading-tight">
            Technology for<br />
            <span className="text-emerald-400">Better Tomorrow</span>
          </h2>
        </div>

        <button
          onClick={onGetStarted}
          className="btn-primary w-full py-3.5 text-base font-bold shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
        >
          <span>Get Started</span>
          <ArrowRight className="w-5 h-5" />
        </button>

        <p className="mt-3 text-xs text-emerald-300/70">
          Already have an account?{' '}
          <button
            onClick={onLogin}
            className="text-emerald-400 font-bold hover:underline"
          >
            Log In
          </button>
        </p>
      </div>
    </div>
  );
};
