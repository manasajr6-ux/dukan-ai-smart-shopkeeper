import React, { useState } from 'react';
import {
  Store,
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Mic,
  Bell,
  Settings,
  LogOut,
  Volume2,
  VolumeX,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useDukan } from '../context/DukanContext';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenVoiceModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenVoiceModal }) => {
  const { user, profile, logout, lowStockProducts, outOfStockProducts, speechEnabled, setSpeechEnabled, isDemoMode } = useDukan();
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);

  const totalAlerts = lowStockProducts.length + outOfStockProducts.length;

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Shop Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-950">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                  DUKAN AI
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Smart POS
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[160px] sm:max-w-xs font-medium">
                {profile?.shopName || 'Retail Assistant'}
              </p>
            </div>
          </div>

          {/* Quick AI Voice Action Pill */}
          <div className="hidden md:flex items-center">
            <button
              onClick={onOpenVoiceModal}
              className="group relative flex items-center gap-2.5 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-600/90 to-teal-600/90 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm transition-all duration-200 shadow-md shadow-emerald-900/30 active:scale-95"
            >
              <div className="relative">
                <Mic className="w-4 h-4 text-emerald-100 group-hover:scale-110 transition-transform" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-300 animate-ping" />
              </div>
              <span>Shop Voice Assistant</span>
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-black/25 text-emerald-200 rounded border border-white/10">
                Gemini
              </kbd>
            </button>
          </div>

          {/* Controls: Alerts, Speech Toggle, User & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Speech synthesis toggle */}
            <button
              onClick={() => setSpeechEnabled(!speechEnabled)}
              title={speechEnabled ? 'Mute AI Voice Replies' : 'Enable AI Voice Replies'}
              className={`p-2 rounded-lg text-slate-300 hover:text-white transition-colors ${
                speechEnabled ? 'bg-slate-800 text-emerald-400' : 'bg-slate-800/50 text-slate-500'
              }`}
            >
              {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Low stock notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                className="relative p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white transition-colors"
                title="Stock alerts"
              >
                <Bell className="w-4 h-4" />
                {totalAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow">
                    {totalAlerts}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotificationDropdown && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 rounded-xl shadow-2xl border border-slate-700 py-2 z-50 animate-in fade-in zoom-in-95">
                  <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-200 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Stock Alerts ({totalAlerts})
                    </span>
                    <button
                      onClick={() => {
                        setShowNotificationDropdown(false);
                        setActiveTab('products');
                      }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                    >
                      Manage
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-800 text-xs">
                    {totalAlerts === 0 ? (
                      <div className="p-4 text-center text-slate-400">All products have healthy inventory!</div>
                    ) : (
                      <>
                        {outOfStockProducts.map((p) => (
                          <div key={p.id} className="p-3 hover:bg-slate-800/60 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-rose-400">{p.name}</p>
                              <p className="text-slate-400">Out of Stock (0 {p.unit})</p>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold">0 left</span>
                          </div>
                        ))}
                        {lowStockProducts.map((p) => (
                          <div key={p.id} className="p-3 hover:bg-slate-800/60 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-amber-300">{p.name}</p>
                              <p className="text-slate-400">
                                Current: {p.stockQuantity} {p.unit} (Min: {p.minStockThreshold})
                              </p>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                              Low Stock
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-semibold text-slate-200 leading-tight">
                  {profile?.ownerName || 'Shopkeeper'}
                </p>
                <div className="flex items-center justify-end gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${isDemoMode ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <p className="text-[10px] text-slate-400">
                    {isDemoMode ? 'Demo Store' : 'Cloud Store Admin'}
                  </p>
                </div>
              </div>
              <button
                onClick={logout}
                title="Log Out"
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 text-sm border-t border-slate-800/70 no-scrollbar">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'dashboard'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('pos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'pos'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>POS / New Sale</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'products'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Inventory ({lowStockProducts.length > 0 ? `${lowStockProducts.length} low` : 'Items'})</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'reports'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Reports & Analytics</span>
          </button>

          <button
            onClick={onOpenVoiceModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap md:hidden transition-all text-emerald-400 bg-emerald-950/40 border border-emerald-500/30`}
          >
            <Mic className="w-4 h-4 animate-pulse" />
            <span>Voice Assistant</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ml-auto ${
              activeTab === 'settings'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
