import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  DollarSign,
  TrendingUp,
  Receipt,
  Search,
  Download,
  Filter,
  CheckCircle,
  Clock,
  Banknote,
  QrCode,
  BookOpen,
  CreditCard,
  Eye,
} from 'lucide-react';
import { useDukan } from '../context/DukanContext';
import { Sale } from '../types';

interface ReportsViewProps {
  onSelectSaleForReceipt: (sale: Sale) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onSelectSaleForReceipt }) => {
  const { sales, profile } = useDukan();
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  const currency = profile?.currency || '₹';

  // Filter sales based on selected date range
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return sales.filter((s) => {
      const saleTime = new Date(s.createdAt).getTime();

      let matchesDate = true;
      if (dateRange === 'today') {
        matchesDate = saleTime >= todayStart;
      } else if (dateRange === 'yesterday') {
        matchesDate = saleTime >= yesterdayStart && saleTime < todayStart;
      } else if (dateRange === 'week') {
        matchesDate = saleTime >= weekStart;
      } else if (dateRange === 'month') {
        matchesDate = saleTime >= monthStart;
      }

      const matchesSearch =
        s.billNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.customerName && s.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        s.items.some((it) => it.productName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesPayment = paymentFilter === 'all' || s.paymentMode === paymentFilter;

      return matchesDate && matchesSearch && matchesPayment;
    });
  }, [sales, dateRange, searchQuery, paymentFilter]);

  // Aggregate Metrics
  const summary = useMemo(() => {
    const totalRevenue = filteredSales.reduce((acc, s) => acc + s.totalAmount, 0);
    const totalProfit = filteredSales.reduce((acc, s) => acc + s.totalProfit, 0);
    const totalItems = filteredSales.reduce(
      (acc, s) => acc + s.items.reduce((sum, it) => sum + it.quantity, 0),
      0
    );
    const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';
    const aov = filteredSales.length > 0 ? (totalRevenue / filteredSales.length).toFixed(1) : '0';

    // Payment breakdown
    const paymentBreakdown: { [mode: string]: { count: number; total: number } } = {
      cash: { count: 0, total: 0 },
      upi: { count: 0, total: 0 },
      credit_khata: { count: 0, total: 0 },
      card: { count: 0, total: 0 },
    };

    filteredSales.forEach((s) => {
      const mode = s.paymentMode || 'cash';
      if (!paymentBreakdown[mode]) {
        paymentBreakdown[mode] = { count: 0, total: 0 };
      }
      paymentBreakdown[mode].count += 1;
      paymentBreakdown[mode].total += s.totalAmount;
    });

    // Top selling items in this period
    const productStats: { [name: string]: { qty: number; revenue: number } } = {};
    filteredSales.forEach((s) => {
      s.items.forEach((it) => {
        if (!productStats[it.productName]) {
          productStats[it.productName] = { qty: 0, revenue: 0 };
        }
        productStats[it.productName].qty += it.quantity;
        productStats[it.productName].revenue += it.totalPrice;
      });
    });

    const topSelling = Object.entries(productStats)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      totalRevenue,
      totalProfit,
      totalItems,
      profitMargin,
      aov,
      paymentBreakdown,
      topSelling,
      count: filteredSales.length,
    };
  }, [filteredSales]);

  // CSV export helper
  const handleExportCSV = () => {
    if (filteredSales.length === 0) return;
    const headers = ['Bill Number', 'Date', 'Customer', 'Items Count', 'Payment Mode', 'Status', 'Total Amount', 'Net Profit'];
    const rows = filteredSales.map((s) => [
      s.billNumber,
      new Date(s.createdAt).toLocaleString(),
      `"${s.customerName || 'Walk-in'}"`,
      s.items.reduce((sum, it) => sum + it.quantity, 0),
      s.paymentMode,
      s.paymentStatus,
      s.totalAmount,
      s.totalProfit,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Dukan_Sales_Report_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Range Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
            Sales & Revenue Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track daily bills, monthly growth, profit margins, and Khata ledger
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setDateRange('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              dateRange === 'today' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setDateRange('yesterday')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              dateRange === 'yesterday' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Yesterday
          </button>
          <button
            onClick={() => setDateRange('week')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              dateRange === 'week' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setDateRange('month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              dateRange === 'month' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setDateRange('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              dateRange === 'all' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Revenue
          </span>
          <div className="text-2xl font-extrabold text-white mt-1">
            {currency}{summary.totalRevenue.toLocaleString()}
          </div>
          <p className="text-[11px] text-emerald-400 mt-1 font-medium">
            From {summary.count} transactions ({summary.totalItems} items)
          </p>
        </div>

        {/* Total Net Profit */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Net Profit
          </span>
          <div className="text-2xl font-extrabold text-white mt-1">
            {currency}{summary.totalProfit.toLocaleString()}
          </div>
          <p className="text-[11px] text-teal-400 mt-1 font-semibold">
            {summary.profitMargin}% overall margin
          </p>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Average Bill Value (AOV)
          </span>
          <div className="text-2xl font-extrabold text-white mt-1">
            {currency}{summary.aov}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Per customer visit
          </p>
        </div>

        {/* Udhaar / Khata Pending */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Udhaar / Credit Sales
          </span>
          <div className="text-2xl font-extrabold text-white mt-1">
            {currency}{summary.paymentBreakdown.credit_khata?.total?.toLocaleString() || '0'}
          </div>
          <p className="text-[11px] text-amber-300 mt-1 font-medium">
            {summary.paymentBreakdown.credit_khata?.count || 0} bills pending payment
          </p>
        </div>
      </div>

      {/* Breakdown Grid: Payment Distribution & Top Sellers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Mode Distribution */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Payment Mode Distribution
          </h2>

          <div className="space-y-3">
            {/* Cash */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-emerald-400" /> Cash
                </span>
                <span className="font-bold text-white">
                  {currency}{summary.paymentBreakdown.cash?.total?.toLocaleString() || '0'}{' '}
                  <span className="text-slate-400 font-normal">
                    ({summary.paymentBreakdown.cash?.count || 0})
                  </span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${summary.totalRevenue > 0 ? (summary.paymentBreakdown.cash.total / summary.totalRevenue) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* UPI */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-cyan-400" /> UPI / QR
                </span>
                <span className="font-bold text-white">
                  {currency}{summary.paymentBreakdown.upi?.total?.toLocaleString() || '0'}{' '}
                  <span className="text-slate-400 font-normal">
                    ({summary.paymentBreakdown.upi?.count || 0})
                  </span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full"
                  style={{
                    width: `${summary.totalRevenue > 0 ? (summary.paymentBreakdown.upi.total / summary.totalRevenue) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Udhaar / Khata */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-amber-400" /> Udhaar / Khata
                </span>
                <span className="font-bold text-white">
                  {currency}{summary.paymentBreakdown.credit_khata?.total?.toLocaleString() || '0'}{' '}
                  <span className="text-slate-400 font-normal">
                    ({summary.paymentBreakdown.credit_khata?.count || 0})
                  </span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${summary.totalRevenue > 0 ? (summary.paymentBreakdown.credit_khata.total / summary.totalRevenue) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Card */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-purple-400" /> Card / POS
                </span>
                <span className="font-bold text-white">
                  {currency}{summary.paymentBreakdown.card?.total?.toLocaleString() || '0'}{' '}
                  <span className="text-slate-400 font-normal">
                    ({summary.paymentBreakdown.card?.count || 0})
                  </span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{
                    width: `${summary.totalRevenue > 0 ? (summary.paymentBreakdown.card.total / summary.totalRevenue) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top Selling Products In Period */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-400" />
            Top Selling Products in this Period
          </h2>

          <div className="space-y-2.5">
            {summary.topSelling.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No items sold in the selected time range.
              </p>
            ) : (
              summary.topSelling.map((it, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-slate-800/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-300 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-200">{it.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-400">{it.qty} sold</span>
                    <p className="text-[10px] text-slate-400">{currency}{it.revenue.toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Transaction History Log Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            Transactions History ({filteredSales.length})
          </h2>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bills, customer, item..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48 sm:w-64"
              />
            </div>

            {/* Payment Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">All Modes</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="credit_khata">Udhaar (Khata)</option>
              <option value="card">Card</option>
            </select>

            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              disabled={filteredSales.length === 0}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Export report to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 border-b border-slate-700 text-slate-300 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Bill No</th>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Customer</th>
                <th className="py-2.5 px-3">Items Sold</th>
                <th className="py-2.5 px-3">Payment</th>
                <th className="py-2.5 px-3 text-right">Total Amount</th>
                <th className="py-2.5 px-3 text-right">Profit</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No sales records found for this criteria.
                  </td>
                </tr>
              ) : (
                filteredSales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-white">
                      {s.billNumber}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(s.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                      <span className="text-[10px]">
                        {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200 font-medium">
                      {s.customerName || 'Walk-in'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate">
                      {s.items.map((it) => `${it.quantity}x ${it.productName}`).join(', ')}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        s.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {s.paymentMode.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-extrabold text-white">
                      {currency}{s.totalAmount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right text-teal-400 font-semibold">
                      +{currency}{s.totalProfit.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onSelectSaleForReceipt(s)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white inline-flex items-center gap-1 transition-colors"
                        title="View Receipt"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Receipt</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
