import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Search,
  Download,
  Banknote,
  QrCode,
  BookOpen,
  CreditCard,
  Eye,
  Sparkles,
  AlertTriangle,
  Package,
  RefreshCw,
  Info,
  Calculator,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { useDukan } from '../context/DukanContext';
import { BusinessInsightsResponse, Sale } from '../types';
import {
  computePeriodSummaries,
  computeSalesAnalytics,
  DateRangeFilter,
  filterSalesByCriteria,
} from '../utils/analytics';

interface ReportsViewProps {
  onSelectSaleForReceipt: (sale: Sale) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onSelectSaleForReceipt }) => {
  const { sales, products, profile, lowStockProducts, outOfStockProducts } = useDukan();

  const [dateRange, setDateRange] = useState<DateRangeFilter>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date(Date.now() - 7 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  // Optional Operating Expenses state (Net Profit is ONLY calculated when explicitly provided)
  const [showExpenseInput, setShowExpenseInput] = useState(false);
  const [operatingExpensesInput, setOperatingExpensesInput] = useState<string>('');

  // Chart interactivity state
  const [chartMetric, setChartMetric] = useState<'revenue_profit' | 'cogs_profit' | 'bills'>('revenue_profit');
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);

  // AI Insights state
  const [aiInsights, setAiInsights] = useState<BusinessInsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const currency = profile?.currency || '₹';

  const parsedOperatingExpenses = useMemo(() => {
    const trimmed = operatingExpensesInput.trim();
    if (!trimmed) return null;
    const val = Number(trimmed);
    return !isNaN(val) && val >= 0 ? val : null;
  }, [operatingExpensesInput]);

  // 1. Daily, Weekly, and Monthly summaries (always computed from real sales)
  const periodSummaries = useMemo(() => {
    return computePeriodSummaries(sales, products);
  }, [sales, products]);

  // 2. Filtered sales for the selected range/search/payment
  const filteredSales = useMemo(() => {
    return filterSalesByCriteria(sales, {
      dateRange,
      customStartDate,
      customEndDate,
      searchQuery,
      paymentFilter,
    });
  }, [sales, dateRange, customStartDate, customEndDate, searchQuery, paymentFilter]);

  // 3. Detailed analytics (Revenue, COGS, Gross Profit, Net Profit if op-ex exists, Top 5, Slow-moving, Trends)
  const analytics = useMemo(() => {
    return computeSalesAnalytics(filteredSales, products, {
      allSalesForVelocity: sales,
      operatingExpenses: parsedOperatingExpenses,
      dateRange,
    });
  }, [filteredSales, products, sales, parsedOperatingExpenses, dateRange]);

  // Generate Gemini AI Business Insights grounded strictly in real metrics
  const handleGenerateInsights = async () => {
    if (insightsLoading) return;
    setInsightsLoading(true);
    setInsightsError(null);

    try {
      const payload = {
        dateRange,
        shopContext: {
          shopName: profile?.shopName || 'My Dukan',
          currency,
        },
        inventoryCount: products.length,
        periodSummaries,
        analyticsSummary: {
          totalRevenue: analytics.totalRevenue,
          grossSalesBeforeDiscount: analytics.grossSalesBeforeDiscount,
          totalDiscounts: analytics.totalDiscounts,
          totalCOGS: analytics.totalCOGS,
          grossProfit: analytics.grossProfit,
          grossMarginPercent: analytics.grossMarginPercent,
          operatingExpenses: analytics.operatingExpenses,
          netProfit: analytics.netProfit,
          totalTransactions: analytics.totalTransactions,
          totalItemsSold: analytics.totalItemsSold,
          averageOrderValue: analytics.averageOrderValue,
          incompleteCostItemsCount: analytics.incompleteCostItemsCount,
          creditPendingAmount: analytics.paymentBreakdown.credit_khata?.total || 0,
          creditPendingCount: analytics.paymentBreakdown.credit_khata?.count || 0,
        },
        topSelling: analytics.topSelling,
        slowMoving: analytics.slowMoving,
        lowStockItems: [...outOfStockProducts, ...lowStockProducts].map((p) => ({
          name: p.name,
          stockQuantity: p.stockQuantity,
          minStockThreshold: p.minStockThreshold,
          unit: p.unit,
        })),
      };

      const res = await fetch('/api/gemini/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to generate AI business insights');
      }

      const json = await res.json();
      setAiInsights(json.data);
    } catch (err: any) {
      setInsightsError(err.message || 'Could not reach AI Insights service. Please try again.');
    } finally {
      setInsightsLoading(false);
    }
  };

  // CSV Export (Transactions + Financial Summary)
  const handleExportCSV = (mode: 'transactions' | 'analytics_summary' = 'transactions') => {
    const csvRows: string[] = [];

    if (mode === 'analytics_summary') {
      csvRows.push('Section,Metric,Value');
      csvRows.push(`Period Filter,Selected Range,${dateRange}`);
      csvRows.push(`Financials,Total Sales Revenue,${analytics.totalRevenue}`);
      csvRows.push(`Financials,Gross Sales Before Discount,${analytics.grossSalesBeforeDiscount}`);
      csvRows.push(`Financials,Total Discounts,${analytics.totalDiscounts}`);
      csvRows.push(`Financials,Cost of Goods Sold (COGS),${analytics.totalCOGS}`);
      csvRows.push(`Financials,Gross Profit (Revenue - COGS),${analytics.grossProfit}`);
      csvRows.push(`Financials,Gross Margin %,${analytics.grossMarginPercent}%`);
      csvRows.push(
        `Financials,Operating Expenses,${analytics.operatingExpenses !== null ? analytics.operatingExpenses : 'Not Provided'}`
      );
      csvRows.push(
        `Financials,Net Profit,${analytics.netProfit !== null ? analytics.netProfit : 'Not Calculated (No Operating Expenses)'}`
      );
      csvRows.push(`Daily Summary,Today Revenue,${periodSummaries.today.revenue}`);
      csvRows.push(`Weekly Summary,Last 7 Days Revenue,${periodSummaries.week.revenue}`);
      csvRows.push(`Monthly Summary,This Month Revenue,${periodSummaries.month.revenue}`);
      csvRows.push('');
      csvRows.push('Top Selling Products,Qty Sold,Revenue,COGS,Gross Profit');
      analytics.topSelling.forEach((p) => {
        csvRows.push(`"${p.name}",${p.qtySold},${p.revenue},${p.cogs},${p.grossProfit}`);
      });
      csvRows.push('');
      csvRows.push('Slow Moving Products,Qty Sold,Current Stock,Capital Locked');
      analytics.slowMoving.forEach((p) => {
        csvRows.push(`"${p.name}",${p.qtySold},${p.currentStock},${p.stockValue}`);
      });
    } else {
      if (filteredSales.length === 0) return;
      const headers = [
        'Bill Number',
        'Date & Time',
        'Customer',
        'Items Sold',
        'Items Count',
        'Payment Mode',
        'Status',
        'Subtotal',
        'Discount',
        'Total Revenue',
        'Estimated COGS',
        'Gross Profit',
      ];
      csvRows.push(headers.join(','));
      filteredSales.forEach((s) => {
        const itemsText = (s.items || []).map((it) => `${it.quantity}x ${it.productName}`).join(' | ');
        const itemsQty = (s.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
        const saleCost = (s.items || []).reduce(
          (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.costPrice) || 0),
          0
        );
        const grossProfit = Number((s.totalAmount - saleCost).toFixed(2));
        csvRows.push(
          [
            s.billNumber,
            `"${new Date(s.createdAt).toLocaleString()}"`,
            `"${s.customerName || 'Walk-in'}"`,
            `"${itemsText}"`,
            itemsQty,
            s.paymentMode,
            s.paymentStatus,
            s.subtotal,
            s.discount || 0,
            s.totalAmount,
            saleCost.toFixed(2),
            grossProfit,
          ].join(',')
        );
      });
    }

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Dukan_${mode === 'analytics_summary' ? 'Business_Analytics' : 'Sales_Report'}_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Interactive Chart Scale Computation
  const chartMaxVal = useMemo(() => {
    if (analytics.trendSeries.length === 0) return 100;
    if (chartMetric === 'bills') {
      return Math.max(1, ...analytics.trendSeries.map((pt) => pt.billsCount));
    }
    return Math.max(
      10,
      ...analytics.trendSeries.map((pt) => Math.max(pt.revenue, pt.cogs, Math.abs(pt.grossProfit)))
    );
  }, [analytics.trendSeries, chartMetric]);

  return (
    <div className="space-y-6">
      {/* Header & Date Filter Controls */}
      <div className="bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
              <BarChart3 className="w-6 h-6 text-emerald-400" />
              Business Insights & Profit Analytics
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Real-time revenue, COGS, gross profit, product velocity, and Gemini AI advisory grounded in your actual sales & inventory
            </p>
          </div>

          {/* Date Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700 overflow-x-auto no-scrollbar">
            {(
              [
                { key: 'today', label: 'Today' },
                { key: 'yesterday', label: 'Yesterday' },
                { key: 'week', label: 'Last 7 Days' },
                { key: 'month', label: 'This Month' },
                { key: 'custom', label: 'Custom Range' },
                { key: 'all', label: 'All Time' },
              ] as { key: DateRangeFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setDateRange(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  dateRange === tab.key
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Range Pickers */}
        {dateRange === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold">From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <span className="font-semibold">To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Daily, Weekly & Monthly Sales Summaries Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            data: periodSummaries.today,
            accent: 'border-cyan-500/40 bg-gradient-to-br from-slate-900 to-cyan-950/20',
            badge: 'text-cyan-400',
            rangeKey: 'today' as DateRangeFilter,
          },
          {
            data: periodSummaries.week,
            accent: 'border-emerald-500/40 bg-gradient-to-br from-slate-900 to-emerald-950/20',
            badge: 'text-emerald-400',
            rangeKey: 'week' as DateRangeFilter,
          },
          {
            data: periodSummaries.month,
            accent: 'border-blue-500/40 bg-gradient-to-br from-slate-900 to-blue-950/20',
            badge: 'text-blue-400',
            rangeKey: 'month' as DateRangeFilter,
          },
        ].map((card) => (
          <button
            key={card.rangeKey}
            onClick={() => setDateRange(card.rangeKey)}
            className={`text-left p-4 rounded-2xl border ${card.accent} hover:brightness-110 transition-all`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${card.badge}`}>
                {card.data.label}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {card.data.billsCount} bills • {card.data.itemsCount} items
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-white">
                {currency}{card.data.revenue.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-emerald-400">
                Gross Profit: {currency}{card.data.grossProfit.toLocaleString()} ({card.data.grossMarginPercent}%)
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Incomplete Cost Data Caution Banner (when historical items lack cost data) */}
      {analytics.incompleteCostItemsCount > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Note: {analytics.incompleteCostItemsCount} sold item record(s) in this range had missing purchase cost data; COGS for those items defaulted to ₹0 instead of guessing.
          </span>
        </div>
      )}

      {/* Core Financial Distinction KPI Cards (Revenue vs COGS vs Gross Profit vs Net Profit) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Sales Revenue */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
              Sales Revenue
            </span>
            <DollarSign className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-1.5">
            {currency}{analytics.totalRevenue.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {analytics.totalTransactions} bills • AOV {currency}{analytics.averageOrderValue}
            {analytics.totalDiscounts > 0 && ` • Discounts: -${currency}${analytics.totalDiscounts}`}
          </p>
        </div>

        {/* 2. Cost of Goods Sold (COGS) */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
              Cost of Goods Sold (COGS)
            </span>
            <Package className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-1.5">
            {currency}{analytics.totalCOGS.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Actual purchase cost × {analytics.totalItemsSold} sold units
          </p>
        </div>

        {/* 3. Gross Profit */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Gross Profit
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className={`text-2xl font-extrabold mt-1.5 ${analytics.grossProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {currency}{analytics.grossProfit.toLocaleString()}
          </div>
          <p className="text-[11px] text-teal-300 mt-1 font-semibold">
            Revenue − COGS • {analytics.grossMarginPercent}% gross margin
          </p>
        </div>

        {/* 4. Net Profit (Strictly separated — only computed if operating expenses entered) */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Net Profit
            </span>
            <button
              onClick={() => setShowExpenseInput(!showExpenseInput)}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold flex items-center gap-1"
            >
              <Calculator className="w-3 h-3" />
              {analytics.operatingExpenses !== null ? 'Edit OpEx' : '+ Add OpEx'}
            </button>
          </div>

          {analytics.netProfit !== null ? (
            <>
              <div className={`text-2xl font-extrabold mt-1.5 ${analytics.netProfit >= 0 ? 'text-white' : 'text-rose-400'}`}>
                {currency}{analytics.netProfit.toLocaleString()}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Gross Profit − {currency}{analytics.operatingExpenses?.toLocaleString()} OpEx ({analytics.netMarginPercent}% net margin)
              </p>
            </>
          ) : (
            <>
              <div className="text-lg font-bold text-slate-400 mt-2">
                Not Calculated
              </div>
              <p className="text-[11px] text-slate-500 mt-1 flex items-start gap-1">
                <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                <span>Requires operating expenses (rent, utilities, salaries)</span>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Optional Operating Expenses Calculator Bar */}
      {showExpenseInput && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <p className="font-bold text-white flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-cyan-400" />
              Operating Expenses for Selected Period (Optional)
            </p>
            <p className="text-slate-400 mt-0.5">
              Enter actual rent, electricity, transport, or staff wages to compute Net Profit (Gross Profit − Operating Expenses). Clear input to keep Net Profit uncalculated.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-slate-300 font-bold">{currency}</span>
            <input
              type="number"
              min="0"
              step="10"
              value={operatingExpensesInput}
              onChange={(e) => setOperatingExpensesInput(e.target.value)}
              placeholder="e.g. 500"
              className="w-32 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            {operatingExpensesInput && (
              <button
                onClick={() => setOperatingExpensesInput('')}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Interactive Sales Trend Chart & Payment Mode Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Chart (2 columns wide) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                Interactive Sales & Profit Trend
              </h2>
              <p className="text-[11px] text-slate-400">
                Hover bars for exact Revenue, COGS, Gross Profit, and Bill counts
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 text-[11px]">
              <button
                onClick={() => setChartMetric('revenue_profit')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  chartMetric === 'revenue_profit' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Revenue & Profit
              </button>
              <button
                onClick={() => setChartMetric('cogs_profit')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  chartMetric === 'cogs_profit' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                COGS vs Margin
              </button>
              <button
                onClick={() => setChartMetric('bills')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  chartMetric === 'bills' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Bills Volume
              </button>
            </div>
          </div>

          {analytics.trendSeries.length === 0 ? (
            <div className="h-56 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 flex flex-col items-center justify-center text-slate-400 text-xs">
              <BarChart3 className="w-8 h-8 text-slate-600 mb-2" />
              <p>No sales transactions available for the selected date range.</p>
            </div>
          ) : (
            <div className="relative pt-4">
              {/* Interactive Tooltip Card */}
              {hoveredTrendIdx !== null && analytics.trendSeries[hoveredTrendIdx] && (
                <div className="mb-3 p-3 rounded-xl bg-slate-950 border border-cyan-500/40 flex flex-wrap items-center justify-between gap-4 text-xs shadow-lg">
                  <span className="font-bold text-white">
                    {analytics.trendSeries[hoveredTrendIdx].label}
                  </span>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-cyan-400 font-semibold">
                      Revenue: {currency}{analytics.trendSeries[hoveredTrendIdx].revenue.toLocaleString()}
                    </span>
                    <span className="text-blue-400 font-semibold">
                      COGS: {currency}{analytics.trendSeries[hoveredTrendIdx].cogs.toLocaleString()}
                    </span>
                    <span className="text-emerald-400 font-semibold">
                      Gross Profit: {currency}{analytics.trendSeries[hoveredTrendIdx].grossProfit.toLocaleString()}
                    </span>
                    <span className="text-slate-300">
                      {analytics.trendSeries[hoveredTrendIdx].billsCount} bill(s)
                    </span>
                  </div>
                </div>
              )}

              {/* Interactive Bar Chart */}
              <div className="h-52 flex items-end gap-2 sm:gap-3 px-2 pt-4 pb-2 bg-slate-950/50 rounded-xl border border-slate-800/80 overflow-x-auto">
                {analytics.trendSeries.map((pt, idx) => {
                  const primaryVal =
                    chartMetric === 'bills'
                      ? pt.billsCount
                      : chartMetric === 'cogs_profit'
                      ? pt.cogs
                      : pt.revenue;
                  const secondaryVal =
                    chartMetric === 'bills'
                      ? 0
                      : pt.grossProfit;

                  const primaryPct = Math.max(6, Math.round((primaryVal / chartMaxVal) * 100));
                  const secondaryPct =
                    secondaryVal > 0 ? Math.max(4, Math.round((secondaryVal / chartMaxVal) * 100)) : 0;
                  const isHovered = hoveredTrendIdx === idx;

                  return (
                    <div
                      key={pt.dateKey}
                      onMouseEnter={() => setHoveredTrendIdx(idx)}
                      onMouseLeave={() => setHoveredTrendIdx(null)}
                      onClick={() => setHoveredTrendIdx(isHovered ? null : idx)}
                      className={`flex-1 min-w-[44px] h-full flex flex-col justify-end items-center gap-1.5 cursor-pointer rounded-lg p-1 transition-colors ${
                        isHovered ? 'bg-slate-800/70' : 'hover:bg-slate-800/30'
                      }`}
                    >
                      <div className="w-full flex items-end justify-center gap-1 flex-1">
                        <div
                          className={`w-3.5 sm:w-5 rounded-t-md transition-all duration-300 ${
                            chartMetric === 'bills'
                              ? 'bg-blue-500'
                              : chartMetric === 'cogs_profit'
                              ? 'bg-blue-500/80'
                              : 'bg-cyan-500'
                          }`}
                          style={{ height: `${primaryPct}%` }}
                          title={`${pt.label}: ${chartMetric === 'bills' ? `${primaryVal} bills` : `${currency}${primaryVal}`}`}
                        />
                        {chartMetric !== 'bills' && (
                          <div
                            className="w-3 sm:w-4 rounded-t-md bg-emerald-500 transition-all duration-300"
                            style={{ height: `${secondaryPct}%` }}
                            title={`Gross Profit: ${currency}${secondaryVal}`}
                          />
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                        {pt.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-2.5 flex items-center justify-end gap-4 text-[11px] text-slate-400">
                {chartMetric === 'bills' ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Transactions Count
                  </span>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-sm ${chartMetric === 'cogs_profit' ? 'bg-blue-500' : 'bg-cyan-500'}`} />
                      {chartMetric === 'cogs_profit' ? 'COGS (Product Cost)' : 'Sales Revenue'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Gross Profit
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Payment Mode Distribution */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Payment Mode Distribution
          </h2>

          <div className="space-y-3.5">
            {[
              { key: 'cash', label: 'Cash', icon: <Banknote className="w-4 h-4 text-emerald-400" />, bar: 'bg-emerald-500' },
              { key: 'upi', label: 'UPI / QR', icon: <QrCode className="w-4 h-4 text-cyan-400" />, bar: 'bg-cyan-500' },
              { key: 'credit_khata', label: 'Udhaar / Khata', icon: <BookOpen className="w-4 h-4 text-amber-400" />, bar: 'bg-amber-500' },
              { key: 'card', label: 'Card / POS', icon: <CreditCard className="w-4 h-4 text-blue-400" />, bar: 'bg-blue-500' },
            ].map((m) => {
              const info = analytics.paymentBreakdown[m.key] || { count: 0, total: 0 };
              const pct = analytics.totalRevenue > 0 ? (info.total / analytics.totalRevenue) * 100 : 0;
              return (
                <div key={m.key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      {m.icon} {m.label}
                    </span>
                    <span className="font-bold text-white">
                      {currency}{info.total.toLocaleString()}{' '}
                      <span className="text-slate-400 font-normal">({info.count})</span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className={`h-full ${m.bar} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top 5 Best-Selling & Slow-Moving Products */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top 5 Best-Selling Products */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Top 5 Best-Selling Products
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
              In Selected Period
            </span>
          </div>

          <div className="space-y-2.5">
            {analytics.topSelling.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">
                No product sales recorded in the selected date range.
              </p>
            ) : (
              analytics.topSelling.map((it, idx) => (
                <div key={it.productId} className="p-3 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-[11px] shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">{it.name}</p>
                      <p className="text-[10px] text-slate-400">
                        COGS: {currency}{it.cogs.toLocaleString()} • Gross Profit: <span className="text-emerald-400 font-semibold">+{currency}{it.grossProfit.toLocaleString()}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <span className="font-bold text-emerald-400">{it.qtySold} {it.unit}</span>
                    <p className="text-[10px] text-slate-300 font-semibold">{currency}{it.revenue.toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Slow-Moving Products Panel */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-amber-400" />
              Slow-Moving Stock (Sales History)
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-semibold border border-amber-500/20">
              Needs Promotion / Review
            </span>
          </div>

          <div className="space-y-2.5">
            {analytics.slowMoving.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">
                All stocked products have healthy movement based on available sales history.
              </p>
            ) : (
              analytics.slowMoving.map((it) => (
                <div key={it.productId} className="p-3 rounded-xl bg-slate-800/50 border border-amber-500/20 flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{it.name}</p>
                    <p className="text-[10px] text-slate-400">
                      On Hand: {it.currentStock} {it.unit} • Capital Tied: <span className="text-amber-300 font-semibold">{currency}{it.stockValue.toLocaleString()}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      it.qtySold === 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      {it.qtySold === 0 ? '0 sold' : `${it.qtySold} sold`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Gemini AI-Powered Business Insights & Advisory Panel */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/30 border border-cyan-500/30 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Gemini AI Business Insights & Advisory
                {aiInsights?.mode && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-mono border border-cyan-500/30">
                    {aiInsights.mode === 'gemini_3.8_flash' ? 'Gemini 3.8 Flash' : 'Smart Analysis'}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Actionable stock management & profitability recommendations derived strictly from your real POS & inventory data
              </p>
            </div>
          </div>

          <button
            onClick={handleGenerateInsights}
            disabled={insightsLoading}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all disabled:opacity-60 shrink-0"
          >
            {insightsLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Analyzing Shop Data...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{aiInsights ? 'Refresh AI Insights' : 'Generate AI Business Insights'}</span>
              </>
            )}
          </button>
        </div>

        {insightsError && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-xs">
            {insightsError}
          </div>
        )}

        {!aiInsights && !insightsLoading && (
          <div className="p-5 rounded-xl bg-slate-950/50 border border-dashed border-slate-800 text-center space-y-2">
            <Layers className="w-7 h-7 text-cyan-400 mx-auto opacity-80" />
            <p className="text-xs text-slate-300 font-medium">
              Click <strong>"Generate AI Business Insights"</strong> to analyze your current period revenue, COGS, gross margins, slow-moving capital, and restock priorities with Gemini.
            </p>
          </div>
        )}

        {aiInsights && (
          <div className="space-y-4">
            {/* Executive Summary */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 leading-relaxed">
              <span className="font-bold text-cyan-400 block mb-1 uppercase tracking-wider text-[10px]">
                Executive Summary
              </span>
              {aiInsights.executiveSummary}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Highlights */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h3 className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Key Highlights
                </h3>
                <ul className="space-y-1.5 text-slate-300 list-disc pl-4">
                  {aiInsights.keyHighlights?.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>

              {/* Stock Management */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-emerald-500/20 space-y-2">
                <h3 className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  Stock Management Actions
                </h3>
                <ul className="space-y-1.5 text-slate-300 list-disc pl-4">
                  {aiInsights.stockManagementSuggestions?.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>

              {/* Profitability */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-blue-500/20 space-y-2">
                <h3 className="font-bold text-blue-400 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  Profitability Suggestions
                </h3>
                <ul className="space-y-1.5 text-slate-300 list-disc pl-4">
                  {aiInsights.profitabilitySuggestions?.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>

            {aiInsights.warnings && aiInsights.warnings.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  {aiInsights.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction History Log Table & CSV Exports */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            Transactions History ({filteredSales.length})
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bills, customer, item..."
                className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44 sm:w-56"
              />
            </div>

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

            <button
              onClick={() => handleExportCSV('transactions')}
              disabled={filteredSales.length === 0}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Export filtered sales bills to CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Sales CSV</span>
            </button>

            <button
              onClick={() => handleExportCSV('analytics_summary')}
              className="px-3 py-1.5 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Export Revenue, COGS, Gross Profit & Product Performance CSV"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export Summary CSV</span>
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
                <th className="py-2.5 px-3 text-right">Revenue</th>
                <th className="py-2.5 px-3 text-right">Gross Profit</th>
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
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          s.paymentStatus === 'paid'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
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
