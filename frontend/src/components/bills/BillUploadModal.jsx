import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { billApi, supplierApi, purchaseApi } from '../../services/api';
import {
  X,
  Upload,
  Camera,
  FileText,
  File,
  Store,
  Calendar,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  ShieldCheck,
  Globe,
} from 'lucide-react';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export default function BillUploadModal({ isOpen, onClose, onBillUploaded, initialPurchaseId = null, initialSupplierName = '' }) {
  const { t } = useLanguage();

  const [billType, setBillType] = useState('SHOP'); // 'SHOP' | 'ONLINE'
  const [supplierName, setSupplierName] = useState(initialSupplierName || '');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [totalAmount, setTotalAmount] = useState('');
  const [purchaseId, setPurchaseId] = useState(initialPurchaseId || '');

  // File state
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  // Suggestions
  const [existingSuppliers, setExistingSuppliers] = useState([]);
  const [recentPurchases, setRecentPurchases] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccess(false);
      if (initialSupplierName) setSupplierName(initialSupplierName);
      if (initialPurchaseId) setPurchaseId(initialPurchaseId);

      // Load existing suppliers for autocomplete
      supplierApi.list().then((res) => {
        if (res.success && res.suppliers) {
          setExistingSuppliers(
            res.suppliers.filter((s) => !s.isUnassigned).map((s) => s.shopName)
          );
        }
      }).catch(console.warn);

      // Load recent purchases
      purchaseApi.list().then((res) => {
        if (res.success && res.purchases) {
          setRecentPurchases(res.purchases.slice(0, 15));
        }
      }).catch(console.warn);
    } else {
      // Clean up
      setSelectedFile(null);
      if (filePreview && !filePreview.startsWith('http')) {
        URL.revokeObjectURL(filePreview);
      }
      setFilePreview(null);
    }
  }, [isOpen, initialSupplierName, initialPurchaseId]);

  const handleFileSelect = (file) => {
    if (!file) return;

    // Check size limit: 10 MB (FR-6.3)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 10 MB.`);
      return;
    }

    // Check file type: JPG, PNG, PDF (FR-6.3)
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a JPG, PNG image or PDF document.');
      return;
    }

    setError('');
    setSelectedFile(file);

    // If it's an image, create preview
    if (file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      setFilePreview(previewUrl);
    } else {
      setFilePreview('PDF');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select or capture a bill document (photo, image, or PDF).');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('billFile', selectedFile);
      formData.append('billType', billType);
      if (supplierName.trim()) formData.append('supplierName', supplierName.trim());
      if (billNumber.trim()) formData.append('billNumber', billNumber.trim());
      if (billDate) formData.append('billDate', billDate);
      if (totalAmount && !isNaN(Number(totalAmount))) {
        formData.append('totalAmount', String(Number(totalAmount)));
      }
      if (purchaseId) formData.append('purchaseId', purchaseId);

      const res = await billApi.upload(formData);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          if (onBillUploaded) onBillUploaded(res.bill);
          onClose();
        }, 800);
      }
    } catch (err) {
      setError(err.message || 'Failed to upload bill. Please check the file and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {t('uploadBillTitle')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('fileSizeAndTypeLimit')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="px-6 py-2 bg-emerald-50/60 border-b border-emerald-100 flex items-center gap-2 text-xs text-emerald-800">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{t('secureStorageNotice')}</span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs font-semibold text-emerald-800 animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t('uploadSuccess')}</span>
            </div>
          )}

          {/* 1. Document Upload / Camera Capture (FR-6.1, FR-6.2) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              {t('billFile')} <span className="text-rose-500">*</span>
            </label>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
            {/* Phone Camera input (capture="environment") for rear camera (FR-6.1) */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />

            {!selectedFile ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Camera Capture Button */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50 transition-all text-center cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 group-hover:scale-105 transition-transform flex items-center justify-center text-emerald-700 mb-2">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-emerald-950">
                    {t('takeCameraPhoto')}
                  </span>
                  <span className="text-[11px] text-emerald-700/80 mt-0.5">
                    Phone camera (rear lens)
                  </span>
                </button>

                {/* File / PDF Browse Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100/70 transition-all text-center cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-200 group-hover:scale-105 transition-transform flex items-center justify-center text-slate-700 mb-2">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-800">
                    {t('chooseFileOrPdf')}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    JPG, PNG, or PDF up to 10 MB
                  </span>
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {filePreview === 'PDF' ? (
                    <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center font-bold text-xs">
                      <FileText className="w-6 h-6" />
                    </div>
                  ) : (
                    <img
                      src={filePreview}
                      alt="Preview"
                      className="w-12 h-12 rounded-xl object-cover border border-emerald-200 shadow-xs"
                    />
                  )}
                  <div>
                    <p className="text-xs font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                      {selectedFile.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type || 'Document'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setFilePreview(null);
                  }}
                  className="px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100/60 rounded-xl transition-colors cursor-pointer"
                >
                  {t('changeFile')}
                </button>
              </div>
            )}
          </div>

          {/* 2. Bill Type (Shop vs Online) (FR-6.1, FR-6.2) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              {t('billType')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                  billType === 'SHOP'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold shadow-2xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="billType"
                  value="SHOP"
                  checked={billType === 'SHOP'}
                  onChange={(e) => setBillType(e.target.value)}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <Store className="w-4 h-4 text-emerald-600" />
                <span className="text-xs">{t('shopBill')}</span>
              </label>

              <label
                className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                  billType === 'ONLINE'
                    ? 'border-purple-600 bg-purple-50/70 text-purple-950 font-bold shadow-2xs'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="billType"
                  value="ONLINE"
                  checked={billType === 'ONLINE'}
                  onChange={(e) => setBillType(e.target.value)}
                  className="text-purple-600 focus:ring-purple-500"
                />
                <Globe className="w-4 h-4 text-purple-600" />
                <span className="text-xs">{t('onlineInvoice')}</span>
              </label>
            </div>
          </div>

          {/* 3. Supplier Name & Bill Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                {t('supplierShopName')}
              </label>
              <input
                type="text"
                list="suppliers-list"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Sri Venkateshwara Traders"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <datalist id="suppliers-list">
                {existingSuppliers.map((name, i) => (
                  <option key={i} value={name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                {t('billNumber')}
              </label>
              <input
                type="text"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                placeholder={t('billNumberPlaceholder')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono"
              />
            </div>
          </div>

          {/* 4. Bill Date & Total Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                {t('billDate')}
              </label>
              <input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                {t('billAmount')}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder={t('billAmountPlaceholder')}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* 5. Associated Purchase (Optional) */}
          {recentPurchases.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                {t('attachToPurchase')}
              </label>
              <select
                value={purchaseId}
                onChange={(e) => setPurchaseId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">{t('noAssociatedPurchase')}</option>
                {recentPurchases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {new Date(p.purchaseDate).toLocaleDateString()} — {p.supplierShopName} (₹{p.totalAmount})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || !selectedFile}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('uploading')}</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>{t('uploadBill')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

