import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { reportApi } from '../../services/api';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Layers,
  Wallet,
  CreditCard,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  AlertCircle,
  Building2,
  FileSpreadsheet,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
} from 'recharts';

export default function ReportsPage() {
  const { t } = useLanguage();
  const { store } = useAuth();

  const getCurrentMonth = () => {
    const d = new Date();
    const m = d.getMonth() + 1;
    return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}`;
  };

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [loading, setLoading] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Item table filters
  const [itemSearch, setItemSearch] = useState('');
  const [itemSortBy, setItemSortBy] = useState('profitEarned'); // 'profitEarned' | 'marginPercent' | 'unitsSold' | 'stockValue'

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await reportApi.getFullReport(selectedMonth);
      if (res.success) {
        setData(res.report);
      } else {
        setError(res.error || 'Failed to load report data');
      }
    } catch (err) {
      setError(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedMonth]);

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      await reportApi.downloadReportCsv(selectedMonth);
    } catch (err) {
      alert(err.message || 'Failed to export CSV');
    } finally {
      setExportingCsv(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading && !data) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
        <p className="text-xs text-slate-500">Loading Profit Analysis & Financial Reports...</p>
      </div>
    );
  }

  const { metrics, itemRankings, supplierBreakdown, monthlyComparison } = data || {
    metrics: {},
    itemRankings: { rankedItems: [] },
    supplierBreakdown: { suppliers: [] },
    monthlyComparison: { monthlyHistory: [] },
  };

  // Filter and sort items
  const filteredItems = (itemRankings.rankedItems || [])
    .filter((item) => {
      if (!itemSearch.trim()) return true;
      const q = itemSearch.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.supplierName.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (itemSortBy === 'profitEarned') return b.profitEarned - a.profitEarned;
      if (itemSortBy === 'marginPercent') return b.marginPercent - a.marginPercent;
      if (itemSortBy === 'unitsSold') return b.unitsSold - a.unitsSold;
      if (itemSortBy === 'stockValue') return b.stockValue - a.stockValue;
      return 0;
    });

  // Prepare chart data for Top & Bottom Items (max 5 each)
  const topItems = (itemRankings.rankedItems || []).slice(0, 5).map((i) => ({
    name: i.name.length > 14 ? i.name.slice(0, 14) + '…' : i.name,
    profit: i.profitEarned,
  }));

  const bottomItems = (itemRankings.rankedItems || [])
    .slice(-5)
    .reverse()
    .map((i) => ({
      name: i.name.length > 14 ? i.name.slice(0, 14) + '…' : i.name,
      profit: i.profitEarned,
    }));

  // Prepare supplier chart data
  const supplierChartData = (supplierBreakdown.suppliers || []).map((s) => ({
    name: s.shopName.length > 14 ? s.shopName.slice(0, 14) + '…' : s.shopName,
    profit: s.profitEarned,
    spent: s.totalSpent,
  }));

  return (
    <div className="space-y-8 pb-12 print:space-y-4 print:pb-0">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:border-b print:pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-emerald-600 print:hidden" />
            <span>{t('reportsTitle') || 'Profit Analysis & Store Reports'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            {t('reportsSubtitle') ||
              'Track overall cost, stock value, item margins, supplier profits, and month-over-month trends.'}
          </p>
          <div className="hidden print:block mt-1 text-xs text-slate-600">
            <strong>Store:</strong> {store?.shopName} (@{store?.username}) |{' '}
            <strong>Report Date:</strong> {new Date().toLocaleDateString()}
          </div>
        </div>

        {/* Action Controls: Month selector, CSV Export & Print (hidden when printing) */}
        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-2xl px-3 py-1.5 shadow-2xs">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-bold text-slate-800 bg-transparent border-none outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Download CSV Report"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>{exportingCsv ? 'Exporting...' : t('exportCsv') || 'Export CSV'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Print or Save as PDF"
          >
            <Printer className="w-4 h-4" />
            <span>{t('exportPdf') || 'Print / Save PDF'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Dashboard Overview Metrics (FR-8.1, FR-8.8) */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-emerald-600" />
          <span>{t('financialOverview') || 'Financial Overview'}</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Overall Cost */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {t('overallCost') || 'Overall Cost'}
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-1 block">
              ₹{Number(metrics.overallCost || 0).toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Total spent on all purchases
            </span>
          </div>

          {/* Stock Value */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {t('stockValue') || 'Value of Stock'}
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-1 block">
              ₹{Number(metrics.stockValue || 0).toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-500 mt-1 block">
              {metrics.quantityRemaining || 0} units remaining
            </span>
          </div>

          {/* Profit Earned on Units Sold */}
          <div className="bg-emerald-50/70 rounded-3xl p-5 border border-emerald-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              {t('profitEarned') || 'Realized Profit'}
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-900 mt-1 block">
              ₹{Number(metrics.profitEarned || 0).toFixed(2)}
            </span>
            <span className="text-[10px] text-emerald-700 mt-1 block">
              Profit earned on sold stock
            </span>
          </div>

          {/* Expected Profit */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {t('expectedProfit') || 'Expected Profit'}
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-1 block">
              ₹{Number(metrics.expectedProfit || 0).toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-500 mt-1 block">
              On all {metrics.totalPurchasedUnits || 0} purchased units
            </span>
          </div>

          {/* Customer Credit Due */}
          <div className="bg-amber-50/70 rounded-3xl p-5 border border-amber-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-amber-600" />
              {t('totalCreditDue') || 'Credit Due'}
            </span>
            <span className="text-xl sm:text-2xl font-black text-amber-900 mt-1 block">
              ₹{Number(metrics.totalCreditDue || 0).toFixed(2)}
            </span>
            <span className="text-[10px] text-amber-700 mt-1 block">
              Pending debt from customers
            </span>
          </div>

          {/* Remaining Online Amount */}
          <div className="bg-teal-50/70 rounded-3xl p-5 border border-teal-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-teal-600" />
              {t('remainingOnlineAmount') || 'Online Balance'}
            </span>
            <span className="text-xl sm:text-2xl font-black text-teal-900 mt-1 block">
              ₹{Number(metrics.remainingOnlineAmount || 0).toFixed(2)}
            </span>
            <span className="text-[10px] text-teal-700 mt-1 block">
              Received minus paid suppliers
            </span>
          </div>

          {/* Total Purchased Items */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              {t('navItems') || 'Total Inventory'}
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 mt-1 block">
              {metrics.totalItems || 0} Items
            </span>
            <span className="text-[10px] text-slate-500 mt-1 block">
              {metrics.lowStockCount > 0 ? (
                <span className="text-amber-600 font-bold">{metrics.lowStockCount} items running low</span>
              ) : (
                'Healthy stock levels'
              )}
            </span>
          </div>

          {/* Month-over-Month Quick Tile */}
          <div className="bg-sky-50/70 rounded-3xl p-5 border border-sky-200/80 shadow-xs">
            <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider block">
              {selectedMonth} Profit
            </span>
            <span className="text-xl sm:text-2xl font-black text-sky-900 mt-1 block">
              ₹{Number(monthlyComparison.selectedMonthProfit || 0).toFixed(2)}
            </span>
            <span className="text-[10px] text-sky-700 mt-1 block font-semibold flex items-center gap-1">
              {monthlyComparison.trend === 'UP' ? (
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
              ) : monthlyComparison.trend === 'DOWN' ? (
                <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
              ) : null}
              {monthlyComparison.difference >= 0 ? '+' : ''}
              ₹{monthlyComparison.difference} ({monthlyComparison.percentageChange}%) vs {monthlyComparison.previousMonth}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Month-over-Month Comparison & Trend Chart (FR-8.5, FR-8.7) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              <span>{t('monthlyProfitAnalysis') || 'Monthly Profit Comparison (FR-8.5)'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comparing profit earned in {monthlyComparison.selectedMonth} with previous month {monthlyComparison.previousMonth}.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                {monthlyComparison.selectedMonth} vs {monthlyComparison.previousMonth}
              </span>
              <span
                className={`text-sm font-black inline-flex items-center gap-0.5 ${
                  monthlyComparison.trend === 'UP'
                    ? 'text-emerald-600'
                    : monthlyComparison.trend === 'DOWN'
                    ? 'text-rose-600'
                    : 'text-slate-600'
                }`}
              >
                {monthlyComparison.trend === 'UP' ? '+' : ''}
                ₹{monthlyComparison.difference} ({monthlyComparison.percentageChange}%)
              </span>
            </div>
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                monthlyComparison.trend === 'UP'
                  ? 'bg-emerald-100 text-emerald-800'
                  : monthlyComparison.trend === 'DOWN'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {monthlyComparison.trend === 'UP' ? 'PROFIT UP' : monthlyComparison.trend === 'DOWN' ? 'PROFIT DOWN' : 'EQUAL'}
            </span>
          </div>
        </div>

        {/* Recharts Monthly Profit Trend */}
        <div className="h-64 sm:h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyComparison.monthlyHistory} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                }}
                formatter={(value) => [`₹${Number(value).toFixed(2)}`, 'Profit Earned']}
              />
              <Bar dataKey="profitEarned" fill="#059669" radius={[8, 8, 0, 0]}>
                {monthlyComparison.monthlyHistory.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.month === monthlyComparison.selectedMonth ? '#059669' : '#94a3b8'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Maximum & Minimum Profit Highlights (FR-8.3, FR-8.4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Max & Min Item Highlights */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            <span>Item Profit Extremes (FR-8.3)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Max Profit Item */}
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                {t('maxProfitItem') || 'Highest Profit Item'}
              </span>
              <p className="font-black text-slate-900 text-base mt-1 truncate">
                {itemRankings.maxProfitItem?.name || 'N/A'}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-emerald-900 font-semibold">
                <span>Profit Earned:</span>
                <span className="font-bold">₹{itemRankings.maxProfitItem?.profitEarned ?? 0}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-700">
                <span>Margin:</span>
                <span>{itemRankings.maxProfitItem?.marginPercent ?? 0}%</span>
              </div>
            </div>

            {/* Min Profit Item */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                {t('minProfitItem') || 'Lowest Profit Item'}
              </span>
              <p className="font-black text-slate-900 text-base mt-1 truncate">
                {itemRankings.minProfitItem?.name || 'N/A'}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-700 font-semibold">
                <span>Profit Earned:</span>
                <span className="font-bold">₹{itemRankings.minProfitItem?.profitEarned ?? 0}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                <span>Margin:</span>
                <span>{itemRankings.minProfitItem?.marginPercent ?? 0}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Max & Min Supplier Highlights */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <span>Supplier Profit Extremes (FR-8.4)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Max Profit Supplier */}
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200">
              <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">
                {t('maxProfitSupplier') || 'Top Profit Wholesaler'}
              </span>
              <p className="font-black text-slate-900 text-base mt-1 truncate">
                {supplierBreakdown.maxProfitSupplier?.shopName || 'N/A'}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-indigo-900 font-semibold">
                <span>Profit Earned:</span>
                <span className="font-bold">₹{supplierBreakdown.maxProfitSupplier?.profitEarned ?? 0}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-indigo-700">
                <span>Total Spent:</span>
                <span>₹{supplierBreakdown.maxProfitSupplier?.totalSpent ?? 0}</span>
              </div>
            </div>

            {/* Min Profit Supplier */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                {t('minProfitSupplier') || 'Lowest Profit Wholesaler'}
              </span>
              <p className="font-black text-slate-900 text-base mt-1 truncate">
                {supplierBreakdown.minProfitSupplier?.shopName || 'N/A'}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-700 font-semibold">
                <span>Profit Earned:</span>
                <span className="font-bold">₹{supplierBreakdown.minProfitSupplier?.profitEarned ?? 0}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                <span>Total Spent:</span>
                <span>₹{supplierBreakdown.minProfitSupplier?.totalSpent ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Comparative Charts: Top/Bottom Items & Supplier Breakdown (FR-8.7) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:break-before-page">
        {/* Top 5 Items Chart */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <span>{t('topBottomItemsChart') || 'Top Profit-Generating Items'}</span>
          </h3>
          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topItems} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [`₹${value}`, 'Profit Earned']} />
                <Bar dataKey="profit" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Supplier Profit Chart */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <span>{t('supplierProfitChart') || 'Supplier Profit Breakdown'}</span>
          </h3>
          <div className="h-56 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={supplierChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value, name) => [`₹${value}`, name === 'profit' ? 'Profit' : 'Spent']} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="spent" name="Spent" fill="#cbd5e1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Item Profit Rankings Table (FR-8.2, FR-8.3) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>{t('itemProfitRankings') || 'Item-wise Profit & Margins (Ranked)'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cost price, selling price, profit per unit, margin %, and total profit earned per item.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto print:hidden">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search items..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <select
              value={itemSortBy}
              onChange={(e) => setItemSortBy(e.target.value)}
              className="py-1.5 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white cursor-pointer"
            >
              <option value="profitEarned">Sort: Highest Profit</option>
              <option value="marginPercent">Sort: Highest Margin %</option>
              <option value="unitsSold">Sort: Most Units Sold</option>
              <option value="stockValue">Sort: Highest Stock Value</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Item Name</th>
                <th className="py-3 px-3">Cost Price</th>
                <th className="py-3 px-3">Selling Price</th>
                <th className="py-3 px-3">Profit / Unit</th>
                <th className="py-3 px-3">Margin %</th>
                <th className="py-3 px-3">Sold</th>
                <th className="py-3 px-3">Remaining</th>
                <th className="py-3 px-3">Stock Value</th>
                <th className="py-3 px-3 text-right">Profit Earned</th>
                <th className="py-3 px-3">Supplier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-400 font-bold">{idx + 1}</td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-900 block">{item.name}</span>
                    <span className="text-[10px] text-slate-400 block">{item.category}</span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600">₹{item.costPrice}</td>
                  <td className="py-3 px-3 font-mono font-semibold text-slate-900">₹{item.sellingPrice}</td>
                  <td className="py-3 px-3 font-mono font-bold text-emerald-700">₹{item.profitPerUnit}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full font-mono font-bold text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {item.marginPercent}%
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-700">
                    {item.unitsSold} {item.unit}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-700">
                    {item.quantityRemaining} {item.unit}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600">₹{item.stockValue}</td>
                  <td className="py-3 px-3 font-mono font-black text-emerald-700 text-right text-sm">
                    ₹{item.profitEarned}
                  </td>
                  <td className="py-3 px-3 text-slate-600">{item.supplierName}</td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 text-xs">
                    No items found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Supplier-wise Breakdown Table (FR-8.4, FR-8.6) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <span>{t('supplierProfitAnalysis') || 'Supplier-wise Profit & Spent (FR-8.4, FR-8.6)'}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Total money spent per supplier, profit earned from their items, and online payments.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Supplier Name</th>
                <th className="py-3 px-3">Items Count</th>
                <th className="py-3 px-3">Units Purchased</th>
                <th className="py-3 px-3">Units Sold</th>
                <th className="py-3 px-3">Total Spent</th>
                <th className="py-3 px-3">Paid Online</th>
                <th className="py-3 px-3 text-right">Profit Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(supplierBreakdown.suppliers || []).map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-900">{s.shopName}</td>
                  <td className="py-3 px-3 font-mono text-slate-600">{s.itemCount} items</td>
                  <td className="py-3 px-3 font-mono text-slate-600">{s.totalPurchasedUnits}</td>
                  <td className="py-3 px-3 font-mono text-slate-600">{s.totalUnitsSold}</td>
                  <td className="py-3 px-3 font-mono font-semibold text-slate-900">₹{s.totalSpent}</td>
                  <td className="py-3 px-3 font-mono font-semibold text-sky-700">₹{s.totalPaidOnline}</td>
                  <td className="py-3 px-3 font-mono font-black text-indigo-700 text-right text-sm">
                    ₹{s.profitEarned}
                  </td>
                </tr>
              ))}
              {(supplierBreakdown.suppliers || []).length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No suppliers recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

