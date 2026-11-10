import React, { useState, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUpDown,
  Barcode,
  X,
  PlusCircle,
  MinusCircle,
  Sparkles,
} from 'lucide-react';
import { useDukan } from '../context/DukanContext';
import { Product } from '../types';
import { CATEGORIES, UNITS } from '../data/seedData';

interface InventoryViewProps {
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
  onOpenVoiceModal: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  isAddModalOpen,
  setIsAddModalOpen,
  onOpenVoiceModal,
}) => {
  const { products, addProduct, updateProduct, deleteProduct, quickAdjustStock, profile } = useDukan();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [filterStockStatus, setFilterStockStatus] = useState<'all' | 'low' | 'out' | 'healthy'>('all');
  const [sortField, setSortField] = useState<'name' | 'stock' | 'price'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Form State for Add / Edit
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Staples & Grains');
  const [formBarcode, setFormBarcode] = useState('');
  const [formCostPrice, setFormCostPrice] = useState<number | string>('');
  const [formSellingPrice, setFormSellingPrice] = useState<number | string>('');
  const [formStockQuantity, setFormStockQuantity] = useState<number | string>('');
  const [formMinThreshold, setFormMinThreshold] = useState<number | string>(5);
  const [formUnit, setFormUnit] = useState('pkt');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currency = profile?.currency || '₹';

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesSearch =
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (p.barcode && p.barcode.includes(searchTerm)) ||
          p.category.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;

        let matchesStock = true;
        if (filterStockStatus === 'low') {
          matchesStock = p.stockQuantity > 0 && p.stockQuantity <= p.minStockThreshold;
        } else if (filterStockStatus === 'out') {
          matchesStock = p.stockQuantity <= 0;
        } else if (filterStockStatus === 'healthy') {
          matchesStock = p.stockQuantity > p.minStockThreshold;
        }

        return matchesSearch && matchesCategory && matchesStock;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'name') cmp = a.name.localeCompare(b.name);
        if (sortField === 'stock') cmp = a.stockQuantity - b.stockQuantity;
        if (sortField === 'price') cmp = a.sellingPrice - b.sellingPrice;
        return sortAsc ? cmp : -cmp;
      });
  }, [products, searchTerm, selectedCategory, filterStockStatus, sortField, sortAsc]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCategory('Staples & Grains');
    setFormBarcode('');
    setFormCostPrice('');
    setFormSellingPrice('');
    setFormStockQuantity(10);
    setFormMinThreshold(profile?.lowStockThresholdDefault || 5);
    setFormUnit('pkt');
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormBarcode(p.barcode || '');
    setFormCostPrice(p.costPrice);
    setFormSellingPrice(p.sellingPrice);
    setFormStockQuantity(p.stockQuantity);
    setFormMinThreshold(p.minStockThreshold);
    setFormUnit(p.unit);
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    const name = formName.trim();
    if (!name) {
      setFormError('Please enter a product name');
      return;
    }
    const costPrice = Number(formCostPrice);
    const sellingPrice = Number(formSellingPrice);
    const stockQuantity = Number(formStockQuantity);
    const minStockThreshold = Number(formMinThreshold);

    if (isNaN(costPrice) || costPrice < 0) {
      setFormError('Cost price must be a number >= 0');
      return;
    }
    if (isNaN(sellingPrice) || sellingPrice <= 0) {
      setFormError('Selling price must be a valid positive number');
      return;
    }
    if (isNaN(stockQuantity) || stockQuantity < 0) {
      setFormError('Stock quantity must be a non-negative number');
      return;
    }
    if (isNaN(minStockThreshold) || minStockThreshold < 0) {
      setFormError('Minimum threshold must be a non-negative number');
      return;
    }

    setSubmitting(true);
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          name,
          category: formCategory,
          barcode: formBarcode.trim(),
          costPrice,
          sellingPrice,
          stockQuantity,
          minStockThreshold,
          unit: formUnit,
        });
      } else {
        await addProduct({
          name,
          category: formCategory,
          barcode: formBarcode.trim(),
          costPrice,
          sellingPrice,
          stockQuantity,
          minStockThreshold,
          unit: formUnit,
        });
      }
      setIsAddModalOpen(false);
      setEditingProduct(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async (id: string) => {
    try {
      await deleteProduct(id);
      setDeletingProductId(null);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-400" />
            Inventory & Stock Catalog
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Total {products.length} products registered in your store database
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenVoiceModal}
            className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-emerald-400 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95"
            title="Add or update via voice"
          >
            <Sparkles className="w-4 h-4" />
            <span>Voice Add/Stock</span>
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-950 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
        {/* Search */}
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, category, or barcode..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Category Dropdown */}
        <div className="md:col-span-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'All' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>

        {/* Stock Status Filter */}
        <div className="md:col-span-4 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
          <button
            onClick={() => setFilterStockStatus('all')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
              filterStockStatus === 'all'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStockStatus('low')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
              filterStockStatus === 'low'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
            }`}
          >
            ⚠️ Low Stock
          </button>
          <button
            onClick={() => setFilterStockStatus('out')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
              filterStockStatus === 'out'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
            }`}
          >
            🚫 Out of Stock
          </button>
          <button
            onClick={() => setFilterStockStatus('healthy')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
              filterStockStatus === 'healthy'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
            }`}
          >
            ✅ In Stock
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 border-b border-slate-700 text-slate-300 font-semibold uppercase tracking-wider">
              <tr>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-white"
                  onClick={() => {
                    setSortField('name');
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Product Details</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4">Category</th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-white"
                  onClick={() => {
                    setSortField('price');
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Selling / Cost</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th
                  className="py-3 px-4 cursor-pointer hover:text-white"
                  onClick={() => {
                    setSortField('stock');
                    setSortAsc(!sortAsc);
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Current Stock</span>
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-4">Quick Adjust</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p>No products match your search or filter.</p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOutOfStock = p.stockQuantity <= 0;
                  const isLowStock = p.stockQuantity > 0 && p.stockQuantity <= p.minStockThreshold;
                  const marginPercent =
                    p.sellingPrice > 0 ? (((p.sellingPrice - p.costPrice) / p.sellingPrice) * 100).toFixed(0) : '0';

                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Name & Barcode */}
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="font-bold text-white text-sm">{p.name}</p>
                          {p.barcode && (
                            <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                              <Barcode className="w-3 h-3 text-slate-500" />
                              {p.barcode}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-700/50">
                          {p.category}
                        </span>
                      </td>

                      {/* Prices & Margin */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">
                          {currency}{p.sellingPrice}
                          <span className="text-[10px] text-slate-400 font-normal"> / {p.unit}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>Cost: {currency}{p.costPrice}</span>
                          <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-1 rounded">
                            +{marginPercent}% margin
                          </span>
                        </div>
                      </td>

                      {/* Stock Quantity & Status */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-extrabold ${
                            isOutOfStock ? 'text-rose-400' : isLowStock ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {p.stockQuantity} {p.unit}
                          </span>

                          {isOutOfStock && (
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                              Out
                            </span>
                          )}
                          {isLowStock && (
                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                              Low (Min {p.minStockThreshold})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Quick Adjust Buttons */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => quickAdjustStock(p.id, -1)}
                            disabled={p.stockQuantity <= 0}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-white transition-colors"
                            title="Decrease 1"
                          >
                            <MinusCircle className="w-4 h-4 text-slate-400 hover:text-rose-400" />
                          </button>
                          <button
                            onClick={() => quickAdjustStock(p.id, 1)}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Add 1"
                          >
                            <PlusCircle className="w-4 h-4 text-slate-400 hover:text-emerald-400" />
                          </button>
                          <button
                            onClick={() => quickAdjustStock(p.id, 10)}
                            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-emerald-400 font-bold transition-colors"
                            title="Restock +10"
                          >
                            +10
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                            title="Edit Product"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingProductId(p.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                {editingProduct ? 'Edit Product' : 'Add New Product to Inventory'}
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-900/30 border border-rose-700/60 text-rose-300 text-xs">
                  {formError}
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="E.g. Aashirvaad Atta (5 kg) or Amul Milk"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Unit of Measure *
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cost Price vs Selling Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Cost Price ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formCostPrice}
                    onChange={(e) => setFormCostPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500">Purchase price</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Selling Price ({currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-emerald-400">Retail customer price</span>
                </div>
              </div>

              {/* Stock Quantity & Min Threshold */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Available Stock *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formStockQuantity}
                    onChange={(e) => setFormStockQuantity(e.target.value)}
                    placeholder="Quantity in stock"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Low Stock Threshold *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formMinThreshold}
                    onChange={(e) => setFormMinThreshold(e.target.value)}
                    placeholder="E.g. 5"
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-amber-400">Alert triggers when &lt;= this</span>
                </div>
              </div>

              {/* Barcode / SKU */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Barcode / SKU (Optional)
                </label>
                <input
                  type="text"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value)}
                  placeholder="E.g. 8901030012341"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-950 transition-all active:scale-95"
                >
                  {submitting ? 'Saving to Database...' : editingProduct ? 'Save Changes' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-full bg-rose-500/10">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-white text-base">Delete Product?</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to remove this product from inventory? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingProductId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(deletingProductId)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-950"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
