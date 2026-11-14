import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageToggle from '../../components/LanguageToggle';
import ForgotPasswordModal from './ForgotPasswordModal';
import { Store, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, ShieldCheck, Smartphone } from 'lucide-react';

export default function LoginPage({ onNavigateToRegister }) {
  const { login } = useAuth();
  const { t } = useLanguage();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!username.trim() || !password) {
      setError(t('requiredFields'));
      return;
    }

    setLoading(true);
    try {
      const res = await login(username.trim(), password);
      if (!res.success) {
        setError(res.error || t('invalidCredentials'));
      }
    } catch (err) {
      setError(err.message || t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      {/* Top Bar with Language Selector */}
      <div className="max-w-md w-full mx-auto flex justify-between items-center mb-6">
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

      <div className="max-w-md w-full mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Banner */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-6 py-6 text-white text-center">
          <h2 className="text-2xl font-bold tracking-tight">{t('login')}</h2>
          <p className="text-xs text-emerald-100 mt-1">
            {t('multiDeviceNotice')}
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-2xl flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {t('username')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. srilakshmistores"
                  autoCapitalize="none"
                  autoCorrect="off"
                  required
                  className="w-full pl-10 pr-3.5 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-slate-50/50"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Tip: Case-insensitive (e.g. "SRILAKSHMISTORES" works)
              </p>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  {t('password')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer"
                >
                  {t('forgotPassword')}
                </button>
              </div>
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
                  className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-slate-50/50"
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

            {/* Session notice */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 flex items-start gap-2.5">
              <Smartphone className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-600 leading-snug">
                {t('rememberDeviceNotice')}
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl text-sm transition-all shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{t('login')}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Switch to Register */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={onNavigateToRegister}
              className="text-xs sm:text-sm font-medium text-emerald-600 hover:text-emerald-700 cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>{t('noAccountYet')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        onPasswordResetSuccess={(msg) => setSuccessMessage(msg)}
      />
    </div>
  );
}

