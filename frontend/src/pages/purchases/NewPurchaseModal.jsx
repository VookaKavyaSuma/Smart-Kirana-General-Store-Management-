import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { purchaseApi, supplierApi, itemApi } from '../../services/api';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Store,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  FileText,
  TrendingUp,
} from 'lucide-react';

const COMMON_UNITS = ['KG', 'G', 'LITRE', 'ML', 'PIECE', 'PACKET'];

export default function NewPurchaseModal({ isOpen, onClose, onPurchaseCreated }) {
  const { t } = useLanguage();

  const [supplierShopName, setSupplierShopName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [purchaseType, setPurchaseType] = useState('SHOP');
  const [note, setNote] = useState('');

  // Item Lines
  const [lines, setLines] = useState([
    { name: '', unit: 'KG', quantity: '10', costPrice: '40', sellingPrice: '50' },
  ]);

  // Autocomplete data
  const [existingSuppliers, setExistingSuppliers] = useState([]);
  const [existingItems, setExistingItems] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      supplierApi.list().then((res) => {
        if (res.success && res.suppliers) {
          setExistingSuppliers(
            res.suppliers.filter((s) => !s.isUnassigned).map((s) => s.shopName)
          );
        }
      }).catch(console.warn);

      itemApi.list().then((res) => {
        if (res.success && res.items) {
          setExistingItems(res.items);
        }
      }).catch(console.warn);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddLine = () => {
    setLines([
      ...lines,
      { name: '', unit: 'KG', quantity: '', costPrice: '', sellingPrice: '' },
    ]);
  };

  const handleRemoveLine = (index) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index, field, value) => {
    const updated = [...lines];
    updated[index][field] = value;

    // If selecting an existing item by name, auto-fill unit, CP, and SP
    if (field === 'name') {
      const match = existingItems.find((i) => i.name.toLowerCase() === value.toLowerCase());
      if (match) {
        updated[index].unit = match.unit;
        updated[index].costPrice = String(match.currentCostPrice);
        updated[index].sellingPrice = String(match.currentSellingPrice);
        updated[index].itemId = match.id;
      }
    }

    setLines(updated);
  };

  // Live totals calculation
  let totalCost = 0;
  let totalExpectedProfit = 0;

  for (const line of lines) {
    const q = parseFloat(line.quantity) || 0;
    const cp = parseFloat(line.costPrice) || 0;
    const sp = parseFloat(line.sellingPrice) || 0;
    totalCost += q * cp;
    totalExpectedProfit += q * (sp - cp);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (lines.length === 0) {
      setError('Please add at least one item to this purchase.');
      return;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.name.trim()) {
        setError(`Please enter item name for line ${i + 1}`);
        return;
      }
      if (!line.quantity || parseFloat(line.quantity) <= 0) {
        setError(`Invalid quantity for line ${i + 1}`);
        return;
      }
      if (line.costPrice === '' || parseFloat(line.costPrice) < 0) {
        setError(`Invalid cost price for line ${i + 1}`);
        return;
      }
      if (line.sellingPrice === '' || parseFloat(line.sellingPrice) < 0) {
        setError(`Invalid selling price for line ${i + 1}`);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        supplierShopName: supplierShopName.trim() || null,
        purchaseDate,
        type: purchaseType,
        note: note.trim() || null,
        items: lines.map((l) => ({
          itemId: l.itemId,
          name: l.name.trim(),
          unit: l.unit,
          quantity: parseFloat(l.quantity),
          costPrice: parseFloat(l.costPrice),
          sellingPrice: parseFloat(l.sellingPrice),
        })),
      };

      const res = await purchaseApi.create(payload);
      if (res.success) {
        onPurchaseCreated(res.purchase);
        onClose();
      } else {
        setError(res.error || 'Failed to record purchase');
      }
    } catch (err) {
      setError(err.message || 'Failed to record purchase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg">{t('newPurchase')}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Supplier, Date, Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Supplier */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('supplierShopName')}
              </label>
              <input
                type="text"
                list="suppliers-list"
                value={supplierShopName}
                onChange={(e) => setSupplierShopName(e.target.value)}
                placeholder="e.g. Sri Venkateshwara Traders"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <datalist id="suppliers-list">
                {existingSuppliers.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            {/* Purchase Date (FR-5.3: defaults to today, editable) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('purchaseDate')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            {/* Purchase Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('purchaseType')}
              </label>
              <select
                value={purchaseType}
                onChange={(e) => setPurchaseType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="SHOP">{t('shopPurchase')}</option>
                <option value="ONLINE">{t('onlinePurchase')}</option>
              </select>
            </div>
          </div>

          {/* Note / Bill Ref */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {t('invoiceNote')}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('invoiceNotePlaceholder')}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Item Lines Section (FR-5.2) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>{t('lineItems')}</span>
              </h4>
              <button
                type="button"
                onClick={handleAddLine}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('addLineItem')}</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {lines.map((line, idx) => {
                const q = parseFloat(line.quantity) || 0;
                const cp = parseFloat(line.costPrice) || 0;
                const sp = parseFloat(line.sellingPrice) || 0;
                const lineCost = (q * cp).toFixed(2);
                const lineProfit = (q * (sp - cp)).toFixed(2);

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row gap-2.5 items-stretch md:items-center"
                  >
                    {/* Item Name */}
                    <div className="flex-2">
                      <input
                        type="text"
                        list={`items-list-${idx}`}
                        value={line.name}
                        onChange={(e) => handleLineChange(idx, 'name', e.target.value)}
                        placeholder="Item name (Sugar, Rice...)"
                        required
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-sm bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <datalist id={`items-list-${idx}`}>
                        {existingItems.map((item) => (
                          <option key={item.id} value={item.name} />
                        ))}
                      </datalist>
                    </div>

                    {/* Unit */}
                    <div className="w-24">
                      <select
                        value={line.unit}
                        onChange={(e) => handleLineChange(idx, 'unit', e.target.value)}
                        className="w-full px-2 py-1.5 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
                      >
                        {COMMON_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="w-24">
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={line.quantity}
                        onChange={(e) => handleLineChange(idx, 'quantity', e.target.value)}
                        placeholder="Qty"
                        required
                        className="w-full px-2 py-1.5 rounded-xl border border-slate-300 text-sm bg-white text-center font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    {/* Cost Price (CP) */}
                    <div className="w-24">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.costPrice}
                        onChange={(e) => handleLineChange(idx, 'costPrice', e.target.value)}
                        placeholder="CP ₹"
                        required
                        className="w-full px-2 py-1.5 rounded-xl border border-slate-300 text-sm bg-white text-right font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    {/* Selling Price (SP) */}
                    <div className="w-24">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.sellingPrice}
                        onChange={(e) => handleLineChange(idx, 'sellingPrice', e.target.value)}
                        placeholder="SP ₹"
                        required
                        className="w-full px-2 py-1.5 rounded-xl border border-slate-300 text-sm bg-white text-right font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>

                    {/* Line totals & Delete */}
                    <div className="flex items-center justify-between md:justify-end gap-2 text-xs font-mono">
                      <span className="font-bold text-slate-800">₹{lineCost}</span>
                      <span className="text-[11px] text-emerald-700">(+₹{lineProfit})</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        disabled={lines.length === 1}
                        className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer disabled:opacity-20"
                        title={t('removeLineItem')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Totals Summary Banner (FR-5.4) */}
          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                {t('purchaseTotalAmount')}
              </span>
              <span className="text-2xl font-black text-emerald-950 font-mono">
                ₹{totalCost.toFixed(2)}
              </span>
            </div>

            <div className="sm:text-right">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                {t('expectedProfitTotal')}
              </span>
              <span className="text-xl font-bold text-emerald-900 font-mono">
                +₹{totalExpectedProfit.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="pt-2 flex gap-3">
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
              <span>{t('recordPurchase')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

