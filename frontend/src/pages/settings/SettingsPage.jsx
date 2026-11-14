import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { settingsApi, authApi } from '../../services/api';
import { compressImage } from '../../utils/imageCompressor';
import {
  Store,
  Camera,
  Trash2,
  Upload,
  Lock,
  Smartphone,
  Laptop,
  Tablet,
  Globe,
  Bell,
  AlertTriangle,
  Download,
  ShieldAlert,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  LogOut,
  Calendar,
  Phone,
  User,
  KeyRound,
} from 'lucide-react';

export default function SettingsPage({ onBackToDashboard }) {
  const { store, activeDevices, logout, logoutAll, revokeDevice, refreshDevices, updateStoreProfile } = useAuth();
  const { t, language, setLanguage } = useLanguage();

  // Loading & status states
  const [photoLoading, setPhotoLoading] = useState(false);
  const [prefLoading, setPrefLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Password change state (FR-12.4, FR-1.10)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [logoutAllDevicesOnPassChange, setLogoutAllDevicesOnPassChange] = useState(true);

  // Preferences state (FR-12.8)
  const [lowStockLimit, setLowStockLimit] = useState(store?.lowStockThreshold ?? 5);
  const [dailyReminder, setDailyReminder] = useState(store?.dailyReminderEnabled ?? true);

  // Mobile change state (FR-12.9)
  const [showMobileChange, setShowMobileChange] = useState(false);
  const [newMobileNumber, setNewMobileNumber] = useState('');
  const [mobileOtp, setMobileOtp] = useState('');
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [mobileDevCode, setMobileDevCode] = useState('');
  const [mobileLoading, setMobileLoading] = useState(false);

  // Logout all modal
  const [showLogoutAllModal, setShowLogoutAllModal] = useState(false);

  // Account deletion modal (FR-12.10)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteOtp, setDeleteOtp] = useState('');
  const [deleteOtpSent, setDeleteOtpSent] = useState(false);
  const [deleteDevCode, setDeleteDevCode] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // CSV export state
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    refreshDevices();
  }, []);

  const showNotification = (msg, isErr = false) => {
    if (isErr) {
      setErrorMsg(msg);
      setSuccessMsg('');
    } else {
      setSuccessMsg(msg);
      setErrorMsg('');
    }
    setTimeout(() => {
      setSuccessMsg('');
      setErrorMsg('');
    }, 5000);
  };

  // 1. Upload & shrink shop photo (FR-12.3)
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoLoading(true);
    try {
      // In-browser compression (FR-3.2, FR-12.3)
      const compressed = await compressImage(file, 1024, 1024, 0.85);
      const formData = new FormData();
      formData.append('photo', compressed.file);

      const res = await settingsApi.uploadPhoto(formData);
      if (res.success && res.photoUrl) {
        updateStoreProfile({ shopPhotoUrl: res.photoUrl });
        showNotification(t('photoUpdatedSuccess') || 'Shop photo updated successfully!');
      }
    } catch (err) {
      showNotification(err.message || 'Failed to upload photo', true);
    } finally {
      setPhotoLoading(false);
    }
  };

  // Remove shop photo
  const handleRemovePhoto = async () => {
    setPhotoLoading(true);
    try {
      const res = await settingsApi.removePhoto();
      if (res.success) {
        updateStoreProfile({ shopPhotoUrl: null });
        showNotification(t('photoRemovedSuccess') || 'Shop photo removed.');
      }
    } catch (err) {
      showNotification(err.message || 'Failed to remove photo', true);
    } finally {
      setPhotoLoading(false);
    }
  };

  // 2. Change password (FR-12.4, FR-1.10)
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showNotification('New password must have at least 8 characters.', true);
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification('New passwords do not match.', true);
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await settingsApi.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
        logoutAllDevices: logoutAllDevicesOnPassChange,
      });

      if (res.success) {
        showNotification(t('passwordChangedSuccess') || 'Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (logoutAllDevicesOnPassChange) {
          // Current session also ended if chosen
          setTimeout(() => logout(), 1500);
        }
      }
    } catch (err) {
      showNotification(err.message || 'Failed to change password.', true);
    } finally {
      setPasswordLoading(false);
    }
  };

  // 3. Update Preferences (FR-12.8)
  const handleSavePreferences = async (newLang = language, newThreshold = lowStockLimit, newReminder = dailyReminder) => {
    setPrefLoading(true);
    try {
      const res = await settingsApi.updatePreferences({
        language: newLang.toUpperCase(),
        lowStockThreshold: Number(newThreshold),
        dailyReminderEnabled: Boolean(newReminder),
      });

      if (res.success && res.store) {
        updateStoreProfile({
          language: res.store.language,
          lowStockThreshold: res.store.lowStockThreshold,
          dailyReminderEnabled: res.store.dailyReminderEnabled,
        });
        showNotification(t('preferencesUpdatedSuccess') || 'Preferences updated successfully!');
      }
    } catch (err) {
      showNotification(err.message || 'Failed to update preferences.', true);
    } finally {
      setPrefLoading(false);
    }
  };

  // 4. Change mobile number (FR-12.9)
  const handleRequestMobileOtp = async () => {
    const cleaned = newMobileNumber.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      showNotification('Please enter a valid 10-digit mobile number.', true);
      return;
    }

    setMobileLoading(true);
    try {
      const res = await settingsApi.requestChangeMobileOtp(cleaned);
      if (res.success) {
        setMobileOtpSent(true);
        if (res.devCode) setMobileDevCode(res.devCode);
        showNotification(`OTP sent to +91 ${cleaned}`);
      }
    } catch (err) {
      showNotification(err.message || 'Failed to send OTP.', true);
    } finally {
      setMobileLoading(false);
    }
  };

  const handleVerifyMobileOtp = async () => {
    setMobileLoading(true);
    try {
      const res = await settingsApi.verifyChangeMobileOtp(newMobileNumber, mobileOtp);
      if (res.success && res.newMobileNumber) {
        updateStoreProfile({ mobileNumber: res.newMobileNumber });
        setShowMobileChange(false);
        setMobileOtpSent(false);
        setNewMobileNumber('');
        setMobileOtp('');
        showNotification(t('mobileUpdatedSuccess') || 'Mobile number updated successfully!');
      }
    } catch (err) {
      showNotification(err.message || 'Invalid or expired OTP.', true);
    } finally {
      setMobileLoading(false);
    }
  };

  // 5. Export to CSV (FR-12.10)
  const handleExportCsv = async () => {
    setExportLoading(true);
    try {
      await settingsApi.downloadExportCsv();
      showNotification('CSV export downloaded successfully!');
    } catch (err) {
      showNotification(err.message || 'Failed to export CSV.', true);
    } finally {
      setExportLoading(false);
    }
  };

  // 6. Delete account flow (FR-12.10)
  const handleRequestDeleteOtp = async () => {
    if (!deletePassword) {
      showNotification('Please enter your password first.', true);
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await settingsApi.requestDeleteAccountOtp(deletePassword);
      if (res.success) {
        setDeleteOtpSent(true);
        if (res.devCode) setDeleteDevCode(res.devCode);
        showNotification('Deletion OTP sent to your registered mobile number.');
      }
    } catch (err) {
      showNotification(err.message || 'Failed to request deletion OTP.', true);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletePassword || !deleteOtp) {
      showNotification('Password and OTP code are required.', true);
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await settingsApi.confirmDeleteAccount(deletePassword, deleteOtp);
      if (res.success) {
        alert('Your store account has been permanently deleted.');
        window.location.reload();
      }
    } catch (err) {
      showNotification(err.message || 'Failed to delete account.', true);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Helper to format creation date
  const formatCreatedDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(language === 'te' ? 'te-IN' : 'en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return String(dateStr);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {t('settingsTitle') || 'Store Settings & Profile'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {t('settingsSubtitle') || 'Manage your store profile, shop photo, login devices, preferences, and security.'}
            </p>
          </div>
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="self-start sm:self-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              {t('back')}
            </button>
          )}
        </div>

        {/* Global Notifications */}
        {successMsg && (
          <div className="mt-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2.5 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* 1. Profile & Shop Photo (FR-12.2, FR-12.3) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-6">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Store className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900">{t('profileSection') || 'Store Profile'}</h2>
        </div>

        {/* Shop Photo Section */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
          <div className="relative w-24 h-24 rounded-2xl bg-white border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
            {store?.shopPhotoUrl ? (
              <img
                src={store.shopPhotoUrl}
                alt={store.shopName}
                className="w-full h-full object-cover"
              />
            ) : (
              <Store className="w-10 h-10 text-slate-300" />
            )}
            {photoLoading && (
              <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>

          <div className="space-y-2 flex-1">
            <h3 className="font-bold text-sm text-slate-900">{t('shopPhoto')}</h3>
            <p className="text-xs text-slate-500">
              {t('photoLimitNotice') || 'JPG or PNG, up to 5 MB. Shrunk in browser before upload. Shown on dashboard header.'}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors shadow-2xs">
                <Upload className="w-3.5 h-3.5" />
                <span>{store?.shopPhotoUrl ? t('changeShopPhoto') : t('uploadShopPhoto')}</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>

              {store?.shopPhotoUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('removeShopPhoto')}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Profile Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Shop Name (Read-Only) */}
          <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider">
              <span>{t('shopName')}</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 text-[10px] font-mono lowercase">
                {t('readOnlyBadge') || 'read-only'}
              </span>
            </div>
            <p className="font-bold text-slate-900 text-sm">{store?.shopName}</p>
          </div>

          {/* User Name (Read-Only) */}
          <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60">
            <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider">
              <span>{t('username')}</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 text-[10px] font-mono lowercase">
                {t('readOnlyBadge') || 'read-only'}
              </span>
            </div>
            <p className="font-bold font-mono text-emerald-700 text-sm">@{store?.username}</p>
          </div>

          {/* Mobile Number with Change option */}
          <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60 sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                {t('mobileNumber')}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowMobileChange(!showMobileChange);
                  setMobileOtpSent(false);
                }}
                className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
              >
                {showMobileChange ? t('cancel') : t('changeMobile')}
              </button>
            </div>
            <p className="font-bold font-mono text-slate-900 text-sm">+91 {store?.mobileNumber}</p>

            {/* Change Mobile Collapsible Form (FR-12.9) */}
            {showMobileChange && (
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-3 animate-in fade-in">
                {!mobileOtpSent ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="tel"
                      value={newMobileNumber}
                      onChange={(e) => setNewMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="Enter new 10-digit mobile number"
                      maxLength={10}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleRequestMobileOtp}
                      disabled={mobileLoading || newMobileNumber.length !== 10}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                    >
                      {mobileLoading ? t('saving') : t('sendOtpToNewMobile')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-600">
                      OTP sent to +91 {newMobileNumber}. {mobileDevCode && <span className="font-bold text-emerald-700">(Test code: {mobileDevCode})</span>}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={mobileOtp}
                        onChange={(e) => setMobileOtp(e.target.value.slice(0, 6))}
                        placeholder="Enter 6-digit OTP"
                        maxLength={6}
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyMobileOtp}
                        disabled={mobileLoading || mobileOtp.length !== 6}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                      >
                        {mobileLoading ? t('saving') : t('verifyAndUpdateMobile')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Account Creation Date */}
          <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/60 sm:col-span-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-600">{t('accountCreatedDate')}</span>
            </div>
            <span className="font-bold text-xs sm:text-sm text-slate-800">
              {formatCreatedDate(store?.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Store Preferences (FR-12.8) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Globe className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900">{t('preferencesSection') || 'Store Preferences'}</h2>
        </div>

        <div className="space-y-4">
          {/* Language Preference */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
            <div>
              <h4 className="font-bold text-sm text-slate-900">{t('appLanguage')}</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Saved to your store account and applies to all logged-in devices (FR-2.2).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLanguage('en');
                  handleSavePreferences('EN', lowStockLimit, dailyReminder);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  language === 'en'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => {
                  setLanguage('te');
                  handleSavePreferences('TE', lowStockLimit, dailyReminder);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  language === 'te'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                తెలుగు (Telugu)
              </button>
            </div>
          </div>

          {/* Low-Stock Alert Limit */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
            <div className="max-w-md">
              <h4 className="font-bold text-sm text-slate-900">{t('lowStockLimit')}</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('lowStockLimitHelp') || 'Items with remaining stock less than or equal to this limit will be flagged as Low Stock.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="1"
                value={lowStockLimit}
                onChange={(e) => setLowStockLimit(e.target.value)}
                className="w-20 px-3 py-1.5 rounded-xl border border-slate-300 text-sm font-bold text-center bg-white"
              />
              <button
                type="button"
                onClick={() => handleSavePreferences(language, lowStockLimit, dailyReminder)}
                disabled={prefLoading}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
              >
                {t('save')}
              </button>
            </div>
          </div>

          {/* Daily Online Reminder Switch */}
          <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
            <div>
              <h4 className="font-bold text-sm text-slate-900">{t('dailyReminderSwitch')}</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('dailyReminderHelp') || "Show a daily reminder prompt on the dashboard to record today's online payments."}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={dailyReminder}
                onChange={(e) => {
                  const newVal = e.target.checked;
                  setDailyReminder(newVal);
                  handleSavePreferences(language, lowStockLimit, newVal);
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* 3. Security & Change Password (FR-12.4, FR-1.10) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Lock className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900">{t('securitySection') || 'Security & Password'}</h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {t('currentPassword')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('newPasswordTwice')} (min 8) <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('confirmNewPassword')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <input
              type="checkbox"
              id="logoutAllCheck"
              checked={logoutAllDevicesOnPassChange}
              onChange={(e) => setLogoutAllDevicesOnPassChange(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <label htmlFor="logoutAllCheck" className="text-xs text-slate-600 cursor-pointer">
              {t('logoutOtherDevicesNotice') || 'Log out from all other devices after changing password'}
            </label>
          </div>

          <button
            type="submit"
            disabled={passwordLoading || !currentPassword || !newPassword}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors shadow-2xs"
          >
            {passwordLoading ? t('saving') : t('changePassword')}
          </button>
        </form>
      </div>

      {/* 4. Logged-in Devices Section (FR-12.7, FR-1.8 to FR-1.10, FR-12.5, FR-12.6) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">{t('devicesSection') || 'Logged-in Devices'}</h2>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-mono font-bold">
            {activeDevices.length} {t('activeDevicesCount') || 'active sessions'}
          </span>
        </div>

        <p className="text-xs text-slate-500">
          The same account can be logged in on multiple phones, tablets, or computers at the same time. You can log out any individual device below.
        </p>

        {/* Devices List */}
        <div className="space-y-2.5">
          {activeDevices.map((dev) => (
            <div
              key={dev.id}
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                dev.isCurrentDevice
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : 'bg-slate-50/70 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                  {dev.deviceName.includes('Mobile') || dev.deviceName.includes('Phone') ? (
                    <Smartphone className="w-4 h-4" />
                  ) : dev.deviceName.includes('Tablet') || dev.deviceName.includes('iPad') ? (
                    <Tablet className="w-4 h-4" />
                  ) : (
                    <Laptop className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs sm:text-sm text-slate-900">
                      {dev.deviceName}
                    </span>
                    {dev.isCurrentDevice && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold">
                        {t('thisDeviceBadge') || 'This Device'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Last used: {new Date(dev.lastUsedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {!dev.isCurrentDevice && (
                <button
                  type="button"
                  onClick={async () => {
                    await revokeDevice(dev.id);
                    showNotification('Device logged out successfully.');
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 cursor-pointer transition-colors"
                >
                  {t('logout')}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Global Logout Actions */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={logout}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer transition-colors"
          >
            {t('logoutThisDevice') || 'Log out from this device'}
          </button>

          <button
            type="button"
            onClick={() => setShowLogoutAllModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer transition-colors"
          >
            {t('logoutAllDevices') || 'Log out from all devices'}
          </button>
        </div>
      </div>

      {/* 5. Data & Account Management (FR-12.10) */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Download className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900">{t('dataSection') || 'Data & Account Management'}</h2>
        </div>

        {/* CSV Export */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/60">
          <div>
            <h4 className="font-bold text-sm text-slate-900">{t('exportAllCsv')}</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('exportAllCsvHelp') || 'Download a full backup of all items, suppliers, purchases, and bills in Excel/CSV format.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exportLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exportLoading ? 'Exporting...' : t('exportAllCsv')}</span>
          </button>
        </div>

        {/* Danger Zone: Delete Account */}
        <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-sm text-rose-900">{t('deleteAccount')}</h4>
            <p className="text-xs text-rose-700 mt-0.5">
              {t('deleteAccountHelp') || 'Permanently deletes your store account, inventory, suppliers, purchases, and bills. This cannot be undone.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer transition-colors whitespace-nowrap"
          >
            {t('deleteAccount')}
          </button>
        </div>
      </div>

      {/* Confirmation Modal: Log Out from All Devices */}
      {showLogoutAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {t('logoutAllDevices') || 'Log out from all devices?'}
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {t('logoutAllDevicesConfirm') || 'Every phone, tablet, and computer using this account will be logged out immediately.'}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowLogoutAllModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowLogoutAllModal(false);
                  await logoutAll();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Account (FR-12.10) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {t('deleteAccountConfirmTitle') || 'Confirm Permanent Account Deletion'}
              </h3>
              <p className="text-xs text-rose-600 mt-1 font-semibold">
                {t('deleteAccountNotice') || 'Requires current password and SMS OTP sent to registered mobile number.'}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('password')} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {!deleteOtpSent ? (
                <button
                  type="button"
                  onClick={handleRequestDeleteOtp}
                  disabled={deleteLoading || !deletePassword}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-black disabled:opacity-50 cursor-pointer"
                >
                  {deleteLoading ? 'Verifying...' : 'Verify Password & Request OTP'}
                </button>
              ) : (
                <div className="space-y-2 animate-in fade-in">
                  <p className="text-xs text-slate-600">
                    OTP sent to +91 {store?.mobileNumber}. {deleteDevCode && <span className="font-bold text-emerald-700">(Test code: {deleteDevCode})</span>}
                  </p>
                  <input
                    type="text"
                    value={deleteOtp}
                    onChange={(e) => setDeleteOtp(e.target.value.slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={deleteLoading || deleteOtp.length !== 6}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                  >
                    {deleteLoading ? 'Deleting...' : 'Permanently Delete Store & Data'}
                  </button>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                  setDeleteOtp('');
                  setDeleteOtpSent(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
