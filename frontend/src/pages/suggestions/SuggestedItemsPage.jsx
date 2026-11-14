import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { suggestionsApi } from '../../services/api';
import {
  Sparkles,
  Flame,
  AlertTriangle,
  Clock,
  Calendar,
  RefreshCw,
  TrendingUp,
  Package,
  Layers,
  Building2,
  Tag,
  ArrowRight,
  Info,
  CheckCircle,
  HelpCircle,
  Percent,
} from 'lucide-react';

export default function SuggestedItemsPage({ onNavigateTab }) {
  const { t } = useLanguage();
  const [period, setPeriod] = useState('last_30_days'); // 'last_30_days' | 'last_90_days' | 'all_time'
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'worth_buying' | 'fast_low' | 'slow_review'
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const fetchSuggestions = async (selectedPeriod) => {
    setLoading(true);
    setError('');
    try {
      const res = await suggestionsApi.getSuggestions(selectedPeriod);
      if (res.success) {
        setData(res);
      } else {
        setError(res.error || 'Failed to load suggestions');
      }
    } catch (err) {
      setError(err.message || 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions(period);
  }, [period]);

  const { worthBuyingMore = [], fastSellingRunningLow = [], lowProfitOrSlow = [], allRanked = [], totalItems = 0 } =
    data || {};

  const renderItemCard = (item, theme = 'emerald', listType = 'worth_buying') => {
    const isEmerald = theme === 'emerald';
    const isRose = theme === 'rose';
    const isAmber = theme === 'amber';

    let cardBorder = 'border-slate-200/80 hover:border-emerald-300';
    let badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    let accentColor = 'text-emerald-700';

    if (isRose) {
      cardBorder = 'border-rose-200/80 hover:border-rose-400 bg-rose-50/20';
      badgeBg = 'bg-rose-100 text-rose-800 border-rose-200';
      accentColor = 'text-rose-700';
    } else if (isAmber) {
      cardBorder = 'border-amber-200/80 hover:border-amber-400 bg-amber-50/20';
      badgeBg = 'bg-amber-100 text-amber-900 border-amber-200';
      accentColor = 'text-amber-700';
    }

    return (
      <div
        key={item.id}
        className={`bg-white rounded-3xl p-5 border transition-all shadow-xs flex flex-col justify-between ${cardBorder}`}
      >
        <div>
          {/* Header: Photo/Icon, Name & Score */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                {item.photoUrl ? (
                  <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-6 h-6 text-slate-400" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm leading-snug">{item.name}</h4>
                <span className="text-[11px] text-slate-400 block">{item.category}</span>
              </div>
            </div>

            {/* Composite Score Pill (FR-9.2) */}
            <div className="text-right shrink-0">
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200/70 inline-block">
                Score {item.score}
              </span>
            </div>
          </div>

          {/* Dynamic One-Line Reason (FR-9.4) */}
          <div className="mb-4">
            <div className={`p-2.5 rounded-2xl text-xs font-medium border flex items-center gap-2 ${badgeBg}`}>
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span className="leading-tight">{item.reason}</span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Margin</span>
              <span className="font-mono font-bold text-slate-900">{item.marginPercent}%</span>
              <span className="text-[10px] text-slate-500 block">₹{item.profitPerUnit}/unit</span>
            </div>

            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Sales Velocity</span>
              <span className="font-mono font-bold text-slate-900">{item.unitsSoldPerWeek} units/wk</span>
              <span className="text-[10px] text-slate-500 block">
                {item.unitsSoldInPeriod} {item.unit} sold
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Remaining</span>
              <span
                className={`font-mono font-bold ${
                  item.quantityRemaining <= 5 ? 'text-rose-600' : 'text-slate-900'
                }`}
              >
                {item.quantityRemaining} {item.unit}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {item.stockRunoutDays != null ? `~${item.stockRunoutDays} days left` : 'Stable stock'}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Profit in Period</span>
              <span className="font-mono font-black text-emerald-700">₹{item.profitEarnedInPeriod}</span>
              <span className="text-[10px] text-slate-500 block">Stock val: ₹{item.stockValue}</span>
            </div>
          </div>
        </div>

        {/* Footer: Supplier info & Cheapest Supplier Callout (FR-9.6) */}
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          {item.cheapestSupplier?.hasMultipleSuppliers ? (
            <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                <Tag className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('cheapestSupplierBadge') || 'Cheapest Wholesaler'} (FR-9.6):</span>
              </div>
              <p className="text-[11px] text-emerald-900 font-semibold mt-0.5">
                {item.cheapestSupplier.supplierName} at ₹{item.cheapestSupplier.costPrice}/{item.unit}
                {item.cheapestSupplier.savingsPerUnit > 0 && (
                  <span className="text-emerald-700 font-bold ml-1">
                    (Save ₹{item.cheapestSupplier.savingsPerUnit}/{item.unit})
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Supplier: {item.supplierName}</span>
              </span>
              <span className="font-mono">CP ₹{item.costPrice} | SP ₹{item.sellingPrice}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header & Period Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-emerald-600" />
            <span>{t('suggestionsTitle') || 'Smart Suggestions & Restock Analysis'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            {t('suggestionsSubtitle') ||
              'Recommendations ranked by profit margin (40%), total profit (40%), and sales velocity (20%).'}
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-semibold border border-emerald-200 mt-2">
            <Percent className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('scoringExplanation') || 'Scoring: 40% Margin + 40% Profit + 20% Velocity'}</span>
          </div>
        </div>

        {/* Period Selector Tabs (FR-9.5) */}
        <div className="flex items-center bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs">
          <button
            onClick={() => setPeriod('last_30_days')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              period === 'last_30_days'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {t('last30Days') || 'Last 30 Days'}
          </button>
          <button
            onClick={() => setPeriod('last_90_days')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              period === 'last_90_days'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {t('last90Days') || 'Last 90 Days'}
          </button>
          <button
            onClick={() => setPeriod('all_time')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              period === 'all_time'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {t('allTime') || 'All Time'}
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="py-24 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
          <p className="text-xs text-slate-500">Calculating recommendations & price comparisons...</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Helpful Empty State for New Stores (Acceptance Criteria) */}
      {!loading && totalItems === 0 && (
        <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200/80 shadow-xs max-w-xl mx-auto space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <Sparkles className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg">
              {t('emptySuggestionsTitle') || 'No inventory or sales data yet'}
            </h3>
            <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
              {t('emptySuggestionsDesc') ||
                'As you add items and record sales, Smart Kirana will automatically calculate velocity, margins, and profit to give you actionable restock suggestions.'}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => onNavigateTab && onNavigateTab('items')}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              Add First Item
            </button>
            <button
              onClick={() => onNavigateTab && onNavigateTab('purchases')}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
            >
              Record Purchase
            </button>
          </div>
        </div>
      )}

      {/* Section Navigation Tabs (When items exist) */}
      {!loading && totalItems > 0 && (
        <>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200/80">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              All 3 Lists Overview
            </button>
            <button
              onClick={() => setActiveTab('worth_buying')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'worth_buying'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('listWorthBuyingTitle') || 'Worth Buying More'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                {worthBuyingMore.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('fast_low')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'fast_low'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>{t('listFastLowTitle') || 'Fast-Selling Running Low'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                {fastSellingRunningLow.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('slow_review')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'slow_review'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{t('listSlowReviewTitle') || 'Low-Profit or Slow Items'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">
                {lowProfitOrSlow.length}
              </span>
            </button>
          </div>

          {/* LIST 1: Items Worth Buying More Of (FR-9.3 #1) */}
          {(activeTab === 'all' || activeTab === 'worth_buying') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-600" />
                    <span>{t('listWorthBuyingTitle') || 'Items Worth Buying More Of (List 1)'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('listWorthBuyingDesc') ||
                      'Top performers with strong profit margins and consistent sales volume.'}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {worthBuyingMore.length} recommendations
                </span>
              </div>

              {worthBuyingMore.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {worthBuyingMore.map((item) => renderItemCard(item, 'emerald', 'worth_buying'))}
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-6 text-center text-xs text-slate-400 border border-slate-200">
                  No items meet the top reorder threshold yet.
                </div>
              )}
            </div>
          )}

          {/* LIST 2: Fast-Selling Items Running Low (FR-9.3 #2) */}
          {(activeTab === 'all' || activeTab === 'fast_low') && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                    <Flame className="w-5 h-5 text-rose-600" />
                    <span>{t('listFastLowTitle') || 'Fast-Selling Items Running Low (List 2)'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('listFastLowDesc') ||
                      'High sales velocity with inventory running low. Restock urgently to avoid lost sales.'}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                  {fastSellingRunningLow.length} urgent items
                </span>
              </div>

              {fastSellingRunningLow.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fastSellingRunningLow.map((item) => renderItemCard(item, 'rose', 'fast_low'))}
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-6 text-center text-xs text-slate-400 border border-slate-200">
                  No fast-selling items are currently running low. Stock levels look healthy!
                </div>
              )}
            </div>
          )}

          {/* LIST 3: Low-Profit or Slow Items to Review (FR-9.3 #3) */}
          {(activeTab === 'all' || activeTab === 'slow_review') && (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-600" />
                    <span>{t('listSlowReviewTitle') || 'Low-Profit or Slow Items to Review (List 3)'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t('listSlowReviewDesc') ||
                      'Low margin or slow moving items taking up shelf space. Consider discounts or replacement.'}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  {lowProfitOrSlow.length} items to review
                </span>
              </div>

              {lowProfitOrSlow.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lowProfitOrSlow.map((item) => renderItemCard(item, 'amber', 'slow_review'))}
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-6 text-center text-xs text-slate-400 border border-slate-200">
                  No stagnant or low-margin items identified.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

