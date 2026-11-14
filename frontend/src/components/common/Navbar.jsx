import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageToggle from '../LanguageToggle';
import {
  Store,
  Package,
  Users,
  LayoutDashboard,
  ShoppingBag,
  Calculator,
  Receipt,
  LogOut,
} from 'lucide-react';

export default function Navbar({ currentTab, onSelectTab, onOpenCalculator }) {
  const { store, logout } = useAuth();
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          {/* Logo & Store Info */}
          <div className="flex items-center gap-3">
            <div
              onClick={() => onSelectTab('dashboard')}
              className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  onClick={() => onSelectTab('dashboard')}
                  className="font-bold text-slate-900 text-base leading-tight cursor-pointer hover:text-emerald-700 transition-colors"
                >
                  {store?.shopName}
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  @{store?.username}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                +91 {store?.mobileNumber}
              </p>
            </div>
          </div>

          {/* Right: Calculator, Language & Logout */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenCalculator}
              title={t('calculator')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
            >
              <Calculator className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">{t('calculator')}</span>
            </button>

            <LanguageToggle />

            <button
              onClick={logout}
              title={t('logout')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('logout')}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 border-t border-slate-100 py-1.5 overflow-x-auto">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              currentTab === 'dashboard'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>{t('navDashboard')}</span>
          </button>

          <button
            onClick={() => onSelectTab('items')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              currentTab === 'items'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>{t('navItems')}</span>
          </button>

          <button
            onClick={() => onSelectTab('purchases')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              currentTab === 'purchases'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{t('navPurchases')}</span>
          </button>

          <button
            onClick={() => onSelectTab('bills')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              currentTab === 'bills'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>{t('navBills')}</span>
          </button>

          <button
            onClick={() => onSelectTab('suppliers')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              currentTab === 'suppliers' || currentTab === 'supplier-detail'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{t('navSuppliers')}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
