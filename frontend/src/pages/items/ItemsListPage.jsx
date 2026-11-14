import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { itemApi } from '../../services/api';
import ItemFormModal from '../../components/items/ItemFormModal';
import QuickSoldModal from '../../components/items/QuickSoldModal';
import {
  Plus,
  Search,
  AlertTriangle,
  ShoppingCart,
  Edit2,
  Trash2,
  TrendingUp,
  Store,
  Layers,
  RefreshCw,
  Package,
  Calculator,
} from 'lucide-react';

export default function ItemsListPage({ onOpenSupplierDetail, onOpenCalculatorForItem }) {
  const { t } = useLanguage();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [soldModalItem, setSoldModalItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchItems = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await itemApi.list();
      if (res.success && res.items) {
        setItems(res.items);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // Distinct categories from existing items
  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.supplierShopName?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchesLowStock = !lowStockOnly || item.isLowStock;

      return matchesSearch && matchesCat && matchesLowStock;
    });
  }, [items, searchQuery, selectedCategory, lowStockOnly]);

  const lowStockCount = useMemo(() => items.filter((i) => i.isLowStock).length, [items]);

  const handleDeleteItem = async (item) => {
    if (!window.confirm(t('deleteItemConfirm'))) return;

    setDeletingId(item.id);
    try {
      const res = await itemApi.delete(item.id);
      if (res.success) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      }
    } catch (err) {
      alert(err.message || 'Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  };

  const handleItemSaved = (savedItem) => {
    setItems((prev) => {
      const index = prev.findIndex((i) => i.id === savedItem.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = savedItem;
        return updated;
      }
      return [savedItem, ...prev];
    });
  };

  const handleSoldSuccess = (updatedItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === updatedItem.id ? updatedItem : i))
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-600" />
            <span>{t('navItems')}</span>
            <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {items.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record stock, track quantities remaining, and manage supplier links.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-semibold text-xs transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addItem')}</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchItems')}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50/50"
            />
          </div>

          {/* Low Stock Toggle Button */}
          <button
            type="button"
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold border transition-all cursor-pointer ${
              lowStockOnly
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${lowStockOnly ? 'text-white' : 'text-amber-500'}`} />
            <span>{t('lowStockOnly')}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                lowStockOnly ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {lowStockCount}
            </span>
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 uppercase mr-1 shrink-0">
            {t('category')}:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-2xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'ALL' ? t('allItems') : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="py-16 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
          <p className="text-xs text-slate-500">Loading items...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-base">{t('noItemsFound')}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || lowStockOnly
              ? 'Try changing your search keywords or filter options.'
              : 'Add your first stock item by clicking Add New Item above.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-3xl p-5 border transition-all shadow-xs hover:shadow-md flex flex-col justify-between ${
                item.isLowStock ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200/80'
              }`}
            >
              <div>
                {/* Header: Photo, Name, Supplier */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                    {item.photoUrl ? (
                      <img
                        src={item.photoUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-bold text-slate-900 text-base truncate">
                        {item.name}
                      </h4>
                      {item.isLowStock && (
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          {t('lowStock')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-medium text-slate-500">
                        {item.category}
                      </span>
                      <span className="text-slate-300">•</span>
                      <button
                        onClick={() => {
                          if (item.supplierId && onOpenSupplierDetail) {
                            onOpenSupplierDetail(item.supplierId);
                          }
                        }}
                        className={`text-[11px] font-semibold truncate ${
                          item.supplierShopName === 'No supplier'
                            ? 'text-slate-400'
                            : 'text-indigo-600 hover:underline cursor-pointer'
                        }`}
                      >
                        <Store className="w-3 h-3 inline mr-1" />
                        {item.supplierShopName}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stock Stats */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/60 mb-3 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      {t('quantityRemaining')}
                    </span>
                    <span
                      className={`font-black text-sm ${
                        item.isLowStock ? 'text-amber-600' : 'text-slate-900'
                      }`}
                    >
                      {item.quantityRemaining} {item.unit}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      {t('unitsSold')}
                    </span>
                    <span className="font-bold text-sm text-slate-700">
                      {item.unitsSold} {item.unit}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      {t('quantityPurchased')}
                    </span>
                    <span className="font-medium text-sm text-slate-500">
                      {item.quantityPurchased} {item.unit}
                    </span>
                  </div>
                </div>

                {/* Price & Profit Breakdown */}
                <div className="space-y-1.5 text-xs text-slate-600 mb-4 px-1">
                  <div className="flex items-center justify-between">
                    <span>
                      {t('costPrice')}: <strong>₹{item.currentCostPrice}</strong>
                    </span>
                    <span>
                      {t('sellingPrice')}: <strong className="text-slate-900">₹{item.currentSellingPrice}</strong>
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="font-semibold text-emerald-700 flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {t('profitPerUnit')}: ₹{item.profitPerUnit}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Margin {item.marginPercentage}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSoldModalItem(item)}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>{t('recordSold')}</span>
                </button>

                {(item.unit === 'KG' || item.unit === 'G' || item.unit === 'LITRE' || item.unit === 'ML') && (
                  <button
                    type="button"
                    onClick={() => onOpenCalculatorForItem && onOpenCalculatorForItem(item)}
                    className="p-2 text-indigo-600 hover:text-indigo-800 rounded-xl hover:bg-indigo-50 border border-indigo-200 transition-colors cursor-pointer"
                    title={t('calculator')}
                  >
                    <Calculator className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setEditingItem(item)}
                  className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                  title={t('editItem')}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  disabled={deletingId === item.id}
                  onClick={() => handleDeleteItem(item)}
                  className="p-2 text-rose-500 hover:text-rose-700 rounded-xl hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                  title={t('deleteItem')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Item Modal */}
      <ItemFormModal
        isOpen={isAddModalOpen || !!editingItem}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingItem(null);
        }}
        editItem={editingItem}
        onItemSaved={handleItemSaved}
      />

      {/* Quick Sold Entry Modal (FR-3.5) */}
      <QuickSoldModal
        isOpen={!!soldModalItem}
        item={soldModalItem}
        onClose={() => setSoldModalItem(null)}
        onSoldSuccess={handleSoldSuccess}
      />
    </div>
  );
}

