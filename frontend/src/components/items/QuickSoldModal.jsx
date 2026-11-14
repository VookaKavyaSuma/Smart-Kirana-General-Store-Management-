import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { itemApi } from '../../services/api';
import { X, ShoppingCart, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

export default function QuickSoldModal({ isOpen, onClose, item, onSoldSuccess }) {
  const { t } = useLanguage();
  const [unitsSold, setUnitsSold] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !item) return null;

  const remaining = Number(item.quantityRemaining);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const sold = parseFloat(unitsSold);
    if (isNaN(sold) || sold <= 0) {
      setError('Please enter a valid positive number of units sold.');
      return;
    }

    if (sold > remaining) {
      setError(`Cannot sell ${sold} ${item.unit}. Only ${remaining} ${item.unit} remaining in stock.`);
      return;
    }

    setLoading(true);
    try {
      const res = await itemApi.recordSold(item.id, sold);
      if (res.success) {
        onSoldSuccess(res.item);
        onClose();
      } else {
        setError(res.error || 'Failed to record sold units');
      }
    } catch (err) {
      setError(err.message || 'Failed to record sold units');
    } finally {
      setLoading(false);
    }
  };

  const calculatedProfitOnSale = (
    parseFloat(unitsSold || 0) * (Number(item.currentSellingPrice) - Number(item.currentCostPrice))
  ).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">{t('recordSoldTitle')}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <span className="text-xs text-slate-500 block">Item</span>
            <span className="font-bold text-slate-900 text-base">{item.name}</span>
            <div className="mt-1 flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 font-medium text-slate-700">
                {t('quantityRemaining')}: <strong>{remaining} {item.unit}</strong>
              </span>
              <span className="text-slate-500">
                SP: ₹{item.currentSellingPrice}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {t('enterSoldUnits')} ({item.unit}) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              max={remaining}
              value={unitsSold}
              onChange={(e) => setUnitsSold(e.target.value)}
              placeholder="e.g. 5"
              autoFocus
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {parseFloat(unitsSold) > 0 && (
              <p className="text-[11px] text-emerald-700 font-medium mt-1">
                Realized profit on this sale: +₹{calculatedProfitOnSale}
              </p>
            )}
          </div>

          {/* Quick presets */}
          <div className="flex gap-1.5 pt-1">
            {[1, 2, 5, 10].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setUnitsSold(String(preset))}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition-colors"
              >
                +{preset}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setUnitsSold(String(remaining))}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 cursor-pointer transition-colors"
            >
              All ({remaining})
            </button>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>{t('confirm')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

