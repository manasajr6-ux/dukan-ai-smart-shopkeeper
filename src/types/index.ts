export interface UserProfile {
  userId: string;
  shopName: string;
  ownerName: string;
  phone?: string;
  currency: string;
  lowStockThresholdDefault: number;
  createdAt: string;
}

export interface Product {
  id: string;
  userId: string;
  name: string;
  category: string;
  barcode?: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  minStockThreshold: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
}

export interface RestockRecommendation {
  productId: string;
  productName: string;
  category: string;
  currentStock: number;
  minThreshold: number;
  unit: string;
  status: 'out_of_stock' | 'low_stock';
  suggestedReorderQuantity: number;
  salesVelocityReason: string;
  recentSalesCount: number;
  averageDailySales: number;
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  costPrice: number;
  totalPrice: number;
}

export type PaymentMode = 'cash' | 'upi' | 'credit_khata' | 'card';
export type PaymentStatus = 'paid' | 'pending_credit';

export interface Sale {
  id: string;
  userId: string;
  billNumber: string;
  customerName?: string;
  customerPhone?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  totalProfit: number;
  paymentMode: PaymentMode;
  paymentStatus: PaymentStatus;
  notes?: string;
  createdAt: string;
}

export interface AICommandItem {
  matchedProductId?: string;
  productName: string;
  quantity: number;
  unit?: string;
  unitPrice?: number;
}

export interface AICommandResponse {
  intent: 'RECORD_SALE' | 'ADD_PRODUCT' | 'UPDATE_PRODUCT' | 'DELETE_PRODUCT' | 'QUERY_INFO' | 'CONVERSATIONAL';
  confidence?: number;
  speechResponse: string;
  saleData?: {
    customerName?: string;
    customerPhone?: string;
    paymentMode?: PaymentMode;
    paymentStatus?: PaymentStatus;
    notes?: string;
    items?: AICommandItem[];
  };
  productData?: {
    name: string;
    category?: string;
    costPrice?: number;
    sellingPrice: number;
    stockQuantity: number;
    minStockThreshold?: number;
    unit?: string;
    barcode?: string;
  };
  updateData?: {
    matchedProductId?: string;
    productName?: string;
    stockAdjustmentType?: 'set' | 'add' | 'subtract';
    stockQuantity?: number;
    newSellingPrice?: number;
    newCostPrice?: number;
  };
  deleteData?: {
    matchedProductId?: string;
    productName?: string;
  };
  queryAnswer?: string;
}

export interface SalesReportSummary {
  todayRevenue: number;
  todayProfit: number;
  todaySalesCount: number;
  todayItemsCount: number;
  monthRevenue: number;
  monthProfit: number;
  monthSalesCount: number;
  totalRevenue: number;
  totalProfit: number;
  totalSalesCount: number;
  lowStockItemsCount: number;
  outOfStockItemsCount: number;
  topSellingProducts: { name: string; quantity: number; revenue: number }[];
  paymentModeBreakdown: { mode: string; count: number; total: number }[];
}
