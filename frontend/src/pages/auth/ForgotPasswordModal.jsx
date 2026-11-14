import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { authApi } from '../../services/api';
import { X, KeyRound, Smartphone, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function ForgotPasswordModal({ isOpen, onClose, onPasswordResetSuccess }) {
  const { t } = useLanguage();
  const [step, setStep] = useState(1); // 1: username & mobile, 2: OTP & new password
  const [username, setUsername] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [logoutAllDevices, setLogoutAllDevices] = useState(true);
  const [devOtpHint, setDevOtpHint] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!username.trim() || !mobileNumber.trim()) {
      setError(t('requiredFields'));
      return;
    }

    if (mobileNumber.replace(/\D/g, '').length !== 10) {
      setError(t('invalidMobile'));
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.forgotPasswordRequest(username.trim(), mobileNumber);
      if (res.success) {
        setMessage(res.message);
        if (res.devCode) {
          setDevOtpHint(res.devCode);
        }
        setStep(2);
      } else {
        setError(res.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!otpCode || otpCode.length !== 6) {
      setError('Please enter the 6-digit OTP code');
      return;
    }

    if (newPassword.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.resetPassword({
        username: username.trim(),
        mobileNumber,
        otpCode,
        newPassword,
        logoutAllDevices,
      });

      if (res.success) {
        onPasswordResetSuccess(t('passwordResetSuccess'));
        handleClose();
      } else {
        setError(res.error || 'Password reset failed');
      }
    } catch (err) {
      setError(err.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setUsername('');
    setMobileNumber('');
    setOtpCode('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setMessage('');
    setDevOtpHint('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-lg">{t('resetPassword')}</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl flex items-start gap-2">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {devOtpHint && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl">
              <strong>[Demo Dev OTP]: </strong>
              <span className="font-mono font-bold tracking-widest text-sm bg-white px-2 py-0.5 rounded border border-amber-300">
                {devOtpHint}
              </span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <p className="text-sm text-slate-600">
                Enter your user name and registered mobile number. We will send an SMS OTP to reset your password.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('username')}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. srilakshmistores"
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('mobileNumber')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-sm">
                    +91
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    required
                    className="w-full pl-12 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Smartphone className="w-4 h-4" />
                  )}
                  {t('sendOtp')}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('otpCode')}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit code"
                  required
                  className="w-full px-3 py-2.5 text-center text-lg tracking-widest font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Single-use code, valid for 10 minutes (max 5 attempts).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('newPassword')}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('passwordPlaceholder')}
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('confirmNewPassword')}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('passwordPlaceholder')}
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="logoutAll"
                  checked={logoutAllDevices}
                  onChange={(e) => setLogoutAllDevices(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="logoutAll" className="text-xs text-slate-600 cursor-pointer">
                  {t('logoutAll')} (recommended for security)
                </label>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {t('resetPassword')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

