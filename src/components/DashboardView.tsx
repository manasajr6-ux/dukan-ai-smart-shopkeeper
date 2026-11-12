import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  ShoppingCart,
  Plus,
  Mic,
  ArrowRight,
  Receipt,
  Sparkles,
  Clock,
  User,
  CreditCard,
  Banknote,
  QrCode,
  BookOpen,
  Send,
  ShieldCheck,
  AlertOctagon,
  Edit2,
  Check,
  CheckCircle2,
  RotateCcw,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { useDukan } from '../context/DukanContext';
import { Sale } from '../types';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onOpenVoiceModal: (initialPrompt?: string, autoExecute?: boolean) => void;
  onOpenAddProductModal: () => void;
  onSelectSaleForReceipt: (sale: Sale) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenVoiceModal,
  onOpenAddProductModal,
  onSelectSaleForReceipt,
}) => {
  const {
    profile,
    products,
    sales,
    lowStockProducts,
    outOfStockProducts,
    restockRecommendations,
    updateMinStockThreshold,
    restockProduct,
    quickAdjustStock,
  } = useDukan();
  const [quickInput, setQuickInput] = useState('');
  const [editingThresholdId, setEditingThresholdId] = useState<string | null>(null);
  const [tempThresholdValue, setTempThresholdValue] = useState<number>(5);
  const [filterAlertStatus, setFilterAlertStatus] = useState<'all' | 'out' | 'low'>('all');
  const [restockingId, setRestockingId] = useState<string | null>(null);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  const currency = profile?.currency || '₹';

  const handleQuickRestock = async (productId: string, qty: number, productName: string) => {
    setRestockingId(productId);
    try {
      await restockProduct(productId, qty);
      setNotificationToast(`Restocked +${qty} ${productName}. Stock restored successfully!`);
      setTimeout(() => setNotificationToast(null), 3500);
    } catch (e: any) {
      alert(`Restock failed: ${e.message}`);
    } finally {
      setRestockingId(null);
    }
  };

  const handleSaveThreshold = async (productId: string) => {
    try {
      await updateMinStockThreshold(productId, tempThresholdValue);
      setEditingThresholdId(null);
      setNotificationToast(`Updated minimum stock threshold to ${tempThresholdValue}!`);
      setTimeout(() => setNotificationToast(null), 3500);
    } catch (e: any) {
      alert(`Threshold update failed: ${e.message}`);
    }
  };

  const displayedAlerts = useMemo(() => {
    if (filterAlertStatus === 'out') {
      return restockRecommendations.filter((r) => r.status === 'out_of_stock');
    }
    if (filterAlertStatus === 'low') {
      return restockRecommendations.filter((r) => r.status === 'low_stock');
    }
    return restockRecommendations;
  }, [restockRecommendations, filterAlertStatus]);

  // Compute Today's Stats
  const todayMetrics = useMemo(() => {
    const today = new Date().toDateString();
    const todaySales = sales.filter((s) => new Date(s.createdAt).toDateString() === today);

    const revenue = todaySales.reduce((acc, s) => acc + s.totalAmount, 0);
    const profit = todaySales.reduce((acc, s) => acc + s.totalProfit, 0);
    const itemsCount = todaySales.reduce((acc, s) => acc + s.items.reduce((sum, it) => sum + it.quantity, 0), 0);
    const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0';

    return {
      revenue,
      profit,
      margin,
      salesCount: todaySales.length,
      itemsCount,
      todaySales,
    };
  }, [sales]);

  // Compute Top Selling Products
  const topProducts = useMemo(() => {
    const counts: { [name: string]: { qty: number; revenue: number } } = {};
    sales.forEach((s) => {
      s.items.forEach((it) => {
        if (!counts[it.productName]) {
          counts[it.productName] = { qty: 0, revenue: 0 };
        }
        counts[it.productName].qty += it.quantity;
        counts[it.productName].revenue += it.totalPrice;
      });
    });

    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [sales]);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickInput.trim()) {
      onOpenVoiceModal(quickInput.trim(), true);
      setQuickInput('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome & Quick Command Bar */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Today's Store Overview
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {new Date().toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Namaste, <span className="text-emerald-400">{profile?.ownerName || 'Shopkeeper'}</span>!
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {profile?.shopName || 'Apna Dukan'} is running smoothly. Record sales or speak commands below.
            </p>
          </div>

          {/* Quick Voice / Text Bar with functional Send & Mic buttons */}
          <div className="w-full md:w-auto md:min-w-[420px]">
            <form onSubmit={handleQuickSubmit} className="relative flex items-center">
              <input
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder='E.g. "Add 2 kg Tata Salt to my inventory"...'
                className="w-full pl-4 pr-32 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
              />
              <div className="absolute right-1.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onOpenVoiceModal(quickInput.trim())}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-all shadow-md active:scale-95"
                  title="Speak voice command"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  disabled={!quickInput.trim()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1 shadow-md transition-all active:scale-95"
                  title="Send command"
                >
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Today's Sales
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {currency}{todayMetrics.revenue.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-emerald-400">{todayMetrics.salesCount} bills</span>
            <span>•</span>
            <span>{todayMetrics.itemsCount} items sold</span>
          </div>
        </div>

        {/* Today's Profit */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Today's Net Profit
            </span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {currency}{todayMetrics.profit.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-teal-400">~{todayMetrics.margin}% margin</span>
            <span>•</span>
            <span>Gross margin today</span>
          </div>
        </div>

        {/* Total Products */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Products
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">{products.length}</div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
            <span>In stock catalog</span>
            <button
              onClick={() => onNavigate('products')}
              className="text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              View all →
            </button>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className={`p-5 rounded-2xl border shadow-sm relative overflow-hidden ${
          lowStockProducts.length + outOfStockProducts.length > 0
            ? 'bg-amber-950/20 border-amber-500/40'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Low Stock Alerts
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-white">
            {lowStockProducts.length + outOfStockProducts.length}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
            <span className="text-rose-400 font-semibold">{outOfStockProducts.length} out of stock</span>
            <button
              onClick={() => onNavigate('products')}
              className="text-amber-400 hover:text-amber-300 font-semibold"
            >
              Restock →
            </button>
          </div>
        </div>
      </div>

      {/* Notification Toast for Quick Restock & Threshold Edits */}
      {notificationToast && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{notificationToast}</span>
          </div>
          <button
            onClick={() => setNotificationToast(null)}
            className="text-emerald-400 hover:text-white text-xs px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* DEDICATED SMART LOW-STOCK ALERT & INVENTORY MONITORING SECTION */}
      <section className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${
                restockRecommendations.length > 0
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {restockRecommendations.length > 0 ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  Smart Low-Stock & Inventory Monitoring
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time stock threshold tracking & AI reorder suggestions updated after every sale
                </p>
              </div>
            </div>
          </div>

          {/* Quick Filter Badges & AI Action */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterAlertStatus('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                filterAlertStatus === 'all'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white'
              }`}
            >
              All Alerts ({restockRecommendations.length})
            </button>
            <button
              onClick={() => setFilterAlertStatus('out')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filterAlertStatus === 'out'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50'
                  : 'bg-slate-800/60 text-rose-400/80 hover:text-rose-300'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              Out of Stock ({outOfStockProducts.length})
            </button>
            <button
              onClick={() => setFilterAlertStatus('low')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                filterAlertStatus === 'low'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  : 'bg-slate-800/60 text-amber-400/80 hover:text-amber-300'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Low Stock ({lowStockProducts.length})
            </button>
            <button
              onClick={() => onOpenVoiceModal('Show me products that need restocking', true)}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-all ml-auto"
              title="Ask Dukaan Voice & AI Assistant for restock analysis"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>AI Restock Plan</span>
            </button>
          </div>
        </div>

        {/* Section Content */}
        <div className="mt-4">
          {displayedAlerts.length === 0 ? (
            <div className="p-6 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center flex flex-col items-center justify-center">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 mb-3 border border-emerald-500/20">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-emerald-400">
                All Product Stock Levels are Healthy
              </h3>
              <p className="text-xs text-slate-400 max-w-md mt-1">
                {filterAlertStatus === 'all'
                  ? 'None of your products are currently at or below minimum stock threshold. Stock levels update instantly upon every customer sale.'
                  : `No items matching the selected filter "${filterAlertStatus === 'out' ? 'Out of Stock' : 'Low Stock'}".`}
              </p>
              <button
                onClick={() => onNavigate('products')}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Configure Minimum Thresholds in Products
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {displayedAlerts.map((rec) => {
                const isOutOfStock = rec.status === 'out_of_stock';
                const isEditingThis = editingThresholdId === rec.productId;
                const isRestockingThis = restockingId === rec.productId;
                const stockPercent = rec.minThreshold > 0
                  ? Math.min(100, Math.round((rec.currentStock / rec.minThreshold) * 100))
                  : 0;

                return (
                  <div
                    key={rec.productId}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isOutOfStock
                        ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-500/60'
                        : 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50'
                    }`}
                  >
                    <div>
                      {/* Badge and Category */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide truncate">
                          {rec.category || 'General'}
                        </span>
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                            OUT OF STOCK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            LOW STOCK
                          </span>
                        )}
                      </div>

                      {/* Product Name */}
                      <h4 className="text-sm font-bold text-white truncate" title={rec.productName}>
                        {rec.productName}
                      </h4>

                      {/* Quantity vs Threshold */}
                      <div className="mt-3 grid grid-cols-2 gap-2 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80">
                        <div>
                          <span className="text-[10px] font-medium text-slate-400 uppercase">Available Stock</span>
                          <div className={`text-base font-extrabold ${isOutOfStock ? 'text-rose-400' : 'text-amber-400'}`}>
                            {rec.currentStock} <span className="text-xs font-normal text-slate-400">{rec.unit}</span>
                          </div>
                        </div>

                        <div>
                          <span className="text-[10px] font-medium text-slate-400 uppercase flex items-center justify-between">
                            <span>Min Threshold</span>
                            {!isEditingThis && (
                              <button
                                onClick={() => {
                                  setEditingThresholdId(rec.productId);
                                  setTempThresholdValue(rec.minThreshold);
                                }}
                                className="text-cyan-400 hover:text-cyan-300 p-0.5 rounded"
                                title="Edit Minimum Threshold"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                          </span>

                          {isEditingThis ? (
                            <div className="flex items-center gap-1 mt-1">
                              <input
                                type="number"
                                min="0"
                                max="1000"
                                value={tempThresholdValue}
                                onChange={(e) => setTempThresholdValue(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-14 px-1.5 py-0.5 rounded bg-slate-900 border border-cyan-500/60 text-xs font-bold text-white focus:outline-none"
                              />
                              <button
                                onClick={() => handleSaveThreshold(rec.productId)}
                                className="p-1 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs"
                                title="Save Threshold"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingThresholdId(null)}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs"
                                title="Cancel"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="text-base font-extrabold text-slate-200">
                              {rec.minThreshold} <span className="text-xs font-normal text-slate-400">{rec.unit}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Stock Level Progress Indicator */}
                      <div className="mt-2.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                          <span>Threshold Deficit</span>
                          <span>{stockPercent}% of safe level</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isOutOfStock ? 'bg-rose-500 w-1' : 'bg-amber-400'
                            }`}
                            style={{ width: `${Math.max(4, Math.min(100, stockPercent))}%` }}
                          />
                        </div>
                      </div>

                      {/* Smart Reorder Suggestion */}
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/90">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-300">Suggested Reorder:</span>
                          <span className="text-xs font-extrabold text-emerald-400">
                            +{rec.suggestedReorderQuantity} {rec.unit}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                          💡 {rec.salesVelocityReason}
                        </p>
                      </div>
                    </div>

                    {/* 1-Click Fast Restock Button */}
                    <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center gap-2">
                      <button
                        onClick={() => handleQuickRestock(rec.productId, rec.suggestedReorderQuantity, rec.productName)}
                        disabled={isRestockingThis}
                        className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                          isOutOfStock
                            ? 'bg-rose-500 hover:bg-rose-400 text-white'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        } disabled:opacity-50`}
                      >
                        {isRestockingThis ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Updating...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Restock +{rec.suggestedReorderQuantity} {rec.unit}</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => onNavigate('products')}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs"
                        title="Edit Full Product Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Fast Action Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('pos')}
          className="p-4 rounded-xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 flex flex-col items-center justify-center gap-2 text-center group transition-all"
        >
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <span className="text-sm font-bold text-white">New Sale (POS)</span>
          <span className="text-[11px] text-slate-400">Quick customer bill</span>
        </button>

        <button
          onClick={onOpenAddProductModal}
          className="p-4 rounded-xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 flex flex-col items-center justify-center gap-2 text-center group transition-all"
        >
          <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6" />
          </div>
          <span className="text-sm font-bold text-white">Add Product</span>
          <span className="text-[11px] text-slate-400">New inventory item</span>
        </button>

        <button
          onClick={() => onOpenVoiceModal()}
          className="p-4 rounded-xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 flex flex-col items-center justify-center gap-2 text-center group transition-all"
        >
          <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400 group-hover:scale-110 transition-transform">
            <Mic className="w-6 h-6" />
          </div>
          <span className="text-sm font-bold text-white">Voice Command</span>
          <span className="text-[11px] text-slate-400">Gemini Assistant</span>
        </button>

        <button
          onClick={() => onNavigate('reports')}
          className="p-4 rounded-xl bg-slate-900 hover:bg-slate-800/90 border border-slate-800 flex flex-col items-center justify-center gap-2 text-center group transition-all"
        >
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-6 h-6" />
          </div>
          <span className="text-sm font-bold text-white">Sales Reports</span>
          <span className="text-[11px] text-slate-400">Daily & Monthly stats</span>
        </button>
      </div>

      {/* Split Section: Recent Transactions & Top Selling */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">Recent Sales & Invoices</h2>
            </div>
            <button
              onClick={() => onNavigate('reports')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
            >
              <span>View all sales</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-800/60 max-h-[380px] overflow-y-auto">
            {sales.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-3">
                <Receipt className="w-10 h-10 mx-auto text-slate-600" />
                <p>No sales recorded yet.</p>
                <button
                  onClick={() => onNavigate('pos')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs"
                >
                  Create First Bill (POS)
                </button>
              </div>
            ) : (
              sales.slice(0, 6).map((sale) => (
                <div
                  key={sale.id}
                  className="py-3 flex items-center justify-between hover:bg-slate-800/40 px-2 rounded-xl transition-colors cursor-pointer"
                  onClick={() => onSelectSaleForReceipt(sale)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                      {sale.paymentMode === 'cash' && <Banknote className="w-5 h-5 text-emerald-400" />}
                      {sale.paymentMode === 'upi' && <QrCode className="w-5 h-5 text-cyan-400" />}
                      {sale.paymentMode === 'credit_khata' && <BookOpen className="w-5 h-5 text-amber-400" />}
                      {sale.paymentMode === 'card' && <CreditCard className="w-5 h-5 text-purple-400" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">
                          {sale.customerName || 'Walk-in Customer'}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {sale.billNumber}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {sale.items.map((it) => `${it.quantity}x ${it.productName}`).join(', ')}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-white">
                      {currency}{sale.totalAmount.toLocaleString()}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-[11px]">
                      <span className={`capitalize font-medium ${
                        sale.paymentStatus === 'paid' ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {sale.paymentStatus === 'paid' ? 'Paid' : 'Udhaar (Pending)'}
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400">
                        {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Selling Products (1 col) */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-400" />
              <h2 className="text-base font-bold text-white">Top Sellers</h2>
            </div>
            <span className="text-xs text-slate-400">By quantity</span>
          </div>

          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Top sellers will appear after sales are recorded.
              </p>
            ) : (
              topProducts.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {p.name}
                    </span>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <span className="text-xs font-bold text-emerald-400">
                      {p.qty} sold
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {currency}{p.revenue.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
