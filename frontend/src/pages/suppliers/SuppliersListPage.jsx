import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supplierApi } from '../../services/api';
import {
  Store,
  Plus,
  ArrowRight,
  TrendingUp,
  Package,
  IndianRupee,
  RefreshCw,
  Phone,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react';

export default function SuppliersListPage({ onSelectSupplier }) {
  const { t } = useLanguage();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add Supplier modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const fetchSuppliers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await supplierApi.list();
      if (res.success && res.suppliers) {
        setSuppliers(res.suppliers);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    setAddError('');

    if (!shopName.trim()) {
      setAddError('Supplier shop name is required.');
      return;
    }

    setAddLoading(true);
    try {
      const res = await supplierApi.create(shopName.trim(), phone.trim() || undefined);
      if (res.success) {
        setIsAddModalOpen(false);
        setShopName('');
        setPhone('');
        await fetchSuppliers();
      } else {
        setAddError(res.error || 'Failed to add supplier');
      }
    } catch (err) {
      setAddError(err.message || 'Failed to add supplier');
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Store className="w-6 h-6 text-emerald-600" />
            <span>{t('suppliers')}</span>
            <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {suppliers.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track wholesalers, total money spent, and profit earned from each supplier.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-semibold text-xs transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('addSupplier')}</span>
        </button>
      </div>

      {/* Suppliers Grid */}
      {loading ? (
        <div className="py-16 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
          <p className="text-xs text-slate-500">Loading suppliers...</p>
        </div>
      ) : suppliers.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs">
          <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-base">{t('noSuppliersFound')}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Add suppliers when entering items or click 'Add Supplier' above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {suppliers.map((sup) => (
            <div
              key={sup.id}
              onClick={() => onSelectSupplier(sup.id)}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-lg">
                      <Store className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-base group-hover:text-emerald-700 transition-colors">
                        {sup.shopName}
                      </h4>
                      {sup.phone ? (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{sup.phone}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {sup.isUnassigned ? 'Items with no supplier' : 'Wholesaler / Distributor'}
                        </p>
                      )}
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                    {sup.totalItems} {t('items')}
                  </span>
                </div>

                {/* Financial Summary */}
                <div className="space-y-2 py-3 border-y border-slate-100 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>{t('totalSpent')}:</span>
                    <strong className="text-slate-900 font-bold">₹{sup.totalSpent}</strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {t('supplierProfitEarned')}:
                    </span>
                    <strong className="text-emerald-800 font-bold">₹{sup.totalProfitEarned}</strong>
                  </div>

                  <div className="flex items-center justify-between text-slate-500">
                    <span>{t('supplierExpectedProfit')}:</span>
                    <span>₹{sup.totalExpectedProfit}</span>
                  </div>
                </div>
              </div>

              {/* View Supplier Link */}
              <div className="pt-4 flex items-center justify-between text-xs font-semibold text-emerald-600 group-hover:text-emerald-700">
                <span>{t('viewSupplier')}</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Supplier Modal (FR-5.1) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="font-bold text-base">{t('addSupplier')}</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupplier} className="p-6 space-y-4">
              {addError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{addError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {t('supplierShopName')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Sri Venkateshwara Traders"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {t('phoneOptional')}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {addLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span>{t('save')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

