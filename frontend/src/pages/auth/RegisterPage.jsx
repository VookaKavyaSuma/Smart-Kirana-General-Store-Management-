import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageToggle from '../../components/LanguageToggle';
import { authApi } from '../../services/api';
import {
  Store,
  Lock,
  User,
  Phone,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
  Send,
  Timer,
} from 'lucide-react';

export default function RegisterPage({ onNavigateToLogin }) {
  const { register } = useAuth();
  const { lang, t } = useLanguage();

  const [shopName, setShopName] = useState('');
  const [derivedUsername, setDerivedUsername] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameMessage, setUsernameMessage] = useState('');

  const [mobileNumber, setMobileNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [devOtpHint, setDevOtpHint] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Live derivation of username from shop name (FR-1.2: all spaces removed, lowercase)
  useEffect(() => {
    const raw = shopName.replace(/\s+/gu, '').toLowerCase();
    setDerivedUsername(raw);

    if (raw.length >= 3) {
      setIsCheckingUsername(true);
      const timer = setTimeout(async () => {
        try {
          const res = await authApi.checkUsername(shopName);
          setUsernameAvailable(res.available);
          setUsernameMessage(res.message || '');
        } catch (err) {
          console.warn('Username check failed', err);
        } finally {
          setIsCheckingUsername(false);
        }
      }, 350);
      return () => clearTimeout(timer);
    } else {
      setUsernameAvailable(null);
      setUsernameMessage('');
      setIsCheckingUsername(false);
    }
  }, [shopName]);

  // Countdown timer for OTP
  useEffect(() => {
    if (otpTimer > 0) {
      const interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [otpTimer]);

  const handleSendOtp = async () => {
    setError('');
    const cleanMobile = mobileNumber.replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      setError(t('invalidMobile'));
      return;
    }

    setOtpLoading(true);
    try {
      const res = await authApi.sendOtp(cleanMobile, 'REGISTRATION');
      if (res.success) {
        setOtpSent(true);
        setOtpTimer(60); // 60 seconds resend cooldown (valid for 10 mins on server)
        setSuccess(`OTP sent to +91 ${cleanMobile}`);
        if (res.devCode) {
          setDevOtpHint(res.devCode);
        }
      } else {
        setError(res.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!shopName.trim() || !mobileNumber.trim() || !password) {
      setError(t('requiredFields'));
      return;
    }

    if (usernameAvailable === false) {
      setError(t('usernameTaken'));
      return;
    }

    if (!otpSent || !otpCode || otpCode.length !== 6) {
      setError('Please verify your mobile number with the 6-digit OTP code.');
      return;
    }

    if (password.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await register({
        shopName: shopName.trim(),
        password,
        mobileNumber: mobileNumber.replace(/\D/g, ''),
        otpCode: otpCode.trim(),
        language: lang === 'te' ? 'TE' : 'EN',
      });

      if (!res.success) {
        setError(res.error || 'Registration failed');
      }
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Bar with Language Selector */}
      <div className="max-w-lg w-full mx-auto flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
              {t('appTitle')}
            </h1>
            <p className="text-xs text-slate-500">{t('appSubtitle')}</p>
          </div>
        </div>
        <LanguageToggle />
      </div>

      <div className="max-w-lg w-full mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Banner */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-6 py-6 text-white text-center">
          <h2 className="text-2xl font-bold tracking-tight">{t('register')}</h2>
          <p className="text-xs text-emerald-100 mt-1">
            Setup your store in less than 2 minutes. One login per store.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl flex items-start gap-2.5">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
              <span>{success}</span>
            </div>
          )}

          {devOtpHint && (
            <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-2xl flex items-center justify-between">
              <div>
                <strong>[Demo Mode SMS OTP]: </strong>
                <span>Use code </span>
                <span className="font-mono font-bold tracking-widest text-sm bg-white px-2 py-0.5 rounded border border-amber-300">
                  {devOtpHint}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOtpCode(devOtpHint)}
                className="text-xs font-semibold text-amber-700 underline cursor-pointer"
              >
                Auto-fill
              </button>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            {/* 1. Shop Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('shopName')} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Store className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder={t('shopNamePlaceholder')}
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50/50"
                />
              </div>
            </div>

            {/* 2. User Name (Auto-filled & read-only rule preview FR-1.2, FR-1.3) */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {t('username')} (Auto-Generated)
                </span>
                {isCheckingUsername ? (
                  <span className="text-[11px] text-slate-400 animate-pulse">Checking...</span>
                ) : usernameAvailable === true ? (
                  <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Available
                  </span>
                ) : usernameAvailable === false ? (
                  <span className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> Name Taken
                  </span>
                ) : null}
              </div>

              <div className="mt-1.5 flex items-center gap-2">
                <div className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-medium text-slate-800 flex-1 truncate">
                  {derivedUsername ? `@${derivedUsername}` : '@srilakshmistores'}
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                {t('usernameAutoHint')}
              </p>
              {usernameMessage && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{usernameMessage}</p>
              )}
            </div>

            {/* 3. Mobile Number with OTP Verification (FR-1.5) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('mobileNumber')} <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-sm">
                    +91
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={mobileNumber}
                    disabled={otpSent && otpTimer > 0}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('mobileNumberPlaceholder')}
                    required
                    className="w-full pl-12 pr-3 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono bg-slate-50/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpLoading || (otpSent && otpTimer > 0)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-2xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {otpLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : otpSent && otpTimer > 0 ? (
                    <>
                      <Timer className="w-3.5 h-3.5" />
                      <span>{otpTimer}s</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{otpSent ? t('resendOtp') : t('sendOtp')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* OTP Code Input */}
            {otpSent && (
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-xs font-semibold text-emerald-900 mb-1">
                  {t('otpCode')} <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit code"
                    className="w-full px-3 py-2 text-center text-base tracking-widest font-mono rounded-xl border border-emerald-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-emerald-800 mt-1">
                  Enter the 6-digit code sent to your phone. Valid for 10 minutes.
                </p>
              </div>
            )}

            {/* 4. Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('password')} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('passwordPlaceholder')}
                  required
                  className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 5. Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('confirmNewPassword')} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('passwordPlaceholder')}
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50/50"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl text-sm transition-all shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t('register')}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Switch to Login */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="text-xs sm:text-sm font-medium text-emerald-600 hover:text-emerald-700 cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>{t('alreadyHaveAccount')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

