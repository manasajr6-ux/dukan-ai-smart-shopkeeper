import React, { useState } from 'react';
import { DukanProvider, useDukan } from './context/DukanContext';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { PosView } from './components/PosView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { ReceiptModal } from './components/ReceiptModal';
import { LoginView } from './components/LoginView';
import { Sale } from './types';
import { Store, RotateCcw, Sparkles, CloudOff, CloudCheck } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { user, loading, isDemoMode, loginAsDemo } = useDukan();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceInitialQuery, setVoiceInitialQuery] = useState('');
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4 space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-xl shadow-emerald-950 animate-pulse">
          <Store className="w-9 h-9 text-white" />
        </div>
        <div className="text-center space-y-2 max-w-sm">
          <h2 className="text-xl font-black text-white tracking-tight">DUKAN AI</h2>
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            <span>Connecting to shop database...</span>
          </p>

          <div className="pt-3">
            <button
              onClick={() => loginAsDemo()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 transition-all flex items-center justify-center gap-2 mx-auto"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Launch Demo Store Now (Instant)</span>
            </button>
            <p className="text-[10px] text-slate-500 mt-2">
              Instant access with sample groceries, sales history, and Gemini Voice POS
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const handleOpenVoiceModal = (initialPrompt?: string) => {
    setVoiceInitialQuery(initialPrompt || '');
    setIsVoiceModalOpen(true);
  };

  const handleSaleCompleted = (sale: Sale) => {
    setSelectedSaleForReceipt(sale);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-slate-950 font-sans">
      {/* Top Demo Mode Banner if in Demo */}
      {isDemoMode && (
        <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-b border-amber-500/30 px-4 py-1.5 text-center text-[11px] text-amber-300 font-medium flex items-center justify-center gap-2">
          <CloudOff className="w-3.5 h-3.5 text-amber-400" />
          <span>
            <strong>Demo Store Mode Active:</strong> Sample products and sales pre-loaded. All voice commands, POS billing, and reports are fully functional!
          </span>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenVoiceModal={() => handleOpenVoiceModal()}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenVoiceModal={handleOpenVoiceModal}
            onOpenAddProductModal={() => {
              setActiveTab('products');
              setIsAddProductModalOpen(true);
            }}
            onSelectSaleForReceipt={(sale) => setSelectedSaleForReceipt(sale)}
          />
        )}

        {activeTab === 'pos' && (
          <PosView
            onSaleCompleted={handleSaleCompleted}
            onOpenVoiceModal={() => handleOpenVoiceModal()}
          />
        )}

        {activeTab === 'products' && (
          <InventoryView
            isAddModalOpen={isAddProductModalOpen}
            setIsAddModalOpen={setIsAddProductModalOpen}
            onOpenVoiceModal={() => handleOpenVoiceModal()}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            onSelectSaleForReceipt={(sale) => setSelectedSaleForReceipt(sale)}
          />
        )}

        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Voice Assistant Modal */}
      <VoiceAssistantModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        initialQuery={voiceInitialQuery}
      />

      {/* Invoice Receipt Modal */}
      <ReceiptModal
        sale={selectedSaleForReceipt}
        onClose={() => setSelectedSaleForReceipt(null)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>DUKAN AI © 2026 — Smart Shopkeeper Assistant & POS</span>
          <span className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{isDemoMode ? 'Demo Store Online' : 'Firestore Synced'}</span>
            </span>
            <span>•</span>
            <span className="text-cyan-400 font-mono">Gemini 3.8 Flash Ready</span>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <DukanProvider>
      <MainAppContent />
    </DukanProvider>
  );
}
