import React, { useState } from 'react';
import {
  Store,
  Mic,
  TrendingUp,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { useDukan } from '../context/DukanContext';

export const LoginView: React.FC = () => {
  const { loginWithGoogle, loginAsDemo, authError } = useDukan();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    try {
      await loginWithGoogle();
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoadingDemo(true);
    try {
      await loginAsDemo();
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background glow meshes */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-4xl z-10 space-y-8">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Powered by Gemini 3.8 Flash & Firebase Firestore</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-xl shadow-emerald-950">
              <Store className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-emerald-300 bg-clip-text text-transparent">
              DUKAN AI
            </h1>
          </div>

          <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto font-medium">
            Smart Shopkeeper Assistant & Voice POS for modern retail & grocery stores
          </p>
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <div className="max-w-md mx-auto p-3.5 rounded-xl bg-rose-900/40 border border-rose-700/60 text-rose-300 text-xs text-center">
            {authError}
          </div>
        )}

        {/* Login Cards */}
        <div className="max-w-md mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm space-y-5">
          <div className="space-y-1 text-center">
            <h2 className="text-lg font-bold text-white">Shopkeeper Login</h2>
            <p className="text-xs text-slate-400">
              Access your store dashboard, inventory, and sales
            </p>
          </div>

          <div className="space-y-3">
            {/* Google Sign-in */}
            <button
              onClick={handleGoogleLogin}
              disabled={loadingGoogle || loadingDemo}
              className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm flex items-center justify-center gap-3 shadow-md transition-all active:scale-95 disabled:opacity-60"
            >
              {loadingGoogle ? (
                <RotateCcw className="w-4 h-4 animate-spin text-slate-900" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-900 px-3 text-[11px] uppercase tracking-wider text-slate-500 font-semibold absolute">
                or
              </span>
            </div>

            {/* Quick Demo Login */}
            <button
              onClick={handleDemoLogin}
              disabled={loadingGoogle || loadingDemo}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all active:scale-95 disabled:opacity-60"
            >
              {loadingDemo ? (
                <RotateCcw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Sparkles className="w-4 h-4 text-emerald-200" />
              )}
              <span>Instant Shopkeeper Demo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-slate-500 text-center">
            No password needed. Ready in seconds with pre-loaded inventory & sales.
          </p>
        </div>

        {/* Feature Grid Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Mic className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white">Voice & Text POS</h3>
            <p className="text-xs text-slate-400">
              Speak naturally in English or Hinglish to record sales, add products, or check stock.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <PackageCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white">Auto Stock Updates</h3>
            <p className="text-xs text-slate-400">
              Inventory deducts automatically after every sale with low-stock warnings.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white">Daily & Monthly Reports</h3>
            <p className="text-xs text-slate-400">
              Real-time analytics for revenue, net profit, margins, and Khata (Udhaar) tracking.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-white">Firebase Firestore</h3>
            <p className="text-xs text-slate-400">
              Production-grade cloud persistence with isolated tenant rules and instant sync.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
