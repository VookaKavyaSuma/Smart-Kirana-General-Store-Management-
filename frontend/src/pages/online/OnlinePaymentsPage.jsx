import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { onlineApi, supplierApi } from '../../services/api';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  AlertTriangle,
  Download,
  Plus,
  CheckCircle,
  AlertCircle,
  Clock,
  Building2,
  Smartphone,
  Banknote,
  Search,
  Filter,
  X,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

export default function OnlinePaymentsPage() {
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'transactions' | 'suppliers'
  const [summary, setSummary] = useState(null);
  const [ledgerDays, setLedgerDays] = useState([]);
  const [ledgerMonths, setLedgerMonths] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Daily Entry Form State (FR-11.1)
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [entryLoading, setEntryLoading] = useState(false);
  const [entrySuccess, setEntrySuccess] = useState('');
  const [entryWarning, setEntryWarning] = useState('');

  // Add Transaction Modal State (FR-11.2)
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txAmount, setTxAmount] = useState('');
  const [txDateTime, setTxDateTime] = useState(new Date().toISOString().slice(0, 16));
  const [txCustomer, setTxCustomer] = useState('');
  const [txRef, setTxRef] = useState('');
  const [txNote, setTxNote] = useState('');
  const [txLoading, setTxLoading] = useState(false);

  // Pay Supplier Modal State (FR-11.4, FR-11.7)
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [paySupplierId, setPaySupplierId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  // Confirmation modal when payment exceeds remaining balance (FR-11.7)
  const [showOverdraftConfirm, setShowOverdraftConfirm] = useState(false);
  const [pendingPaymentData, setPendingPaymentData] = useState(null);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const filterParams = {};
      if (startDate) filterParams.startDate = startDate;
      if (endDate) filterParams.endDate = endDate;

      const [sumRes, ledgerRes, txsRes, suppPayRes, supRes] = await Promise.all([
        onlineApi.getSummary(filterParams),
        onlineApi.getRunningBalance(filterParams),
        onlineApi.getTransactions(filterParams),
        onlineApi.getSupplierPayments(filterParams),
        supplierApi.list(),
      ]);

      if (sumRes.success) setSummary(sumRes.summary);
      if (ledgerRes.success) {
        setLedgerDays(ledgerRes.days || []);
        setLedgerMonths(ledgerRes.months || []);
      }
      if (txsRes.success) setTransactions(txsRes.transactions || []);
      if (suppPayRes.success) setSupplierPayments(suppPayRes.payments || []);
      if (supRes.success) setSuppliersList(supRes.suppliers || []);
    } catch (err) {
      console.warn('Failed to load online data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [startDate, endDate]);

  // Submit Daily Entry (FR-11.1, FR-11.3)
  const handleSaveDailyEntry = async (e) => {
    e.preventDefault();
    const amt = parseFloat(entryAmount);
    if (isNaN(amt) || amt < 0) return;

    setEntryLoading(true);
    setEntrySuccess('');
    setEntryWarning('');
    try {
      const res = await onlineApi.upsertDailyEntry({
        date: entryDate,
        totalAmount: amt,
        note: entryNote.trim() || undefined,
      });

      if (res.success) {
        setEntrySuccess('Daily entry saved successfully!');
        if (res.hasDiscrepancy) {
          setEntryWarning(`Warning: Transactions sum (₹${res.transactionsTotal}) exceeds daily entry (₹${amt})!`);
        }
        loadAllData();
      }
    } catch (err) {
      alert(err.message || 'Failed to save daily entry');
    } finally {
      setEntryLoading(false);
    }
  };

  // Submit Online Transaction (FR-11.2)
  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    const amt = parseFloat(txAmount);
    if (!amt || amt <= 0) return;

    setTxLoading(true);
    try {
      const res = await onlineApi.createTransaction({
        amount: amt,
        dateTime: txDateTime,
        fromCustomer: txCustomer.trim() || undefined,
        referenceNumber: txRef.trim() || undefined,
        note: txNote.trim() || undefined,
      });

      if (res.success) {
        setIsTxModalOpen(false);
        setTxAmount('');
        setTxCustomer('');
        setTxRef('');
        setTxNote('');
        loadAllData();
      }
    } catch (err) {
      alert(err.message || 'Failed to create transaction');
    } finally {
      setTxLoading(false);
    }
  };

  // Submit Supplier Online Payment (FR-11.4, FR-11.7)
  const handlePaySupplier = async (e, force = false) => {
    if (e) e.preventDefault();
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0 || !paySupplierId) return;

    setPayLoading(true);
    try {
      const res = await onlineApi.createSupplierPayment({
        supplierId: paySupplierId,
        amount: amt,
        date: payDate,
        referenceNumber: payRef.trim() || undefined,
        note: payNote.trim() || undefined,
        force,
      });

      if (res.success) {
        setIsPayModalOpen(false);
        setShowOverdraftConfirm(false);
        setPendingPaymentData(null);
        setPayAmount('');
        setPayRef('');
        setPayNote('');
        loadAllData();
      }
    } catch (err) {
      // If 409 Conflict: payment exceeds remaining online balance (FR-11.7)
      if (err.message?.includes('exceeds remaining online balance')) {
        setPendingPaymentData({
          supplierId: paySupplierId,
          amount: amt,
          date: payDate,
          referenceNumber: payRef,
          note: payNote,
        });
        setShowOverdraftConfirm(true);
      } else {
        alert(err.message || 'Failed to record supplier payment');
      }
    } finally {
      setPayLoading(false);
    }
  };

  // Confirm payment exceeding balance
  const handleConfirmOverdraftPayment = () => {
    handlePaySupplier(null, true);
  };

  // Export CSV (FR-11.10)
  const handleExportCsv = async () => {
    try {
      await onlineApi.downloadExportCsv({ startDate, endDate });
    } catch (err) {
      alert(err.message || 'Failed to export CSV');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-1">
            <Wallet className="w-5 h-5" />
            <span className="text-xs uppercase font-bold tracking-wider">
              {t('navOnline') || 'Online Payments & Collections'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {t('onlineTitle') || 'Online Balance & Ledger'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('onlineSubtitle') || 'Track daily online collections, customer transactions, supplier payments, and running online balance.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsTxModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('addTransaction') || 'Add Transaction'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPayModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-md shadow-slate-900/20 transition-all cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            <span>{t('paySupplierOnline') || 'Pay Supplier'}</span>
          </button>
        </div>
      </div>

      {/* Optional Daily Online Entry Reminder Banner (FR-11.10) */}
      {summary?.isTodayMissing && (
        <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-amber-900">
                {t('dailyReminderBanner') || "Daily Online Entry Reminder: Today's online collection has not been recorded yet."}
              </h4>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Record your QR code settlement or today's online collection below.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('dailyEntryCard');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 transition-colors whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            {t('recordTodayEntry') || "Record Today's Entry"}
          </button>
        </div>
      )}

      {/* Top 4 Metrics Row (FR-11.5, FR-11.6) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Remaining Online Amount (Primary Highlight) */}
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 rounded-3xl p-5 text-white shadow-md shadow-indigo-600/20 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between opacity-90 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>{t('remainingOnlineAmount') || 'Remaining Online Balance'}</span>
            <Wallet className="w-4 h-4 text-indigo-200" />
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight">
            ₹{summary ? summary.remainingOnlineAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
          </p>
          <span className="text-[11px] text-indigo-200 font-medium mt-1 block">
            Online received − Supplier payments
          </span>
        </div>

        {/* Total Online Received */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {t('totalOnlineReceived') || 'Total Online Received'}
          </span>
          <p className="text-2xl font-black text-emerald-700 font-mono">
            ₹{summary ? summary.totalOnlineReceived.toFixed(2) : '0.00'}
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Collections from customers
          </span>
        </div>

        {/* Total Paid to Suppliers */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {t('totalOnlinePaidSuppliers') || 'Paid to Suppliers'}
          </span>
          <p className="text-2xl font-black text-rose-600 font-mono">
            ₹{summary ? summary.totalOnlinePaidToSuppliers.toFixed(2) : '0.00'}
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Outflow to supplier shops
          </span>
        </div>

        {/* Today's Online Received */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
              {t('todayOnlineReceived') || "Today's Collection"}
            </span>
            {summary?.hasTodayEntry ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Entry recorded"></span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-500" title="Pending entry"></span>
            )}
          </div>
          <p className="text-2xl font-black text-slate-900 font-mono">
            ₹{summary ? summary.todayReceived.toFixed(2) : '0.00'}
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {summary?.hasTodayEntry ? 'Official daily entry saved' : 'Estimated from live txs'}
          </span>
        </div>
      </div>

      {/* Daily Online Entry Form Card (FR-11.1, FR-11.3) */}
      <div id="dailyEntryCard" className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-900">
              {t('dailyEntrySection') || 'Daily Online Entry'}
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            {t('dailyEntryNotice') || 'One entry per day. This is the official counted figure for each day.'}
          </p>
        </div>

        {entrySuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{entrySuccess}</span>
          </div>
        )}
        {entryWarning && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{entryWarning}</span>
          </div>
        )}

        <form onSubmit={handleSaveDailyEntry} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="w-full sm:w-44">
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
              Date
            </label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              required
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>

          <div className="w-full sm:w-48">
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
              Total Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={entryAmount}
              onChange={(e) => setEntryAmount(e.target.value)}
              placeholder="e.g. 5000"
              required
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              value={entryNote}
              onChange={(e) => setEntryNote(e.target.value)}
              placeholder="e.g. PhonePe QR settlement"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={entryLoading || !entryAmount}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-2xs whitespace-nowrap self-stretch sm:self-auto"
          >
            {entryLoading ? t('saving') : t('saveDailyEntry') || 'Save Daily Entry'}
          </button>
        </form>
      </div>

      {/* Navigation Tabs (Ledger, Transactions, Supplier Payments) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'ledger'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('runningLedger') || 'Day-by-Day Running Ledger'}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'transactions'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('onlineTransactions') || 'Online Transactions'} ({transactions.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('suppliers')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'suppliers'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t('paymentsToSuppliers') || 'Payments to Suppliers'} ({supplierPayments.length})
            </button>
          </div>

          {/* Date Filter & CSV Export (FR-11.10) */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50"
              title="From Date"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50"
              title="To Date"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
                title="Clear dates"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Export Report to CSV (FR-11.10)"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Day-by-Day Running Ledger (FR-11.6, FR-11.10) */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">
            {/* Month-wise Aggregate Cards */}
            {ledgerMonths.length > 0 && (
              <div>
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block mb-2">
                  {t('monthlyBreakdown') || 'Month-wise Totals'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {ledgerMonths.map((m) => (
                    <div key={m.month} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="font-bold text-slate-900 text-xs block mb-1 font-mono">
                        {m.month}
                      </span>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Received:</span>
                        <span className="font-mono font-bold text-emerald-700">₹{m.totalReceived.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600 mt-0.5">
                        <span>Paid Suppliers:</span>
                        <span className="font-mono font-bold text-rose-600">₹{m.totalPaidSuppliers.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold pt-1.5 mt-1 border-t border-slate-200">
                        <span>Net Monthly:</span>
                        <span className={`font-mono ${m.netChange >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {m.netChange >= 0 ? '+' : ''}₹{m.netChange.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily Running Ledger Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Counted Received (₹)</th>
                    <th className="py-2.5 px-3">Daily Entry</th>
                    <th className="py-2.5 px-3">Tx Sum</th>
                    <th className="py-2.5 px-3">Paid Suppliers (₹)</th>
                    <th className="py-2.5 px-3">Net Day Change (₹)</th>
                    <th className="py-2.5 px-3 text-right">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerDays.map((d) => (
                    <tr key={d.date} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-slate-900">
                        {d.date}
                        {d.hasDiscrepancy && (
                          <span
                            className="ml-2 inline-flex items-center text-amber-600"
                            title={t('discrepancyAlert') || 'Transactions sum exceeds daily entry!'}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono font-black text-emerald-700">
                        ₹{d.effectiveReceived.toFixed(2)}
                      </td>
                      <td className="py-3 px-3">
                        {d.hasDailyEntry ? (
                          <span className="font-mono text-slate-800">₹{d.dailyEntryAmount.toFixed(2)}</span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No entry (using txs)</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        ₹{d.transactionsSum.toFixed(2)} ({d.transactionsCount})
                      </td>
                      <td className="py-3 px-3 font-mono text-rose-600">
                        ₹{d.paidSuppliers.toFixed(2)} ({d.supplierPaymentsCount})
                      </td>
                      <td className="py-3 px-3 font-mono font-bold">
                        <span className={d.netChange >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                          {d.netChange >= 0 ? '+' : ''}₹{d.netChange.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-slate-900 text-sm">
                        ₹{d.runningBalance.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Online Transactions (Receipts) (FR-11.2, FR-11.8) */}
        {activeTab === 'transactions' && (
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-xs">No online transactions recorded in this period.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <ArrowDownLeft className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            {tx.fromCustomer || 'General Customer'}
                          </span>
                          {tx.creditPaymentId && (
                            <span className="text-[10px] px-2 py-0.2 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                              Customer Credit Payment (FR-11.8)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(tx.dateTime).toLocaleString()}
                        </p>
                        {tx.referenceNumber && (
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Ref: {tx.referenceNumber}
                          </p>
                        )}
                        {tx.note && <p className="text-[11px] text-slate-600 italic mt-0.5">{tx.note}</p>}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-black text-sm text-emerald-700">
                        +₹{tx.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Payments to Suppliers (FR-11.4, FR-11.7) */}
        {activeTab === 'suppliers' && (
          <div className="space-y-3">
            {supplierPayments.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <p className="text-xs">No online supplier payments recorded in this period.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {supplierPayments.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">
                          {p.supplierShopName || 'Supplier'}
                        </h4>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(p.date).toLocaleDateString()}
                        </p>
                        {p.referenceNumber && (
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Ref: {p.referenceNumber}
                          </p>
                        )}
                        {p.note && <p className="text-[11px] text-slate-600 italic mt-0.5">{p.note}</p>}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-black text-sm text-rose-600">
                        -₹{p.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Online Transaction Modal (FR-11.2) */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  {t('addTransaction') || 'Add Online Transaction'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTxModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder="₹ 0.00"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Date & Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={txDateTime}
                  onChange={(e) => setTxDateTime(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  From Customer (Optional)
                </label>
                <input
                  type="text"
                  value={txCustomer}
                  onChange={(e) => setTxCustomer(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Reference Number (Optional)
                </label>
                <input
                  type="text"
                  value={txRef}
                  onChange={(e) => setTxRef(e.target.value)}
                  placeholder="e.g. UPI-9988771122"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                  placeholder="e.g. Evening grocery purchase"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTxModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={txLoading || !txAmount}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {txLoading ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Supplier Modal (FR-11.4) */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  {t('paySupplierOnline') || 'Pay Supplier Online'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handlePaySupplier(e, false)} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Select Supplier <span className="text-rose-500">*</span>
                </label>
                <select
                  value={paySupplierId}
                  onChange={(e) => setPaySupplierId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="">-- Select supplier shop --</option>
                  {suppliersList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shopName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Amount to Pay (₹) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-indigo-700 font-mono font-bold">
                    Available Online: ₹{summary ? summary.remainingOnlineAmount : '0'}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="₹ 0.00"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="e.g. NEFT-12345"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. Paid for rice delivery"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={payLoading || !payAmount || !paySupplierId}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-black disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {payLoading ? t('saving') : 'Record Supplier Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal when payment exceeds remaining balance (FR-11.7) */}
      {showOverdraftConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Payment Exceeds Online Balance (FR-11.7)
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                The payment amount of <strong className="font-mono text-rose-600">₹{pendingPaymentData?.amount}</strong> is greater than your current remaining online balance of <strong className="font-mono text-indigo-700">₹{summary?.remainingOnlineAmount}</strong>.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Do you still wish to record this supplier payment?
              </p>
            </div>
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowOverdraftConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmOverdraftPayment}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer"
              >
                Confirm & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

