import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { creditApi } from '../../services/api';
import {
  Users,
  UserPlus,
  Search,
  ArrowUpDown,
  CreditCard,
  Phone,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  TrendingDown,
  X,
  RefreshCw,
} from 'lucide-react';

export default function CustomersListPage({ onSelectCustomer }) {
  const { t, language } = useLanguage();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCreditDue, setTotalCreditDue] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [paidCount, setPaidCount] = useState(0);

  // Filters & sorting (FR-10.9)
  const [filter, setFilter] = useState('all'); // 'all' | 'unpaid' | 'paid'
  const [sort, setSort] = useState('highest_due'); // 'highest_due' | 'name' | 'recent'
  const [search, setSearch] = useState('');

  // Add customer modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await creditApi.listCustomers({ filter, sort, search });
      if (res.success) {
        setCustomers(res.customers || []);
        setTotalCreditDue(res.totalCreditDue || 0);
        setTotalCustomers(res.totalCustomers || 0);
        setUnpaidCount(res.unpaidCount || 0);
        setPaidCount(res.paidCount || 0);
      }
    } catch (err) {
      console.warn('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [filter, sort, search]);

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setFormLoading(true);
    setFormError('');
    try {
      const res = await creditApi.createCustomer({
        name: name.trim(),
        mobileNumber: mobileNumber.trim() || undefined,
      });

      if (res.success && res.customer) {
        setIsAddModalOpen(false);
        setName('');
        setMobileNumber('');
        // Open the newly created customer page directly
        if (onSelectCustomer) {
          onSelectCustomer(res.customer.id);
        } else {
          loadCustomers();
        }
      }
    } catch (err) {
      setFormError(err.message || 'Failed to create customer');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header & Total Credit Due Banner (FR-10.9) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-rose-600 mb-1">
            <CreditCard className="w-5 h-5" />
            <span className="text-xs uppercase font-bold tracking-wider">
              {t('navCredit') || 'Customer Credit / Debts'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {t('creditTitle') || 'Customer Credit Ledger'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('creditSubtitle') || 'Track customer credit entries, items taken, payments, and balances due.'}
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t('addCustomer') || 'Add Customer'}</span>
        </button>
      </div>

      {/* Metrics Row (FR-10.9: Total Credit Due at the top) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Credit Due (Highlighted) */}
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-3xl p-5 text-white shadow-md shadow-rose-600/20 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between opacity-90 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>{t('totalCreditDue') || 'Total Credit Due'}</span>
            <TrendingDown className="w-4 h-4 text-rose-200" />
          </div>
          <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight">
            ₹{totalCreditDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[11px] text-rose-100 font-medium mt-1 block">
            Across {unpaidCount} unpaid customers
          </span>
        </div>

        {/* Total Customers */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
            {t('totalCustomers') || 'Total Customers'}
          </span>
          <p className="text-2xl font-black text-slate-900 font-mono">
            {totalCustomers}
          </p>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Registered ledger accounts
          </span>
        </div>

        {/* Unpaid Count */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block mb-1">
            {t('unpaidCustomers') || 'Unpaid Customers'}
          </span>
          <p className="text-2xl font-black text-rose-600 font-mono">
            {unpaidCount}
          </p>
          <span className="text-[11px] text-rose-500 font-medium mt-1 block">
            With pending balance
          </span>
        </div>

        {/* Paid Count */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider block mb-1">
            {t('paidCustomers') || 'Fully Paid'}
          </span>
          <p className="text-2xl font-black text-emerald-700 font-mono">
            {paidCount}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">
            Zero balance due
          </span>
        </div>
      </div>

      {/* Controls: Search, Filters & Sorting (FR-10.9) */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer name or phone..."
              className="w-full pl-10 pr-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200/60 focus:bg-white text-xs sm:text-sm text-slate-900 border border-slate-200 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" /> Sort:
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="highest_due">{t('sortHighestDue') || 'Highest Due First'}</option>
              <option value="name">{t('sortName') || 'Customer Name (A-Z)'}</option>
              <option value="recent">{t('sortRecent') || 'Recently Active'}</option>
            </select>
          </div>
        </div>

        {/* Filter Pills (All / Unpaid / Paid) */}
        <div className="flex items-center gap-1.5 border-t border-slate-100 pt-3 overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              filter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t('filterAll') || 'All Customers'} ({totalCustomers})
          </button>

          <button
            type="button"
            onClick={() => setFilter('unpaid')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              filter === 'unpaid'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
            }`}
          >
            {t('filterUnpaid') || 'Unpaid (Due > 0)'} ({unpaidCount})
          </button>

          <button
            type="button"
            onClick={() => setFilter('paid')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              filter === 'paid'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            {t('filterPaid') || 'Paid (Due = 0)'} ({paidCount})
          </button>
        </div>
      </div>

      {/* Customer List Cards (FR-10.9) */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-600" />
          <p className="text-xs">Loading customer records...</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">
            {t('noCustomersFound') || 'No customers found'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search ? 'Try adjusting your search query or clear the filter.' : 'Click Add Customer above to start recording items on credit.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => {
            const hasDue = c.balanceDue > 0;
            return (
              <div
                key={c.id}
                onClick={() => onSelectCustomer && onSelectCustomer(c.id)}
                className={`bg-white rounded-3xl p-5 border transition-all cursor-pointer group flex flex-col justify-between hover:shadow-md ${
                  hasDue
                    ? 'border-slate-200 hover:border-rose-300'
                    : 'border-slate-200 hover:border-emerald-300'
                }`}
              >
                <div>
                  {/* Top: Customer Name & Due Badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h4 className="font-bold text-base text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {c.name}
                      </h4>
                      {c.mobileNumber ? (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                          <Phone className="w-3 h-3 text-slate-400" />
                          +91 {c.mobileNumber}
                        </p>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No mobile recorded</span>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        {t('balanceDue') || 'Balance Due'}
                      </span>
                      <span
                        className={`text-base font-black font-mono px-2 py-0.5 rounded-xl inline-block mt-0.5 ${
                          hasDue
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        ₹{c.balanceDue.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 mb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Credit Taken</span>
                      <span className="font-mono font-bold text-slate-800">₹{c.totalCredit.toFixed(2)}</span>
                      <span className="text-[10px] text-slate-400 block">({c.entriesCount} entries)</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Amount Paid</span>
                      <span className="font-mono font-bold text-emerald-700">₹{c.totalPaid.toFixed(2)}</span>
                      <span className="text-[10px] text-slate-400 block">({c.paymentsCount} payments)</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-emerald-700 font-bold group-hover:translate-x-0.5 transition-transform">
                  <span>{t('viewLedger') || 'View Ledger & Add Entry'}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Customer Modal (FR-10.2) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-base text-slate-900">
                  {t('addCustomer') || 'Add Credit Customer'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {t('customerName') || 'Customer Name'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar / సురేష్"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  {t('customerMobile') || 'Mobile Number (Optional)'}
                </label>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={formLoading || !name.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {formLoading ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

