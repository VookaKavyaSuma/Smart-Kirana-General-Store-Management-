import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { billApi, supplierApi } from '../../services/api';
import BillUploadModal from '../../components/bills/BillUploadModal';
import BillViewerModal from '../../components/bills/BillViewerModal';
import BillReviewModal from '../../components/bills/BillReviewModal';
import {
  FileText,
  Upload,
  Search,
  Filter,
  Calendar,
  Store,
  Globe,
  Download,
  Eye,
  Trash2,
  RefreshCw,
  AlertCircle,
  File,
  ShieldCheck,
  Tag,
  Receipt,
  Sparkles,
  CheckCircle,
} from 'lucide-react';

export default function BillsListPage() {
  const { t } = useLanguage();

  const [bills, setBills] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters (FR-6.10: supplier, date, bill number, Online/Shop type)
  const [supplierFilter, setSupplierFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState(''); // '' | 'SHOP' | 'ONLINE'
  const [billNumberFilter, setBillNumberFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [activeViewingBill, setActiveViewingBill] = useState(null);
  const [reviewingBill, setReviewingBill] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchBills = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await billApi.list({
        supplierName: supplierFilter || undefined,
        billType: typeFilter || undefined,
        billNumber: billNumberFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });

      if (res.success && res.bills) {
        setBills(res.bills);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [supplierFilter, typeFilter, billNumberFilter, dateFrom, dateTo]);

  useEffect(() => {
    supplierApi.list().then((res) => {
      if (res.success && res.suppliers) {
        setSuppliers(res.suppliers.filter((s) => !s.isUnassigned));
      }
    }).catch(console.warn);
  }, []);

  const handleDeleteBill = async (billId) => {
    if (!window.confirm(t('deleteBillConfirm'))) return;

    setDeletingId(billId);
    try {
      const res = await billApi.delete(billId);
      if (res.success) {
        setBills((prev) => prev.filter((b) => b.id !== billId));
      }
    } catch (err) {
      alert(err.message || 'Failed to delete bill');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadDirect = (bill) => {
    const downloadUrl = bill.signedUrl.includes('?')
      ? `${bill.signedUrl.replace('mode=view', '')}&mode=download`
      : `${bill.signedUrl}?mode=download`;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', bill.fileName || 'bill-file');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Stats
  const stats = useMemo(() => {
    const totalCount = bills.length;
    const shopCount = bills.filter((b) => b.billType === 'SHOP').length;
    const onlineCount = bills.filter((b) => b.billType === 'ONLINE').length;
    const totalAmount = bills.reduce((acc, b) => acc + (Number(b.totalAmount) || 0), 0);
    return { totalCount, shopCount, onlineCount, totalAmount };
  }, [bills]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {t('bills')}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {bills.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{t('secureStorageNotice')}</span>
          </p>
        </div>

        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>{t('uploadBill')}</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            {t('allBills')}
          </span>
          <span className="font-mono font-black text-xl text-slate-900 mt-1 block">
            {stats.totalCount}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
            {t('shopBill')}
          </span>
          <span className="font-mono font-black text-xl text-emerald-800 mt-1 block">
            {stats.shopCount}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider block">
            {t('onlineInvoice')}
          </span>
          <span className="font-mono font-black text-xl text-purple-800 mt-1 block">
            {stats.onlineCount}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Value
          </span>
          <span className="font-mono font-black text-xl text-slate-900 mt-1 block">
            ₹{stats.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Filter Bar (FR-6.10) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Filter className="w-4 h-4 text-emerald-600" />
          <span>Filters (FR-6.10)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Bill Number Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={billNumberFilter}
              onChange={(e) => setBillNumberFilter(e.target.value)}
              placeholder={t('filterByBillNumber')}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          {/* Supplier Filter */}
          <div>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">{t('allSuppliers')}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.shopName}>
                  {s.shopName}
                </option>
              ))}
            </select>
          </div>

          {/* Bill Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">{t('allTypes')}</option>
              <option value="SHOP">{t('shopBill')}</option>
              <option value="ONLINE">{t('onlineInvoice')}</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-1/2 px-2.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              title={t('dateFrom')}
            />
            <span className="text-slate-300">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-1/2 px-2.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              title={t('dateTo')}
            />
          </div>
        </div>

        {(supplierFilter || typeFilter || billNumberFilter || dateFrom || dateTo) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                setSupplierFilter('');
                setTypeFilter('');
                setBillNumberFilter('');
                setDateFrom('');
                setDateTo('');
              }}
              className="text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Bills Content */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
          <p className="text-xs text-slate-500">Loading bills & documents...</p>
        </div>
      ) : bills.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-base">{t('noBillsFound')}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4">
            Upload supplier bills via phone camera, PDF order documents from email, or WhatsApp receipts.
          </p>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{t('uploadBill')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bills.map((bill) => {
            const isPdf = bill.fileType?.toLowerCase() === 'pdf';

            return (
              <div
                key={bill.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          bill.billType === 'ONLINE'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {bill.billType === 'ONLINE' ? (
                          <>
                            <Globe className="w-3 h-3" />
                            <span>{t('onlineBillBadge')}</span>
                          </>
                        ) : (
                          <>
                            <Store className="w-3 h-3" />
                            <span>{t('shopBillBadge')}</span>
                          </>
                        )}
                      </span>

                      {bill.status === 'CONFIRMED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          <span>{t('statusConfirmed')}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          <span>{t('statusPendingReview')}</span>
                        </span>
                      )}
                    </div>

                    <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {bill.fileType} • {(bill.fileSize / 1024).toFixed(0)} KB
                    </span>
                  </div>

                  {/* Supplier & Bill Number */}
                  <h4 className="font-bold text-slate-900 text-base leading-snug">
                    {bill.supplierName || t('noSupplier')}
                  </h4>

                  {bill.billNumber ? (
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                      <Tag className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono font-semibold">#{bill.billNumber}</span>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs text-slate-400 italic">
                      No bill number
                    </div>
                  )}

                  {/* Date & Amount */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{new Date(bill.billDate).toLocaleDateString()}</span>
                    </div>

                    {bill.totalAmount ? (
                      <div className="font-mono font-black text-sm text-slate-900">
                        ₹{Number(bill.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">—</span>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Review & Confirm Button (FR-6.5) */}
                    <button
                      onClick={() => setReviewingBill(bill)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        bill.status === 'CONFIRMED'
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/30'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{bill.status === 'CONFIRMED' ? t('billDetails') : t('viewExtractedReview')}</span>
                    </button>

                    {/* View Document Button */}
                    <button
                      onClick={() => setActiveViewingBill(bill)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                      title={t('viewBill')}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{t('viewBill')}</span>
                    </button>

                    {/* Download Button */}
                    <button
                      onClick={() => handleDownloadDirect(bill)}
                      title={t('downloadBill')}
                      className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteBill(bill.id)}
                    disabled={deletingId === bill.id}
                    title={t('deleteBill')}
                    className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      <BillUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onBillUploaded={(newBill) => {
          fetchBills();
          if (newBill) {
            setReviewingBill(newBill);
          }
        }}
      />

      {/* Viewer Modal */}
      <BillViewerModal
        isOpen={Boolean(activeViewingBill)}
        onClose={() => setActiveViewingBill(null)}
        bill={activeViewingBill}
      />

      {/* Bill Review & Stock Confirmation Modal (FR-6.4 to FR-6.9) */}
      <BillReviewModal
        isOpen={Boolean(reviewingBill)}
        onClose={() => setReviewingBill(null)}
        bill={reviewingBill}
        onConfirmed={() => {
          fetchBills();
          setReviewingBill(null);
        }}
      />
    </div>
  );
}

