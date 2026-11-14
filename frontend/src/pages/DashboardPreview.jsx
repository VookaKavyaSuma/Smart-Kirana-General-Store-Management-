import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { itemApi, supplierApi } from '../services/api';
import {
  Store,
  LogOut,
  Smartphone,
  Laptop,
  Tablet,
  CheckCircle,
  Shield,
  Layers,
  ShoppingBag,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  Package,
  Users,
} from 'lucide-react';

export default function DashboardPreview({ onNavigateTab }) {
  const { store, activeDevices, logoutAll, revokeDevice, refreshDevices } = useAuth();
  const { t } = useLanguage();

  const [revokingId, setRevokingId] = useState(null);
  const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Quick stats
  const [itemStats, setItemStats] = useState({ totalItems: 0, lowStockCount: 0 });
  const [supplierCount, setSupplierCount] = useState(0);

  useEffect(() => {
    itemApi.list().then((res) => {
      if (res.success && res.items) {
        setItemStats({
          totalItems: res.items.length,
          lowStockCount: res.items.filter((i) => i.isLowStock).length,
        });
      }
    }).catch(console.warn);

    supplierApi.list().then((res) => {
      if (res.success && res.suppliers) {
        setSupplierCount(res.suppliers.length);
      }
    }).catch(console.warn);
  }, []);

  const getDeviceIcon = (deviceName) => {
    if (deviceName?.includes('Mobile') || deviceName?.includes('Android') || deviceName?.includes('iPhone')) {
      return <Smartphone className="w-5 h-5 text-emerald-600" />;
    }
    if (deviceName?.includes('Tablet') || deviceName?.includes('iPad')) {
      return <Tablet className="w-5 h-5 text-indigo-600" />;
    }
    return <Laptop className="w-5 h-5 text-sky-600" />;
  };

  const handleRevoke = async (sessionId) => {
    setRevokingId(sessionId);
    try {
      await revokeDevice(sessionId);
    } finally {
      setRevokingId(null);
    }
  };

  const handleLogoutAll = async () => {
    setActionLoading(true);
    try {
      await logoutAll();
    } finally {
      setActionLoading(false);
      setShowLogoutAllConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-lg shadow-emerald-900/10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-medium text-emerald-100 mb-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />
              Phase 1 & Phase 2 Active: Items & Suppliers Live
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {t('welcome')}, {store?.shopName}!
            </h2>
            <p className="text-sm text-emerald-100 mt-1 max-w-xl">
              Track your stock, profits, and supplier accounts. Bilingual in Telugu and English.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowLogoutAllConfirm(true)}
              className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/25 text-white text-xs font-semibold backdrop-blur-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('logoutAll')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Cards (Phase 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Items Card */}
        <div
          onClick={() => onNavigateTab('items')}
          className="bg-white rounded-3xl p-6 border border-slate-200/80 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                {itemStats.totalItems} Items
              </span>
            </div>
            <h3 className="font-bold text-slate-900 text-lg group-hover:text-emerald-700 transition-colors">
              {t('navItems')}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Add items, upload photos (auto-shrunk), track cost/selling prices, and record sold stock.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-600">
            {itemStats.lowStockCount > 0 ? (
              <span className="text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {itemStats.lowStockCount} {t('lowStock')}
              </span>
            ) : (
              <span>Manage Inventory</span>
            )}
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Suppliers Card */}
        <div
          onClick={() => onNavigateTab('suppliers')}
          className="bg-white rounded-3xl p-6 border border-slate-200/80 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                {supplierCount} Suppliers
              </span>
            </div>
            <h3 className="font-bold text-slate-900 text-lg group-hover:text-indigo-700 transition-colors">
              {t('navSuppliers')}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              View supplier shop names, total amount spent, and profit earned from each wholesaler.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-indigo-600">
            <span>View Supplier Breakdown</span>
            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Multi-Device Sessions Manager (FR-1.8, FR-1.9, FR-12.7) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  {t('activeSessions')} (FR-1.9, FR-12.7)
                </h3>
              </div>
              <button
                onClick={refreshDevices}
                className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                title="Refresh devices"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              The same account can be logged in on multiple devices at once. Logging out on one device does not affect other devices.
            </p>

            <div className="space-y-3">
              {activeDevices.map((dev) => (
                <div
                  key={dev.id}
                  className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    dev.isCurrentDevice
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-slate-50/50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                      {getDeviceIcon(dev.deviceName)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900">
                          {dev.deviceName}
                        </span>
                        {dev.isCurrentDevice && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-600 text-white">
                            {t('thisDevice')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {t('lastActive')}: {new Date(dev.lastUsedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {!dev.isCurrentDevice && (
                    <button
                      onClick={() => handleRevoke(dev.id)}
                      disabled={revokingId === dev.id}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {revokingId === dev.id ? 'Disconnecting...' : t('revokeSession')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Store Profile */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
            <h3 className="font-bold text-slate-900 text-base mb-4">
              Store Profile (FR-12.2)
            </h3>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-slate-400 font-medium block">Shop Name</span>
                <span className="font-semibold text-slate-800 text-sm">{store?.shopName}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">User Name (Normalized)</span>
                <span className="font-mono font-semibold text-emerald-700 text-sm">
                  @{store?.username}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Mobile Number</span>
                <span className="font-mono font-medium text-slate-700">
                  +91 {store?.mobileNumber}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Low-Stock Alert Limit</span>
                <span className="font-semibold text-slate-700">
                  {store?.lowStockThreshold ?? 5} units
                </span>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50/60 rounded-3xl p-6 border border-emerald-200/70 text-xs text-emerald-900">
            <h4 className="font-bold mb-2 flex items-center gap-1.5 text-emerald-800">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Phase 2 Features Active
            </h4>
            <ul className="space-y-1.5 text-emerald-800 list-disc list-inside">
              <li>Item CRUD with Telugu & English names</li>
              <li>In-browser image shrinker before upload</li>
              <li>Auto supplier filing / 'No supplier' option</li>
              <li>Live profit per unit ($SP - CP$) & margin %</li>
              <li>Supplier metrics & total profit breakdown</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Logout All Devices Confirmation Modal */}
      {showLogoutAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-slate-900 text-lg">{t('logoutAll')}</h3>
              <p className="text-xs text-slate-500 mt-1">{t('logoutConfirm')}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowLogoutAllConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogoutAll}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Logging out...' : 'Yes, Log Out All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
