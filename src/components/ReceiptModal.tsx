import React from 'react';
import { X, Printer, Share2, CheckCircle2, Store, Phone } from 'lucide-react';
import { Sale } from '../types';
import { useDukan } from '../context/DukanContext';

interface ReceiptModalProps {
  sale: Sale | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose }) => {
  const { profile } = useDukan();

  if (!sale) return null;

  const currency = profile?.currency || '₹';

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const text = `*Bill from ${profile?.shopName || 'Apna Dukan'}*\nBill No: ${sale.billNumber}\nCustomer: ${sale.customerName || 'Customer'}\nTotal Amount: ${currency}${sale.totalAmount}\nPayment: ${sale.paymentMode.toUpperCase()} (${sale.paymentStatus})\nThank you for shopping with us!`;
    const url = `https://wa.me/${sale.customerPhone ? sale.customerPhone.replace(/\D/g, '') : ''}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Actions Bar (Not printed) */}
        <div className="print:hidden px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Invoice Generated</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={handleWhatsAppShare}
              className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-500 hover:text-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper */}
        <div className="p-6 overflow-y-auto space-y-4 font-mono text-xs text-slate-800" id="printable-bill">
          {/* Store Header */}
          <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-slate-300">
            <h2 className="text-base font-extrabold tracking-tight uppercase">
              {profile?.shopName || 'APNA DUKAN'}
            </h2>
            <p className="text-[11px] text-slate-600">
              Smart Retail & Kirana Store
            </p>
            {profile?.phone && (
              <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                <Phone className="w-3 h-3" /> {profile.phone}
              </p>
            )}
          </div>

          {/* Bill Meta */}
          <div className="flex justify-between text-[11px] text-slate-600">
            <div>
              <p><span className="font-bold">Bill No:</span> {sale.billNumber}</p>
              <p><span className="font-bold">Customer:</span> {sale.customerName || 'Walk-in'}</p>
              {sale.customerPhone && <p><span className="font-bold">Phone:</span> {sale.customerPhone}</p>}
            </div>
            <div className="text-right">
              <p>{new Date(sale.createdAt).toLocaleDateString()}</p>
              <p>{new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="py-2 border-y border-dashed border-slate-300">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                  <th className="py-1">Item</th>
                  <th className="py-1 text-center">Qty</th>
                  <th className="py-1 text-right">Price</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.items.map((item, idx) => (
                  <tr key={idx} className="py-1">
                    <td className="py-1.5 font-medium pr-1">{item.productName}</td>
                    <td className="py-1.5 text-center whitespace-nowrap">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      {currency}{item.unitPrice}
                    </td>
                    <td className="py-1.5 text-right font-bold whitespace-nowrap">
                      {currency}{item.totalPrice.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="space-y-1 text-right pt-1">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span>{currency}{sale.subtotal.toFixed(2)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount:</span>
                <span>-{currency}{sale.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-300">
              <span>Net Payable:</span>
              <span>{currency}{sale.totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Status Badge */}
          <div className="pt-2 text-center border-t border-dashed border-slate-300 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider">
              Payment Mode: {sale.paymentMode.replace('_', ' ')}
            </p>
            <span className={`inline-block px-3 py-0.5 rounded text-[10px] font-bold uppercase ${
              sale.paymentStatus === 'paid'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {sale.paymentStatus === 'paid' ? 'Paid in Full' : 'Udhaar / Khata (Payment Due)'}
            </span>
          </div>

          <p className="text-[10px] text-center text-slate-500 pt-2">
            *** Thank you for visiting! Please come again! ***
          </p>
        </div>
      </div>
    </div>
  );
};
