import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { creditApi, itemApi } from '../../services/api';
import {
  ArrowLeft,
  Phone,
  Plus,
  CreditCard,
  Banknote,
  Smartphone,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Package,
  Layers,
  TrendingUp,
  X,
  RefreshCw,
  Clock,
  AlertTriangle,
} from 'lucide-react';

export default function CustomerDetailPage({ customerId, onBack }) {
  const { t, language } = useLanguage();

  const [customer, setCustomer] = useState(null);
  const [summary, setSummary] = useState({ totalCredit: 0, totalPaid: 0, balanceDue: 0 });
  const [entries, setEntries] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Store items for credit entry dropdown
  const [storeItems, setStoreItems] = useState([]);

  // Modals
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Add Entry form state
  const [selectedItemId, setSelectedItemId] = useState('');
  const [entryName, setEntryName] = useState('');
  const [entryUnit, setEntryUnit] = useState('KG');
  const [entryQuantity, setEntryQuantity] = useState('');
  const [entryCp, setEntryCp] = useState('');
  const [entrySp, setEntrySp] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedItemStock, setSelectedItemStock] = useState(null);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState('');

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Delete entry confirmation
  const [deletingEntryId, setDeletingEntryId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [custRes, itemsRes] = await Promise.all([
        creditApi.getCustomer(customerId),
        itemApi.list(),
      ]);

      if (custRes.success) {
        setCustomer(custRes.customer);
        setSummary(custRes.summary);
        setEntries(custRes.entries || []);
        setPayments(custRes.payments || []);
      }
      if (itemsRes.success && itemsRes.items) {
        setStoreItems(itemsRes.items);
      }
    } catch (err) {
      console.warn('Failed to load customer details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      loadData();
    }
  }, [customerId]);

  // When an item is selected in Add Entry modal, pre-fill prices & unit
  const handleSelectItem = (itemId) => {
    setSelectedItemId(itemId);
    const it = storeItems.find((i) => i.id === itemId);
    if (it) {
      setEntryName(it.name);
      setEntryUnit(it.unit);
      setEntryCp(String(it.currentCostPrice));
      setEntrySp(String(it.currentSellingPrice));
      setSelectedItemStock(Number(it.quantityRemaining));
    } else {
      setSelectedItemStock(null);
    }
  };

  // Submit credit entry (FR-10.3, FR-10.5)
  const handleAddEntry = async (e) => {
    e.preventDefault();
    const qty = parseFloat(entryQuantity);
    if (!qty || qty <= 0) {
      setEntryError('Please enter a valid quantity.');
      return;
    }

    if (selectedItemStock !== null && qty > selectedItemStock) {
      setEntryError(`Quantity (${qty} ${entryUnit}) exceeds remaining stock (${selectedItemStock} ${entryUnit}).`);
      return;
    }

    setEntryLoading(true);
    setEntryError('');
    try {
      const res = await creditApi.addCreditEntry(customerId, {
        itemId: selectedItemId || undefined,
        itemName: entryName,
        quantity: qty,
        costPrice: parseFloat(entryCp) || 0,
        sellingPrice: parseFloat(entrySp) || 0,
        dateTaken: entryDate,
      });

      if (res.success) {
        setIsEntryModalOpen(false);
        resetEntryForm();
        loadData();
      }
    } catch (err) {
      setEntryError(err.message || 'Failed to save credit entry');
    } finally {
      setEntryLoading(false);
    }
  };

  const resetEntryForm = () => {
    setSelectedItemId('');
    setEntryName('');
    setEntryUnit('KG');
    setEntryQuantity('');
    setEntryCp('');
    setEntrySp('');
    setSelectedItemStock(null);
    setEntryError('');
  };

  // Submit payment (FR-10.6)
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      setPaymentError('Please enter a valid amount.');
      return;
    }

    setPaymentLoading(true);
    setPaymentError('');
    try {
      const res = await creditApi.recordPayment(customerId, {
        amount: amt,
        date: paymentDate,
        mode: paymentMode,
        referenceNumber: paymentRef.trim() || undefined,
        note: paymentNote.trim() || undefined,
      });

      if (res.success) {
        setIsPaymentModalOpen(false);
        resetPaymentForm();
        loadData();
      }
    } catch (err) {
      setPaymentError(err.message || 'Failed to record payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const resetPaymentForm = () => {
    setPaymentAmount('');
    setPaymentMode('CASH');
    setPaymentRef('');
    setPaymentNote('');
    setPaymentError('');
  };

  // Delete credit entry and restore stock (FR-10.5)
  const handleDeleteEntry = async (entryId) => {
    try {
      const res = await creditApi.deleteCreditEntry(customerId, entryId);
      if (res.success) {
        setDeletingEntryId(null);
        loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete entry');
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-600" />
        <p className="text-xs">Loading customer ledger...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <p className="text-sm font-bold text-slate-800">Customer not found</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200"
        >
          {t('back')}
        </button>
      </div>
    );
  }

  // Calculated metrics for Add Entry modal
  const calcQty = parseFloat(entryQuantity) || 0;
  const calcSp = parseFloat(entrySp) || 0;
  const calcCp = parseFloat(entryCp) || 0;
  const calcTotal = (calcQty * calcSp).toFixed(2);
  const calcProfit = (calcQty * (calcSp - calcCp)).toFixed(2);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header & Balance Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
              title="Back to Customers"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {customer.name}
              </h1>
              {customer.mobileNumber ? (
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  +91 {customer.mobileNumber}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">No mobile recorded</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                resetEntryForm();
                setIsEntryModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t('addCreditEntry') || 'Add Credit Entry'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                resetPaymentForm();
                if (summary.balanceDue > 0) {
                  setPaymentAmount(String(summary.balanceDue));
                }
                setIsPaymentModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-md shadow-slate-900/20 transition-all cursor-pointer"
            >
              <Banknote className="w-4 h-4 text-emerald-400" />
              <span>{t('recordPayment') || 'Record Payment'}</span>
            </button>
          </div>
        </div>

        {/* 3 Summary Metric Blocks (FR-10.7: Balance due = total credit - payments) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Credit Taken */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {t('totalCreditTaken') || 'Total Credit Taken'}
            </span>
            <p className="text-2xl font-black font-mono text-slate-800">
              ₹{summary.totalCredit.toFixed(2)}
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {entries.length} items recorded
            </span>
          </div>

          {/* Total Paid */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {t('totalPaidAmount') || 'Total Paid'}
            </span>
            <p className="text-2xl font-black font-mono text-emerald-700">
              ₹{summary.totalPaid.toFixed(2)}
            </p>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {payments.length} payments recorded
            </span>
          </div>

          {/* Balance Due (Highlighted) */}
          <div
            className={`p-4 rounded-2xl border ${
              summary.balanceDue > 0
                ? 'bg-rose-50 border-rose-200'
                : 'bg-emerald-50 border-emerald-200'
            }`}
          >
            <span
              className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${
                summary.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              {t('balanceDue') || 'Balance Due'}
            </span>
            <p
              className={`text-2xl font-black font-mono ${
                summary.balanceDue > 0 ? 'text-rose-700' : 'text-emerald-800'
              }`}
            >
              ₹{summary.balanceDue.toFixed(2)}
            </p>
            <span
              className={`text-[11px] font-medium mt-0.5 block ${
                summary.balanceDue > 0 ? 'text-rose-600' : 'text-emerald-700'
              }`}
            >
              {summary.balanceDue > 0 ? 'Pending payment' : 'Zero balance / Fully cleared'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Dual Sections (FR-10.8): Items Taken & Payments History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 Cols): Items Taken on Credit */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">
                  {t('itemsTaken') || 'Items Taken on Credit'}
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">
                {entries.length} entries
              </span>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              {t('profitOnCreditNotice') || 'Profit on credit items is counted on the date the items are given.'}
            </p>

            {entries.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-xs">No items taken on credit yet.</p>
                <button
                  type="button"
                  onClick={() => {
                    resetEntryForm();
                    setIsEntryModalOpen(true);
                  }}
                  className="mt-2 text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  + Add first credit entry
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0 mt-0.5">
                        <Package className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900">{entry.itemName}</h4>
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 font-bold">
                            {entry.quantity} units
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-1">
                          <span className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {new Date(entry.dateTaken).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <span>SP: ₹{entry.sellingPrice}</span>
                          <span>•</span>
                          <span>CP: ₹{entry.costPrice}</span>
                          <span>•</span>
                          <span className="text-emerald-700 font-bold">
                            Profit: +₹{entry.profit}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Total Due</span>
                        <span className="text-sm font-black font-mono text-slate-900">
                          ₹{entry.totalAmount.toFixed(2)}
                        </span>
                      </div>

                      {/* Delete Credit Entry Button (Restores Stock FR-10.5) */}
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(entry.id)}
                        title="Delete entry (restores quantity back to stock)"
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right (1 Col): Payments History (FR-10.6, FR-10.8) */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">
                  {t('paymentsRecorded') || 'Payments'}
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-slate-400">
                {payments.length} records
              </span>
            </div>

            {payments.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-xs">No payments recorded yet.</p>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="mt-2 text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  + Record first payment
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-emerald-700">
                          ₹{p.amount.toFixed(2)}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                            p.mode === 'ONLINE'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {p.mode}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" />
                        {new Date(p.date).toLocaleDateString()}
                      </p>
                      {p.referenceNumber && (
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Ref: {p.referenceNumber}
                        </p>
                      )}
                      {p.note && (
                        <p className="text-[11px] text-slate-600 italic mt-0.5">{p.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Credit Entry Modal (FR-10.3, FR-10.5) */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  {t('addCreditEntry') || 'Add Goods on Credit'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEntryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {entryError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{entryError}</span>
              </div>
            )}

            <form onSubmit={handleAddEntry} className="space-y-3.5">
              {/* Select Existing Store Item */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Choose Item from Inventory <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => handleSelectItem(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">-- Select store item --</option>
                  {storeItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} ({it.quantityRemaining} {it.unit} in stock - SP: ₹{it.currentSellingPrice})
                    </option>
                  ))}
                </select>
              </div>

              {/* Item Name (if custom or selected) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {t('itemName') || 'Item Name'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={entryName}
                  onChange={(e) => setEntryName(e.target.value)}
                  placeholder="e.g. Sugar / బియ్యం"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Quantity & Stock Check */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Quantity <span className="text-rose-500">*</span>
                    </label>
                    {selectedItemStock !== null && (
                      <span className={`text-[10px] font-bold ${calcQty > selectedItemStock ? 'text-rose-600' : 'text-emerald-700'}`}>
                        In stock: {selectedItemStock} {entryUnit}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={entryQuantity}
                    onChange={(e) => setEntryQuantity(e.target.value)}
                    placeholder="e.g. 2"
                    required
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                      selectedItemStock !== null && calcQty > selectedItemStock
                        ? 'border-rose-300 focus:ring-rose-500 bg-rose-50/30'
                        : 'border-slate-300 focus:ring-emerald-500'
                    }`}
                  />
                  {selectedItemStock !== null && calcQty > selectedItemStock && (
                    <p className="text-[10px] text-rose-600 font-semibold mt-1">
                      ⚠️ Refused: Exceeds remaining stock ({selectedItemStock} {entryUnit})
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    {t('dateTaken') || 'Date Taken'} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Selling Price & Cost Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Selling Price (SP) ₹ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={entrySp}
                    onChange={(e) => setEntrySp(e.target.value)}
                    placeholder="₹ 0.00"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Cost Price (CP) ₹
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={entryCp}
                    onChange={(e) => setEntryCp(e.target.value)}
                    placeholder="₹ 0.00"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Calculation Preview (FR-10.4, FR-10.10) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 block">Total Due from Customer:</span>
                  <span className="text-base font-black font-mono text-slate-900">₹{calcTotal}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 block">Profit on this item:</span>
                  <span className="text-sm font-black font-mono text-emerald-700">+₹{calcProfit}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEntryModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={
                    entryLoading ||
                    !entryName.trim() ||
                    calcQty <= 0 ||
                    (selectedItemStock !== null && calcQty > selectedItemStock)
                  }
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {entryLoading ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal (FR-10.6) */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  {t('recordPayment') || 'Record Customer Payment'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Amount Paid (₹) <span className="text-rose-500">*</span>
                  </label>
                  {summary.balanceDue > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(String(summary.balanceDue))}
                      className="text-[10px] text-emerald-700 font-bold hover:underline cursor-pointer"
                    >
                      Fill full balance (₹{summary.balanceDue})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="₹ 0.00"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-base font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Payment Mode (Cash or Online FR-10.6) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  {t('paymentMode') || 'Payment Mode'} <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('CASH')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      paymentMode === 'CASH'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>{t('cash') || 'Cash'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('ONLINE')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      paymentMode === 'ONLINE'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>{t('onlineUpi') || 'Online (UPI)'}</span>
                  </button>
                </div>
              </div>

              {paymentMode === 'ONLINE' && (
                <div className="animate-in fade-in">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    {t('referenceNumber') || 'UPI / UTR Reference (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="e.g. UPI-9988771122"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    ✓ Online payments are automatically recorded into Online Transactions (FR-10.6, FR-11.8).
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Payment Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Note (Optional)
                  </label>
                  <input
                    type="text"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="e.g. Part payment"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={paymentLoading || !paymentAmount}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {paymentLoading ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
