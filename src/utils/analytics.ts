import { Product, Sale } from '../types';

export type DateRangeFilter = 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all';

export interface ProductSalesMetric {
  productId: string;
  name: string;
  category: string;
  unit: string;
  qtySold: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  currentStock: number;
  stockValue: number;
}

export interface PeriodSummary {
  label: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPercent: number;
  billsCount: number;
  itemsCount: number;
}

export interface TrendPoint {
  dateKey: string;
  label: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  billsCount: number;
}

export interface ComputedAnalytics {
  totalRevenue: number;
  grossSalesBeforeDiscount: number;
  totalDiscounts: number;
  totalCOGS: number;
  grossProfit: number;
  grossMarginPercent: number;
  operatingExpenses: number | null;
  netProfit: number | null;
  netMarginPercent: number | null;
  totalTransactions: number;
  totalItemsSold: number;
  averageOrderValue: number;
  incompleteCostItemsCount: number;
  paymentBreakdown: Record<string, { count: number; total: number }>;
  topSelling: ProductSalesMetric[];
  slowMoving: ProductSalesMetric[];
  trendSeries: TrendPoint[];
  categoryBreakdown: { category: string; revenue: number; cogs: number; grossProfit: number; qty: number }[];
}

export function filterSalesByCriteria(
  sales: Sale[],
  options: {
    dateRange: DateRangeFilter;
    customStartDate?: string;
    customEndDate?: string;
    searchQuery?: string;
    paymentFilter?: string;
    now?: Date;
  }
): Sale[] {
  const now = options.now || new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000; // Last 7 days inclusive of today
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const customStartMs = options.customStartDate
    ? new Date(`${options.customStartDate}T00:00:00`).getTime()
    : null;
  const customEndMs = options.customEndDate
    ? new Date(`${options.customEndDate}T23:59:59.999`).getTime()
    : null;

  const queryLower = (options.searchQuery || '').trim().toLowerCase();
  const paymentFilter = options.paymentFilter || 'all';

  return sales.filter((s) => {
    const saleTime = new Date(s.createdAt).getTime();
    if (isNaN(saleTime)) return false;

    let matchesDate = true;
    if (options.dateRange === 'today') {
      matchesDate = saleTime >= todayStart;
    } else if (options.dateRange === 'yesterday') {
      matchesDate = saleTime >= yesterdayStart && saleTime < todayStart;
    } else if (options.dateRange === 'week') {
      matchesDate = saleTime >= weekStart;
    } else if (options.dateRange === 'month') {
      matchesDate = saleTime >= monthStart;
    } else if (options.dateRange === 'custom') {
      if (customStartMs !== null && !isNaN(customStartMs) && saleTime < customStartMs) {
        matchesDate = false;
      }
      if (customEndMs !== null && !isNaN(customEndMs) && saleTime > customEndMs) {
        matchesDate = false;
      }
    }

    const matchesSearch =
      !queryLower ||
      (s.billNumber || '').toLowerCase().includes(queryLower) ||
      (s.customerName || '').toLowerCase().includes(queryLower) ||
      (s.items || []).some((it) => (it.productName || '').toLowerCase().includes(queryLower));

    const matchesPayment = paymentFilter === 'all' || s.paymentMode === paymentFilter;

    return matchesDate && matchesSearch && matchesPayment;
  });
}

/**
 * Resolves exact unit cost for a SaleItem using recorded item costPrice first,
 * falling back to product catalog costPrice if missing from historical record.
 */
function resolveItemCost(
  item: { productId?: string; productName?: string; costPrice?: number },
  productById: Map<string, Product>,
  productByName: Map<string, Product>
): { unitCost: number; missingCost: boolean } {
  if (typeof item.costPrice === 'number' && !isNaN(item.costPrice) && item.costPrice >= 0) {
    return { unitCost: item.costPrice, missingCost: false };
  }
  const prod =
    (item.productId ? productById.get(item.productId) : undefined) ||
    (item.productName ? productByName.get(item.productName.toLowerCase()) : undefined);

  if (prod && typeof prod.costPrice === 'number' && !isNaN(prod.costPrice) && prod.costPrice >= 0) {
    return { unitCost: prod.costPrice, missingCost: false };
  }

  return { unitCost: 0, missingCost: true };
}

export function computeSalesAnalytics(
  filteredSales: Sale[],
  allProducts: Product[],
  options?: {
    allSalesForVelocity?: Sale[];
    operatingExpenses?: number | null;
    dateRange?: DateRangeFilter;
  }
): ComputedAnalytics {
  const productById = new Map<string, Product>();
  const productByName = new Map<string, Product>();
  allProducts.forEach((p) => {
    productById.set(p.id, p);
    productByName.set(p.name.toLowerCase(), p);
  });

  let totalRevenue = 0;
  let grossSalesBeforeDiscount = 0;
  let totalDiscounts = 0;
  let totalCOGS = 0;
  let totalItemsSold = 0;
  let incompleteCostItemsCount = 0;

  const paymentBreakdown: Record<string, { count: number; total: number }> = {
    cash: { count: 0, total: 0 },
    upi: { count: 0, total: 0 },
    credit_khata: { count: 0, total: 0 },
    card: { count: 0, total: 0 },
  };

  const productStatsMap = new Map<string, ProductSalesMetric>();
  const categoryStatsMap = new Map<string, { category: string; revenue: number; cogs: number; grossProfit: number; qty: number }>();
  const trendMap = new Map<string, TrendPoint>();

  const useHourlyBuckets = options?.dateRange === 'today' || options?.dateRange === 'yesterday';

  for (const sale of filteredSales) {
    const saleAmount = Number(sale.totalAmount) || 0;
    const saleSubtotal = Number(sale.subtotal) || saleAmount;
    const saleDiscount = Number(sale.discount) || Math.max(0, saleSubtotal - saleAmount);

    totalRevenue += saleAmount;
    grossSalesBeforeDiscount += saleSubtotal;
    totalDiscounts += saleDiscount;

    const mode = sale.paymentMode || 'cash';
    if (!paymentBreakdown[mode]) {
      paymentBreakdown[mode] = { count: 0, total: 0 };
    }
    paymentBreakdown[mode].count += 1;
    paymentBreakdown[mode].total = Number((paymentBreakdown[mode].total + saleAmount).toFixed(2));

    let saleCOGS = 0;
    const discountRatio = saleSubtotal > 0 ? saleAmount / saleSubtotal : 1;

    const items = Array.isArray(sale.items) ? sale.items : [];
    for (const it of items) {
      const qty = Number(it.quantity) || 0;
      if (qty <= 0) continue;

      const lineGross = Number(it.totalPrice) || qty * (Number(it.unitPrice) || 0);
      const effectiveLineRevenue = lineGross * discountRatio;

      const { unitCost, missingCost } = resolveItemCost(it, productById, productByName);
      if (missingCost) incompleteCostItemsCount += 1;
      const lineCost = qty * unitCost;
      const lineGrossProfit = effectiveLineRevenue - lineCost;

      saleCOGS += lineCost;
      totalItemsSold += qty;

      const matchedProd =
        (it.productId ? productById.get(it.productId) : undefined) ||
        (it.productName ? productByName.get(it.productName.toLowerCase()) : undefined);

      const statKey = matchedProd?.id || it.productId || it.productName || 'unknown';
      const existingStat = productStatsMap.get(statKey);
      if (existingStat) {
        existingStat.qtySold += qty;
        existingStat.revenue += effectiveLineRevenue;
        existingStat.cogs += lineCost;
        existingStat.grossProfit += lineGrossProfit;
      } else {
        productStatsMap.set(statKey, {
          productId: statKey,
          name: matchedProd?.name || it.productName || 'Unknown Item',
          category: matchedProd?.category || 'General',
          unit: matchedProd?.unit || it.unit || 'pcs',
          qtySold: qty,
          revenue: effectiveLineRevenue,
          cogs: lineCost,
          grossProfit: lineGrossProfit,
          currentStock: matchedProd?.stockQuantity || 0,
          stockValue: (matchedProd?.stockQuantity || 0) * (matchedProd?.costPrice || 0),
        });
      }

      const categoryName = matchedProd?.category || 'General';
      const catEntry = categoryStatsMap.get(categoryName) || {
        category: categoryName,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        qty: 0,
      };
      catEntry.revenue += effectiveLineRevenue;
      catEntry.cogs += lineCost;
      catEntry.grossProfit += lineGrossProfit;
      catEntry.qty += qty;
      categoryStatsMap.set(categoryName, catEntry);
    }

    totalCOGS += saleCOGS;
    const saleGrossProfit = saleAmount - saleCOGS;

    // Trend series grouping
    const d = new Date(sale.createdAt);
    if (!isNaN(d.getTime())) {
      let dateKey: string;
      let label: string;
      if (useHourlyBuckets) {
        const hr = d.getHours();
        dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(hr).padStart(2, '0')}`;
        const ampm = hr >= 12 ? 'PM' : 'AM';
        const hr12 = hr % 12 === 0 ? 12 : hr % 12;
        label = `${hr12} ${ampm}`;
      } else {
        dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }

      const existingPoint = trendMap.get(dateKey) || {
        dateKey,
        label,
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        billsCount: 0,
      };
      existingPoint.revenue += saleAmount;
      existingPoint.cogs += saleCOGS;
      existingPoint.grossProfit += saleGrossProfit;
      existingPoint.billsCount += 1;
      trendMap.set(dateKey, existingPoint);
    }
  }

  totalRevenue = Number(totalRevenue.toFixed(2));
  grossSalesBeforeDiscount = Number(grossSalesBeforeDiscount.toFixed(2));
  totalDiscounts = Number(totalDiscounts.toFixed(2));
  totalCOGS = Number(totalCOGS.toFixed(2));
  const grossProfit = Number((totalRevenue - totalCOGS).toFixed(2));
  const grossMarginPercent = totalRevenue > 0 ? Number(((grossProfit / totalRevenue) * 100).toFixed(1)) : 0;

  // CRITICAL: Do NOT calculate net profit unless operating expenses are explicitly available
  const hasOperatingExpenses =
    options?.operatingExpenses !== null &&
    options?.operatingExpenses !== undefined &&
    !isNaN(options.operatingExpenses) &&
    options.operatingExpenses >= 0;

  const operatingExpenses = hasOperatingExpenses ? Number(options!.operatingExpenses!.toFixed(2)) : null;
  const netProfit = operatingExpenses !== null ? Number((grossProfit - operatingExpenses).toFixed(2)) : null;
  const netMarginPercent =
    netProfit !== null && totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : null;

  const averageOrderValue =
    filteredSales.length > 0 ? Number((totalRevenue / filteredSales.length).toFixed(2)) : 0;

  // Top 5 Best-Selling Products in filtered period
  const topSelling = Array.from(productStatsMap.values())
    .map((m) => ({
      ...m,
      revenue: Number(m.revenue.toFixed(2)),
      cogs: Number(m.cogs.toFixed(2)),
      grossProfit: Number(m.grossProfit.toFixed(2)),
    }))
    .sort((a, b) => b.qtySold - a.qtySold || b.revenue - a.revenue)
    .slice(0, 5);

  // Slow-Moving Products using available sales history (allSalesForVelocity or filteredSales)
  const historySales = options?.allSalesForVelocity || filteredSales;
  const historySalesByProd = new Map<string, { qty: number; revenue: number }>();
  if (historySales.length > 0) {
    for (const s of historySales) {
      for (const it of s.items || []) {
        const matchedProd =
          (it.productId ? productById.get(it.productId) : undefined) ||
          (it.productName ? productByName.get(it.productName.toLowerCase()) : undefined);
        const key = matchedProd?.id || it.productId;
        if (key) {
          const prev = historySalesByProd.get(key) || { qty: 0, revenue: 0 };
          prev.qty += Number(it.quantity) || 0;
          prev.revenue += Number(it.totalPrice) || 0;
          historySalesByProd.set(key, prev);
        }
      }
    }
  }

  // Only identify slow-moving products if we actually have products in inventory (and ideally sales history context)
  const slowMoving: ProductSalesMetric[] = allProducts
    .filter((p) => p.stockQuantity > 0)
    .map((p) => {
      const sold = historySalesByProd.get(p.id) || { qty: 0, revenue: 0 };
      const cogs = sold.qty * p.costPrice;
      return {
        productId: p.id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        qtySold: sold.qty,
        revenue: Number(sold.revenue.toFixed(2)),
        cogs: Number(cogs.toFixed(2)),
        grossProfit: Number((sold.revenue - cogs).toFixed(2)),
        currentStock: p.stockQuantity,
        stockValue: Number((p.stockQuantity * p.costPrice).toFixed(2)),
      };
    })
    .filter((m) => m.qtySold <= 2)
    .sort((a, b) => a.qtySold - b.qtySold || b.stockValue - a.stockValue)
    .slice(0, 5);

  const trendSeries = Array.from(trendMap.values())
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map((pt) => ({
      ...pt,
      revenue: Number(pt.revenue.toFixed(2)),
      cogs: Number(pt.cogs.toFixed(2)),
      grossProfit: Number(pt.grossProfit.toFixed(2)),
    }));

  const categoryBreakdown = Array.from(categoryStatsMap.values())
    .map((c) => ({
      ...c,
      revenue: Number(c.revenue.toFixed(2)),
      cogs: Number(c.cogs.toFixed(2)),
      grossProfit: Number(c.grossProfit.toFixed(2)),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    totalRevenue,
    grossSalesBeforeDiscount,
    totalDiscounts,
    totalCOGS,
    grossProfit,
    grossMarginPercent,
    operatingExpenses,
    netProfit,
    netMarginPercent,
    totalTransactions: filteredSales.length,
    totalItemsSold,
    averageOrderValue,
    incompleteCostItemsCount,
    paymentBreakdown,
    topSelling,
    slowMoving,
    trendSeries,
    categoryBreakdown,
  };
}

export function computePeriodSummaries(
  allSales: Sale[],
  allProducts: Product[],
  now: Date = new Date()
): { today: PeriodSummary; week: PeriodSummary; month: PeriodSummary } {
  const build = (range: DateRangeFilter, label: string): PeriodSummary => {
    const subset = filterSalesByCriteria(allSales, { dateRange: range, now });
    const stats = computeSalesAnalytics(subset, allProducts, { dateRange: range });
    return {
      label,
      revenue: stats.totalRevenue,
      cogs: stats.totalCOGS,
      grossProfit: stats.grossProfit,
      grossMarginPercent: stats.grossMarginPercent,
      billsCount: stats.totalTransactions,
      itemsCount: stats.totalItemsSold,
    };
  };

  return {
    today: build('today', 'Daily (Today)'),
    week: build('week', 'Weekly (Last 7 Days)'),
    month: build('month', 'Monthly (This Month)'),
  };
}
