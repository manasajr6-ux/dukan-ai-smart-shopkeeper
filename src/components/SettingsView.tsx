import React, { useState } from 'react';
import {
  Settings,
  Store,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  Database,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useDukan } from '../context/DukanContext';

export const SettingsView: React.FC = () => {
  const { profile, updateProfile, seedInitialData, speechEnabled, setSpeechEnabled, isDemoMode, resetToDemoData } = useDukan();

  const [shopName, setShopName] = useState(profile?.shopName || 'Apna Dukan');
  const [ownerName, setOwnerName] = useState(profile?.ownerName || 'Shopkeeper');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [currency, setCurrency] = useState(profile?.currency || '₹');
  const [threshold, setThreshold] = useState(profile?.lowStockThresholdDefault || 5);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    try {
      await updateProfile({
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        phone: phone.trim(),
        currency: currency.trim() || '₹',
        lowStockThresholdDefault: Number(threshold) || 5,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReseed = async () => {
    if (confirm('This will load starter products into your Firestore inventory catalog. Continue?')) {
      setSeeding(true);
      try {
        await seedInitialData();
        alert('Starter inventory seeded successfully!');
      } catch (e: any) {
        alert(`Seeding failed: ${e.message}`);
      } finally {
        setSeeding(false);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm">
        <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-400" />
          Store & Assistant Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure shop details, currency, low-stock alerts, and voice preferences
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-sm space-y-5">
        {savedSuccess && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Store settings updated successfully in Firestore!</span>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
            Shop Information
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Shop / Business Name
              </label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="E.g. Sharma Kirana Store"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Shopkeeper / Owner Name
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="E.g. Ramesh Sharma"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Store Phone / WhatsApp Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="E.g. +91 98765 43210"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-slate-500">Printed on invoice receipts</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Currency Symbol
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="₹">₹ - Indian Rupee (INR)</option>
                <option value="$">$ - US Dollar (USD)</option>
                <option value="€">€ - Euro (EUR)</option>
                <option value="£">£ - British Pound (GBP)</option>
                <option value="AED">AED - UAE Dirham</option>
                <option value="৳">৳ - Bangladeshi Taka (BDT)</option>
                <option value="Rs">Rs - Pakistani / Nepalese Rupee</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
            Stock & Assistant Preferences
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Default Low-Stock Warning Threshold
              </label>
              <input
                type="number"
                min="1"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-[10px] text-amber-400">
                Products with stock below this trigger low-stock alerts
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                AI Voice Audio Reply
              </label>
              <button
                type="button"
                onClick={() => setSpeechEnabled(!speechEnabled)}
                className={`w-full px-3.5 py-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold transition-colors ${
                  speechEnabled
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  {speechEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
                  <span>{speechEnabled ? 'Voice Replies Active' : 'Voice Replies Muted'}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900">
                  {speechEnabled ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950 transition-all active:scale-95 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Database Tools Card */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-400" />
          Cloud Database & Inventory Seeding
        </h2>
        <p className="text-xs text-slate-400">
          {isDemoMode
            ? 'Operating in Demo Store Mode with offline local storage. You can reset sample inventory and sales anytime.'
            : 'DUKAN AI is directly wired to Firebase Cloud Firestore for real-time persistence.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleReseed}
            disabled={seeding}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{seeding ? 'Seeding...' : 'Reload Starter Groceries'}</span>
          </button>
          {isDemoMode && (
            <button
              onClick={() => {
                if (confirm('Reset demo store with fresh sample products and sales?')) {
                  resetToDemoData();
                  alert('Demo store restored to fresh sample data!');
                }
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Fresh Demo Data</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
