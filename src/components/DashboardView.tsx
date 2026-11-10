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
} from 'lucide-react';
import { useDukan } from '../context/DukanContext';
import { Sale } from '../types';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onOpenVoiceModal: (initialPrompt?: string) => void;
  onOpenAddProductModal: () => void;
  onSelectSaleForReceipt: (sale: Sale) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenVoiceModal,
  onOpenAddProductModal,
  onSelectSaleForReceipt,
}) => {
  const { profile, products, sales, lowStockProducts, outOfStockProducts, quickAdjustStock } = useDukan();
  const [quickInput, setQuickInput] = useState('');

  const currency = profile?.currency || '₹';

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
      onOpenVoiceModal(quickInput.trim());
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

          {/* Quick Voice / Text Bar */}
          <div className="w-full md:w-auto md:min-w-[380px]">
            <form onSubmit={handleQuickSubmit} className="relative flex items-center">
              <input
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder='E.g. "Sold 2 milk cash" or "Atta 5kg"...'
                className="w-full pl-4 pr-24 py-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
              />
              <div className="absolute right-1.5 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onOpenVoiceModal()}
                  className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md active:scale-95"
                  title="Speak voice command"
                >
                  <Mic className="w-4 h-4" />
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

      {/* Low Stock Attention Banner (if any) */}
      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-300">
                Action Required: {lowStockProducts.length + outOfStockProducts.length} item(s) running low!
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {[...outOfStockProducts, ...lowStockProducts]
                  .slice(0, 3)
                  .map((p) => `${p.name} (${p.stockQuantity} ${p.unit} left)`)
                  .join(', ')}
                {lowStockProducts.length + outOfStockProducts.length > 3 && ' and more...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigate('products')}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all"
            >
              Manage & Restock
            </button>
          </div>
        </div>
      )}

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
