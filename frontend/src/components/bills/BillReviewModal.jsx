import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { billApi, supplierApi, itemApi } from '../../services/api';
import {
  X,
  CheckCircle,
  AlertTriangle,
  Info,
  Plus,
  Trash2,
  Calendar,
  Store,
  RefreshCw,
  Eye,
  ZoomIn,
  ZoomOut,
  FileText,
  File,
  ShieldCheck,
  Tag,
  Sparkles,
} from 'lucide-react';

const COMMON_UNITS = ['KG', 'G', 'LITRE', 'ML', 'PIECE', 'PACKET'];

export default function BillReviewModal({ isOpen, onClose, bill, onConfirmed }) {
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Review Form State
  const [supplierShopName, setSupplierShopName] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState('');
  const [billTotal, setBillTotal] = useState('');
  const [lineItems, setLineItems] = useState([]);
  const [usedReader, setUsedReader] = useState('');
  const [isCached, setIsCached] = useState(false);

  // Image zoom state for preview
  const [zoomLevel, setZoomLevel] = useState(1);

  // Autocomplete suggestions
  const [existingSuppliers, setExistingSuppliers] = useState([]);
  const [storeItems, setStoreItems] = useState([]);

  useEffect(() => {
    if (isOpen && bill) {
      setLoading(true);
      setError('');
      setSuccess(false);
      setZoomLevel(1);

      // Load existing suppliers & items for quick suggestions
      supplierApi.list().then((res) => {
        if (res.success && res.suppliers) {
          setExistingSuppliers(res.suppliers.filter((s) => !s.isUnassigned).map((s) => s.shopName));
        }
      }).catch(console.warn);

      itemApi.list().then((res) => {
        if (res.success && res.items) {
          setStoreItems(res.items);
        }
      }).catch(console.warn);

      // Trigger automatic bill reading with caching (FR-6.4)
      billApi.read(bill.id).then((res) => {
        if (res.success && res.extractedData) {
          const data = res.extractedData;
          setSupplierShopName(data.supplierShopName || bill.supplierName || '');
          setBillNumber(data.billNumber || bill.billNumber || '');
          setBillDate(data.billDate || (bill.billDate ? new Date(bill.billDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]));
          setBillTotal(data.billTotal != null ? String(data.billTotal) : (bill.totalAmount != null ? String(bill.totalAmount) : ''));
          setLineItems(data.lineItems && data.lineItems.length > 0 ? data.lineItems : [
            { name: '', quantity: 1, unit: 'KG', costPrice: 0, sellingPrice: 0, isNewItem: true }
          ]);
          setIsCached(Boolean(res.cached));
          setUsedReader(data.readerSource || 'OCR');
        }
      }).catch((err) => {
        console.warn('Bill reading error, opening manual review template:', err);
        // Fallback manual review template if read fails (FR-6.9)
        setSupplierShopName(bill.supplierName || '');
        setBillNumber(bill.billNumber || '');
        setBillDate(bill.billDate ? new Date(bill.billDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        setBillTotal(bill.totalAmount != null ? String(bill.totalAmount) : '');
        setLineItems([
          { name: '', quantity: 1, unit: 'KG', costPrice: 0, sellingPrice: 0, isNewItem: true }
        ]);
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [isOpen, bill]);

  if (!isOpen || !bill) return null;

  // Real-time calculation of lines total (FR-6.8)
  const calculatedLinesTotal = lineItems.reduce((acc, item) => {
    const qty = Number(item.quantity) || 0;
    const cp = Number(item.costPrice) || 0;
    return acc + qty * cp;
  }, 0);

  const roundedLinesTotal = Math.round(calculatedLinesTotal * 100) / 100;
  const numBillTotal = billTotal !== '' && !isNaN(Number(billTotal)) ? Number(billTotal) : null;
  const discrepancyDiff = numBillTotal != null ? Math.round(Math.abs(roundedLinesTotal - numBillTotal) * 100) / 100 : 0;
  const hasDiscrepancy = numBillTotal != null && discrepancyDiff > 0.50;

  // Line item change handler
  const handleLineChange = (index, field, value) => {
    setLineItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };

      // If name changed, check match with store items
      if (field === 'name') {
        const match = storeItems.find((si) => si.name.trim().toLowerCase() === String(value).trim().toLowerCase());
        if (match) {
          item.existingItemId = match.id;
          item.existingItemName = match.name;
          item.unit = match.unit;
          if (!item.sellingPrice || item.sellingPrice === 0) {
            item.sellingPrice = match.currentSellingPrice;
          }
          item.isNewItem = false;
        } else {
          item.existingItemId = null;
          item.isNewItem = true;
        }
      }

      next[index] = item;
      return next;
    });
  };

  const handleAddLine = () => {
    setLineItems((prev) => [
      ...prev,
      { name: '', quantity: 1, unit: 'KG', costPrice: 0, sellingPrice: 0, isNewItem: true }
    ]);
  };

  const handleRemoveLine = (index) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Confirm and commit to stock (FR-6.5, FR-6.6)
  const handleConfirm = async (e) => {
    e.preventDefault();
    if (lineItems.length === 0) {
      setError('Please add at least one line item before confirming.');
      return;
    }

    setConfirming(true);
    setError('');

    try {
      const payload = {
        supplierShopName: supplierShopName.trim() || 'No supplier',
        billNumber: billNumber.trim() || null,
        billDate,
        billTotal: numBillTotal != null ? numBillTotal : roundedLinesTotal,
        lineItems: lineItems.map((l) => ({
          name: l.name.trim(),
          existingItemId: l.existingItemId || undefined,
          quantity: Number(l.quantity) || 1,
          unit: l.unit || 'PIECE',
          costPrice: Number(l.costPrice) || 0,
          sellingPrice: Number(l.sellingPrice) || Math.round((Number(l.costPrice) || 0) * 1.2 * 100) / 100,
        })),
      };

      const res = await billApi.confirm(bill.id, payload);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          if (onConfirmed) onConfirmed(res.purchase);
          onClose();
        }, 1000);
      }
    } catch (err) {
      setError(err.message || 'Failed to confirm bill and update stock.');
    } finally {
      setConfirming(false);
    }
  };

  const isPdf = bill.fileType?.toLowerCase() === 'pdf';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="relative bg-white w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {t('reviewBillTitle')}
                </h3>
                {isCached && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-200 text-slate-700">
                    Cached
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                  {t('statusPendingReview')}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {t('reviewNotice')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety & Status Banner (FR-6.5) */}
        <div className="px-6 py-2 bg-amber-50/70 border-b border-amber-200/70 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-1.5 font-medium">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span><strong>Notice:</strong> Nothing changes stock until you press "Confirm & Add to Stock".</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Secure validation</span>
          </div>
        </div>

        {/* Modal Main Body: Split View (Image/Doc on Left, Review Form on Right) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Bill Document Viewer (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900/5 p-4 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col overflow-auto max-h-[350px] lg:max-h-full">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                <span>Original Document</span>
              </span>

              {!isPdf && (
                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl shadow-2xs border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                    className="p-0.5 hover:bg-slate-100 rounded"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                  <span className="font-mono text-[11px] w-9 text-center">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                    className="p-0.5 hover:bg-slate-100 rounded"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-2 overflow-auto flex items-center justify-center min-h-[250px]">
              {isPdf ? (
                <iframe
                  src={bill.signedUrl}
                  title="Bill PDF Preview"
                  className="w-full h-full min-h-[450px] rounded-xl border-0"
                />
              ) : (
                <img
                  src={bill.signedUrl}
                  alt="Bill Preview"
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center', transition: 'transform 0.15s ease-out' }}
                  className="max-h-[500px] object-contain rounded-lg"
                />
              )}
            </div>
            <div className="mt-2 text-center text-[11px] text-slate-400 font-mono">
              {bill.fileName} ({bill.fileType?.toUpperCase()})
            </div>
          </div>

          {/* Right Column: Editable Review Form (7 cols) */}
          <div className="lg:col-span-7 flex flex-col overflow-auto p-5 sm:p-6 space-y-4">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <RefreshCw className="w-10 h-10 animate-spin text-emerald-600 mb-3" />
                <h4 className="font-bold text-slate-800 text-sm">{t('readingBill')}</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  {t('readingBillHint')}
                </p>
              </div>
            ) : (
              <form onSubmit={handleConfirm} className="space-y-4">
                {error && (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {success && (
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{t('billReviewSuccess')}</span>
                  </div>
                )}

                {/* Discrepancy Warning Banner (FR-6.8) */}
                {hasDiscrepancy && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-start gap-2.5 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">{t('discrepancyWarning')}</p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Sum of lines: <strong>₹{roundedLinesTotal.toFixed(2)}</strong> • Bill Grand Total: <strong>₹{numBillTotal?.toFixed(2)}</strong> • {t('discrepancyDiff')}: <strong>₹{discrepancyDiff.toFixed(2)}</strong>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Supplier, Bill Number & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {t('supplierShopName')}
                    </label>
                    <input
                      type="text"
                      list="review-suppliers"
                      value={supplierShopName}
                      onChange={(e) => setSupplierShopName(e.target.value)}
                      placeholder="e.g. Sri Balaji Traders"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    />
                    <datalist id="review-suppliers">
                      {existingSuppliers.map((s, i) => (
                        <option key={i} value={s} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {t('billNumber')}
                    </label>
                    <input
                      type="text"
                      value={billNumber}
                      onChange={(e) => setBillNumber(e.target.value)}
                      placeholder="e.g. INV-1044"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      {t('billDate')}
                    </label>
                    <input
                      type="date"
                      value={billDate}
                      onChange={(e) => setBillDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Line Items Table (FR-6.4, FR-6.5, FR-6.7) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {t('lineItems')} ({lineItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('addLineItem')}</span>
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[300px] overflow-auto pr-1">
                    {lineItems.map((item, index) => {
                      const lineCost = Math.round((Number(item.quantity) || 0) * (Number(item.costPrice) || 0) * 100) / 100;

                      return (
                        <div
                          key={index}
                          className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleLineChange(index, 'name', e.target.value)}
                                placeholder="Item name (e.g. Sugar / చక్కెర)"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                required
                              />

                              {item.isNewItem ? (
                                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200" title={t('willCreateNewItem')}>
                                  {t('newItemBadge')}
                                </span>
                              ) : (
                                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200" title={`${t('willUpdateStock')} +${item.quantity}`}>
                                  {t('existingItemBadge')}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveLine(index)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title={t('removeLineItem')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Qty</span>
                              <input
                                type="number"
                                step="any"
                                min="0.001"
                                value={item.quantity}
                                onChange={(e) => handleLineChange(index, 'quantity', e.target.value)}
                                className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-mono font-bold bg-white"
                                required
                              />
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Unit</span>
                              <select
                                value={item.unit}
                                onChange={(e) => handleLineChange(index, 'unit', e.target.value)}
                                className="w-full px-1.5 py-1 rounded-lg border border-slate-300 text-xs font-semibold bg-white"
                              >
                                {COMMON_UNITS.map((u) => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Cost (CP ₹)</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.costPrice}
                                onChange={(e) => handleLineChange(index, 'costPrice', e.target.value)}
                                className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-mono bg-white"
                                required
                              />
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Selling (SP ₹)</span>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.sellingPrice || ''}
                                onChange={(e) => handleLineChange(index, 'sellingPrice', e.target.value)}
                                placeholder="Est. SP"
                                className="w-full px-2 py-1 rounded-lg border border-slate-300 text-xs font-mono bg-white"
                              />
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                            <span>Line Cost: <strong className="font-mono text-slate-800 font-bold">₹{lineCost.toFixed(2)}</strong></span>
                            {item.sellingPrice > item.costPrice && (
                              <span className="text-emerald-700 font-semibold">
                                +₹{(Number(item.sellingPrice) - Number(item.costPrice)).toFixed(2)} unit profit
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Total Summary & Bill Grand Total Input */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">{t('lineItemsTotal')}:</span>
                    <span className="font-mono font-bold text-sm text-slate-900">₹{roundedLinesTotal.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                    <label className="font-bold text-slate-800">{t('billTotalLabel')} (₹):</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={billTotal}
                      onChange={(e) => setBillTotal(e.target.value)}
                      placeholder={roundedLinesTotal.toFixed(2)}
                      className="w-32 px-2.5 py-1 text-right rounded-lg border border-slate-300 text-sm font-mono font-black text-slate-900 bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={confirming}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    {t('cancel')}
                  </button>

                  <button
                    type="submit"
                    disabled={confirming || lineItems.length === 0}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all inline-flex items-center gap-2 cursor-pointer"
                  >
                    {confirming ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{t('confirming')}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{t('confirmAndAddStock')}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

