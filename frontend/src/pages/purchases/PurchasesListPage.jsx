import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { purchaseApi, supplierApi } from '../../services/api';
import NewPurchaseModal from './NewPurchaseModal';
import BillUploadModal from '../../components/bills/BillUploadModal';
import {
  ShoppingBag,
  Plus,
  Calendar,
  Store,
  Trash2,
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Upload,
} from 'lucide-react';

export default function PurchasesListPage() {
  const { t } = useLanguage();

  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [supplierFilter, setSupplierFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals state
  const [isNewPurchaseOpen, setIsNewPurchaseOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [billUploadPurchase, setBillUploadPurchase] = useState(null);

  const fetchPurchases = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await purchaseApi.list({
        supplierId: supplierFilter || undefined,
        type: typeFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      if (res.success && res.purchases) {
        setPurchases(res.purchases);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch purchases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
    supplierApi.list().then((res) => {
      if (res.success && res.suppliers) {
        setSuppliers(res.suppliers);
      }
    }).catch(console.warn);
  }, [supplierFilter, typeFilter, dateFrom, dateTo]);

  const handleDeletePurchase = async (purchaseId) => {
    if (!window.confirm(t('deletePurchaseConfirm'))) return;

    setDeletingId(purchaseId);
    try {
      const res = await purchaseApi.delete(purchaseId);
      if (res.success) {
        setPurchases((prev) => prev.filter((p) => p.id !== purchaseId));
      }
    } catch (err) {
      alert(err.message || 'Failed to delete purchase');
    } finally {
      setDeletingId(null);
    }
  };

  const handlePurchaseCreated = (newPurchase) => {
    setPurchases((prev) => [newPurchase, ...prev]);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-emerald-600" />
            <span>{t('purchases')}</span>
            <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {purchases.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Log supplier purchases, lock prices, and update inventory stock automatically.
          </p>
        </div>

        <button
          onClick={() => setIsNewPurchaseOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-semibold text-xs transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('newPurchase')}</span>
        </button>
      </div>

      {/* Filter Bar (FR-5.6) */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          {/* Supplier Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              {t('supplier')}
            </label>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">{t('allSuppliers')}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shopName}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              {t('purchaseType')}
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Types</option>
              <option value="SHOP">{t('shopPurchase')}</option>
              <option value="ONLINE">{t('onlinePurchase')}</option>
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              {t('dateFrom')}
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              {t('dateTo')}
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {(supplierFilter || typeFilter || dateFrom || dateTo) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                setSupplierFilter('');
                setTypeFilter('');
                setDateFrom('');
                setDateTo('');
              }}
              className="text-xs text-rose-600 hover:underline font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Purchases List */}
      {loading ? (
        <div className="py-16 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
          <p className="text-xs text-slate-500">Loading purchases...</p>
        </div>
      ) : purchases.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-base">{t('noPurchasesFound')}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Record each stock purchase to build purchase history and calculate supplier profit automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {purchases.map((p) => {
            const isExpanded = expandedId === p.id;

            return (
              <div
                key={p.id}
                className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-sm transition-all"
              >
                {/* Purchase Summary Header */}
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
                      <Store className="w-6 h-6" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900 text-base">
                          {p.supplierShopName}
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.type === 'ONLINE'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {p.type === 'ONLINE' ? 'Online' : 'Shop'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(p.purchaseDate).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span>{p.items?.length || 0} items</span>
                        {p.note && (
                          <>
                            <span>•</span>
                            <span className="italic truncate max-w-xs">{p.note}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        {t('totalCost')}
                      </span>
                      <span className="font-mono font-black text-lg text-slate-900">
                        ₹{p.totalAmount}
                      </span>
                      <span className="text-[11px] font-semibold text-emerald-700 block">
                        +₹{p.expectedProfit} exp. profit
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="View details"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={deletingId === p.id}
                        onClick={() => handleDeletePurchase(p.id)}
                        className="p-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                        title="Delete purchase"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Line Items Table (FR-5.5) */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-3 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-700">{t('lineItems')}</span>
                      <button
                        type="button"
                        onClick={() => setBillUploadPurchase(p)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t('uploadBill')}</span>
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Item</th>
                            <th className="py-2.5 px-3 text-center">Quantity</th>
                            <th className="py-2.5 px-3 text-right">Cost Price (CP)</th>
                            <th className="py-2.5 px-3 text-right">Selling Price (SP)</th>
                            <th className="py-2.5 px-3 text-right">Total Line Cost</th>
                            <th className="py-2.5 px-3 text-right">Expected Profit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                          {p.items?.map((item) => (
                            <tr key={item.id}>
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                {item.itemName}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {item.quantity} {item.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono">
                                ₹{item.costPrice}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-900 font-bold">
                                ₹{item.sellingPrice}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                ₹{item.totalCost}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                                +₹{item.expectedProfit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Purchase Modal */}
      <NewPurchaseModal
        isOpen={isNewPurchaseOpen}
        onClose={() => setIsNewPurchaseOpen(false)}
        onPurchaseCreated={handlePurchaseCreated}
      />

      {/* Bill Upload Modal for a specific purchase */}
      {billUploadPurchase && (
        <BillUploadModal
          isOpen={Boolean(billUploadPurchase)}
          onClose={() => setBillUploadPurchase(null)}
          initialPurchaseId={billUploadPurchase.id}
          initialSupplierName={billUploadPurchase.supplierShopName}
          onBillUploaded={() => {
            setBillUploadPurchase(null);
            fetchPurchases();
          }}
        />
      )}
    </div>
  );
}

