import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  Banknote,
  QrCode,
  BookOpen,
  CreditCard,
  CheckCircle,
  Receipt,
  User,
  Phone,
  AlertCircle,
  Package,
  Sparkles,
  Barcode,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useDukan } from '../context/DukanContext';
import { Product, PaymentMode, Sale } from '../types';
import { CATEGORIES } from '../data/seedData';

interface PosViewProps {
  onSaleCompleted: (sale: Sale) => void;
  onOpenVoiceModal: () => void;
}

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

export const PosView: React.FC<PosViewProps> = ({ onSaleCompleted, onOpenVoiceModal }) => {
  const { products, recordSale, profile, speakText } = useDukan();

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Customer & Bill
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number | string>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [notes, setNotes] = useState('');

  // Status & Validation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // UPI QR Modal state
  const [showUpiModal, setShowUpiModal] = useState(false);

  const currency = profile?.currency || '₹';

  // Available catalog filtered
  const availableProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchTerm)) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Cart Totals
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }, [cart]);

  const totalCost = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity * item.product.costPrice, 0);
  }, [cart]);

  const discountAmount = Math.max(0, Number(discount) || 0);
  const finalTotal = Math.max(0, subtotal - discountAmount);
  const projectedProfit = Math.max(0, finalTotal - totalCost);

  // Add Item to Cart
  const addToCart = (product: Product) => {
    setErrorMsg(null);
    if (product.stockQuantity <= 0) {
      setErrorMsg(`"${product.name}" is currently out of stock.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((it) => it.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          setErrorMsg(`Only ${product.stockQuantity} ${product.unit} available in stock!`);
          return prev;
        }
        return prev.map((it) =>
          it.product.id === product.id ? { ...it, quantity: it.quantity + 1 } : it
        );
      } else {
        return [...prev, { product, quantity: 1, unitPrice: product.sellingPrice }];
      }
    });
  };

  const updateCartQty = (productId: string, newQty: number) => {
    setErrorMsg(null);
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQty > prod.stockQuantity) {
      setErrorMsg(`Cannot add more than ${prod.stockQuantity} ${prod.unit} of "${prod.name}"`);
      return;
    }

    setCart((prev) =>
      prev.map((it) => (it.product.id === productId ? { ...it, quantity: newQty } : it))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((it) => it.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscount(0);
    setNotes('');
    setErrorMsg(null);
  };

  // Submit Sale
  const handleCompleteSale = async () => {
    setErrorMsg(null);

    // Validation
    if (cart.length === 0) {
      setErrorMsg('Cart is empty. Add at least one product before saving.');
      return;
    }

    // Verify stock availability
    for (const item of cart) {
      const latestProd = products.find((p) => p.id === item.product.id);
      if (!latestProd || item.quantity > latestProd.stockQuantity) {
        setErrorMsg(
          `Insufficient stock for "${item.product.name}". Available: ${latestProd?.stockQuantity || 0}`
        );
        return;
      }
      if (item.unitPrice < 0) {
        setErrorMsg(`Unit price for "${item.product.name}" cannot be negative.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const createdSale = await recordSale({
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim(),
        items: cart.map((it) => ({
          productId: it.product.id,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        })),
        discount: discountAmount,
        paymentMode,
        paymentStatus: paymentMode === 'credit_khata' ? 'pending_credit' : 'paid',
        notes: notes.trim(),
      });

      // Confetti celebration
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // silent confetti fail
      }

      speakText(`Sale of ${currency}${finalTotal} completed via ${paymentMode.replace('_', ' ')}.`);
      clearCart();
      onSaleCompleted(createdSale);
    } catch (err: any) {
      console.error('Sale creation error:', err);
      setErrorMsg(err.message || 'Failed to record transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Product Selection & Catalog (7 cols) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Search & Voice Bar */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Scan barcode or type item name..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={onOpenVoiceModal}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
              title="Dictate sale with voice"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Voice POS</span>
            </button>
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[580px] overflow-y-auto pr-1">
          {availableProducts.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400">
              <Package className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="text-xs">No matching products found.</p>
            </div>
          ) : (
            availableProducts.map((p) => {
              const inCartItem = cart.find((it) => it.product.id === p.id);
              const isOut = p.stockQuantity <= 0;
              const isLow = p.stockQuantity > 0 && p.stockQuantity <= p.minStockThreshold;

              return (
                <div
                  key={p.id}
                  onClick={() => !isOut && addToCart(p)}
                  className={`p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between select-none ${
                    isOut
                      ? 'bg-slate-900/60 border-slate-800/80 opacity-60 cursor-not-allowed'
                      : inCartItem
                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-sm cursor-pointer hover:border-emerald-400'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850 cursor-pointer'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 truncate max-w-[100px]">
                        {p.category}
                      </span>
                      {inCartItem && (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold text-[10px]">
                          {inCartItem.quantity} in cart
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs font-bold text-white line-clamp-2 leading-tight">
                      {p.name}
                    </h3>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-extrabold text-emerald-400">
                        {currency}{p.sellingPrice}
                      </span>
                      <span className="text-[10px] text-slate-400"> /{p.unit}</span>
                    </div>

                    <span
                      className={`text-[10px] font-bold ${
                        isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    >
                      {isOut ? 'Out' : `${p.stockQuantity} left`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Billing Terminal & Checkout (5 cols) */}
      <div className="lg:col-span-5 bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
        {/* Terminal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Current Bill</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {cart.reduce((s, it) => s + it.quantity, 0)} items
            </span>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-rose-400 hover:text-rose-300 font-medium"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Customer Details */}
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer Name (optional)"
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div className="relative">
            <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone (for WhatsApp receipt)"
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Cart Items List */}
        <div className="max-h-56 overflow-y-auto divide-y divide-slate-800/60 pr-1">
          {cart.length === 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-2">
              <ShoppingCart className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-xs">No items in the bill.</p>
              <p className="text-[11px] text-slate-500">Tap products on the left or use Voice POS</p>
            </div>
          ) : (
            cart.map((it) => (
              <div key={it.product.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white truncate">{it.product.name}</h4>
                  <p className="text-[10px] text-slate-400">
                    {currency}{it.unitPrice} × {it.quantity} {it.product.unit} ={' '}
                    <span className="font-semibold text-emerald-400">
                      {currency}{(it.quantity * it.unitPrice).toFixed(2)}
                    </span>
                  </p>
                </div>

                {/* Stepper */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => updateCartQty(it.product.id, it.quantity - 1)}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-bold text-white">
                    {it.quantity}
                  </span>
                  <button
                    onClick={() => updateCartQty(it.product.id, it.quantity + 1)}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removeFromCart(it.product.id)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 ml-1"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-900/30 border border-rose-700/60 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Payment Mode Selector */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
            Payment Mode:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => setPaymentMode('cash')}
              className={`p-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 border transition-all ${
                paymentMode === 'cash'
                  ? 'bg-emerald-600/30 border-emerald-500 text-white'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Banknote className="w-4 h-4 text-emerald-400" />
              <span>Cash</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPaymentMode('upi');
                setShowUpiModal(true);
              }}
              className={`p-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 border transition-all ${
                paymentMode === 'upi'
                  ? 'bg-cyan-600/30 border-cyan-500 text-white'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span>UPI / QR</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMode('credit_khata')}
              className={`p-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 border transition-all ${
                paymentMode === 'credit_khata'
                  ? 'bg-amber-600/30 border-amber-500 text-white'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4 text-amber-400" />
              <span>Udhaar / Khata</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMode('card')}
              className={`p-2 rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 border transition-all ${
                paymentMode === 'card'
                  ? 'bg-purple-600/30 border-purple-500 text-white'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-4 h-4 text-purple-400" />
              <span>Card</span>
            </button>
          </div>
        </div>

        {/* Bill Calculations */}
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-800 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal:</span>
            <span>{currency}{subtotal.toFixed(2)}</span>
          </div>

          <div className="flex items-center justify-between text-slate-400">
            <span>Discount ({currency}):</span>
            <input
              type="number"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="w-20 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-right text-xs text-white"
            />
          </div>

          <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-700/60">
            <span>Final Amount:</span>
            <span className="text-emerald-400">{currency}{finalTotal.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-[11px] text-teal-400 font-semibold pt-1">
            <span>Estimated Profit:</span>
            <span>+{currency}{projectedProfit.toFixed(2)}</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleCompleteSale}
          disabled={isSubmitting || cart.length === 0}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all active:scale-95"
        >
          {isSubmitting ? (
            <span>Recording Sale & Updating Stock...</span>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>Complete Sale & Print Bill ({currency}{finalTotal.toFixed(2)})</span>
            </>
          )}
        </button>
      </div>

      {/* Simulated UPI QR Code Modal */}
      {showUpiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-base">Scan to Pay via UPI</h3>
            <p className="text-xs text-slate-400">
              Customer can scan with Google Pay, PhonePe, or Paytm
            </p>

            <div className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl shadow-inner flex flex-col items-center justify-center">
              <QrCode className="w-36 h-36 text-slate-900" />
              <span className="text-[10px] font-mono font-bold text-slate-800">
                {profile?.shopName || 'DUKAN AI'}
              </span>
            </div>

            <div className="text-lg font-extrabold text-emerald-400">
              {currency}{finalTotal.toFixed(2)}
            </div>

            <button
              onClick={() => setShowUpiModal(false)}
              className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              Confirm Received
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
