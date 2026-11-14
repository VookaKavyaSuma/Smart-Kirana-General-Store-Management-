import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supplierApi } from '../../services/api';
import {
  ArrowLeft,
  Store,
  TrendingUp,
  Package,
  Phone,
  RefreshCw,
  AlertCircle,
  Plus,
} from 'lucide-react';

export default function SupplierDetailPage({ supplierId, onBack, onAddItemForSupplier }) {
  const { t } = useLanguage();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await supplierApi.get(supplierId);
      if (res.success) {
        setData(res);
      } else {
        setError(res.error || 'Failed to load supplier details');
      }
    } catch (err) {
      setError(err.message || 'Failed to load supplier details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (supplierId) {
      fetchDetail();
    }
  }, [supplierId]);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
        <p className="text-xs text-slate-500">Loading supplier details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-800">{error || 'Supplier not found'}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
        >
          {t('back')}
        </button>
      </div>
    );
  }

  const { supplier, items, totals } = data;

  return (
    <div className="space-y-6">
      {/* Back button and Supplier Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer text-slate-600 shadow-2xs"
            title={t('back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {supplier.shopName}
              </h2>
              {supplier.isUnassigned && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  Unassigned
                </span>
              )}
            </div>
            {supplier.phone && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>+91 {supplier.phone}</span>
              </p>
            )}
          </div>
        </div>

        {!supplier.isUnassigned && (
          <button
            onClick={() => onAddItemForSupplier(supplier.shopName)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-semibold text-xs transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item From This Supplier</span>
          </button>
        )}
      </div>

      {/* Financial Aggregates Banner (FR-5.7) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            {t('totalSpent')}
          </span>
          <span className="text-xl sm:text-2xl font-black text-slate-900 mt-1 block">
            ₹{totals.totalSpent}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block">
            Total purchase amount
          </span>
        </div>

        <div className="bg-emerald-50/70 rounded-3xl p-5 border border-emerald-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            {t('supplierProfitEarned')}
          </span>
          <span className="text-xl sm:text-2xl font-black text-emerald-900 mt-1 block">
            ₹{totals.totalProfitEarned}
          </span>
          <span className="text-[10px] text-emerald-700 mt-1 block">
            On {totals.totalUnitsSold} units sold
          </span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            {t('supplierExpectedProfit')}
          </span>
          <span className="text-xl sm:text-2xl font-black text-slate-900 mt-1 block">
            ₹{totals.totalExpectedProfit}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block">
            On all purchased stock
          </span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            {t('supplierItems')}
          </span>
          <span className="text-xl sm:text-2xl font-black text-slate-900 mt-1 block">
            {totals.totalItems}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block">
            {totals.totalQuantityRemaining} units in store
          </span>
        </div>
      </div>

      {/* Every Item Bought From This Supplier (FR-5.7) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
          <Package className="w-5 h-5 text-emerald-600" />
          <span>Items Bought from {supplier.shopName}</span>
        </h3>

        {items.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No items have been filed under this supplier yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-center">Purchased</th>
                  <th className="py-3 px-4 text-center">Sold</th>
                  <th className="py-3 px-4 text-center">Remaining</th>
                  <th className="py-3 px-4 text-right">Cost Price (CP)</th>
                  <th className="py-3 px-4 text-right">Selling Price (SP)</th>
                  <th className="py-3 px-4 text-right">Profit / Unit</th>
                  <th className="py-3 px-4 text-right">Profit Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {item.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{item.category}</td>
                    <td className="py-3.5 px-4 text-center font-medium">
                      {item.quantityPurchased} {item.unit}
                    </td>
                    <td className="py-3.5 px-4 text-center font-medium text-slate-600">
                      {item.unitsSold} {item.unit}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                      {item.quantityRemaining} {item.unit}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono">
                      ₹{item.costPrice}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ₹{item.sellingPrice}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="font-mono font-bold text-emerald-700">
                        +₹{item.profitPerUnit}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        ({item.marginPercentage}%)
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-800 bg-emerald-50/30">
                      +₹{item.profitEarned}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

