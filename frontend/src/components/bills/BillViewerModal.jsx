import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { billApi } from '../../services/api';
import {
  X,
  Download,
  Calendar,
  Store,
  FileText,
  File,
  ShieldCheck,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Clock,
  Tag,
  AlertCircle,
} from 'lucide-react';

export default function BillViewerModal({ isOpen, onClose, bill }) {
  const { t } = useLanguage();
  const [signedUrl, setSignedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && bill) {
      setZoomLevel(1);
      setError('');
      // If the bill object already has a fresh signedUrl, use it; otherwise fetch a new one
      if (bill.signedUrl) {
        setSignedUrl(bill.signedUrl);
      } else {
        fetchFreshLink();
      }
    }
  }, [isOpen, bill]);

  const fetchFreshLink = async () => {
    if (!bill) return;
    setLoading(true);
    setError('');
    try {
      const res = await billApi.getSignedUrl(bill.id, 'view');
      if (res.success && res.signedUrl) {
        setSignedUrl(res.signedUrl);
      }
    } catch (err) {
      setError(err.message || 'Failed to generate signed access link');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!bill) return;
    // Download link with mode=download forces Content-Disposition: attachment on server
    const downloadUrl = signedUrl.includes('?')
      ? `${signedUrl.replace('mode=view', '')}&mode=download`
      : `${signedUrl}?mode=download`;
    
    // Create temporary link to trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', bill.fileName || 'bill-document');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen || !bill) return null;

  const isPdf = bill.fileType?.toLowerCase() === 'pdf' || bill.fileName?.toLowerCase().endsWith('.pdf');
  const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(bill.fileType?.toLowerCase()) ||
    bill.fileName?.match(/\.(jpg|jpeg|png|webp)$/i);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
              bill.billType === 'ONLINE'
                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}>
              {isPdf ? <FileText className="w-5 h-5" /> : <File className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {bill.supplierName || t('noSupplier')}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  bill.billType === 'ONLINE'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {bill.billType === 'ONLINE' ? t('onlineBillBadge') : t('shopBillBadge')}
                </span>
                {bill.billNumber && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-200 text-slate-700">
                    #{bill.billNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>{new Date(bill.billDate).toLocaleDateString()}</span>
                {bill.totalAmount && (
                  <>
                    <span>•</span>
                    <span className="font-semibold text-slate-800">₹{Number(bill.totalAmount).toFixed(2)}</span>
                  </>
                )}
                <span>•</span>
                <span className="font-mono uppercase text-[11px]">{bill.fileType} ({(bill.fileSize / 1024).toFixed(0)} KB)</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('downloadBill')}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Security badge banner */}
        <div className="px-6 py-2 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{t('secureStorageNotice')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{t('linkExpiresIn')}</span>
          </div>
        </div>

        {/* Viewer Content Area */}
        <div className="flex-1 overflow-auto bg-slate-900/5 p-4 flex flex-col items-center justify-center min-h-[400px]">
          {error ? (
            <div className="p-6 text-center max-w-md bg-white rounded-2xl border border-rose-200 shadow-sm">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-rose-700 mb-3">{error}</p>
              <button
                onClick={fetchFreshLink}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Refresh Access Link
              </button>
            </div>
          ) : isPdf ? (
            <div className="w-full h-full min-h-[500px] flex flex-col">
              <iframe
                src={signedUrl}
                title={`Bill Document - ${bill.fileName}`}
                className="w-full h-[550px] rounded-2xl border border-slate-200 bg-white shadow-xs"
              />
              <div className="mt-2 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <span>PDF Document</span>
                <span>•</span>
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 hover:underline font-semibold inline-flex items-center gap-1"
                >
                  Open in new tab <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : isImage ? (
            <div className="flex flex-col items-center w-full">
              {/* Image Controls */}
              <div className="mb-2 flex items-center gap-2 bg-white px-3 py-1 rounded-xl shadow-xs border border-slate-200 text-xs text-slate-700">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.25))}
                  className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4 text-slate-600" />
                </button>
                <span className="font-mono text-xs w-12 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3, z + 0.25))}
                  className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4 text-slate-600" />
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="text-[11px] font-semibold text-emerald-700 hover:underline px-1 cursor-pointer"
                >
                  Reset
                </button>
              </div>

              {/* Responsive Image */}
              <div className="max-w-full max-h-[550px] overflow-auto rounded-2xl bg-white p-2 border border-slate-200 shadow-sm flex items-center justify-center">
                <img
                  src={signedUrl}
                  alt={`Bill from ${bill.supplierName}`}
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center', transition: 'transform 0.15s ease-out' }}
                  className="max-h-[500px] object-contain rounded-xl"
                  onError={() => setError('Unable to load image. The signed token may have expired.')}
                />
              </div>
            </div>
          ) : (
            <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 max-w-sm">
              <File className="w-12 h-12 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-800">{bill.fileName}</p>
              <p className="text-xs text-slate-500 mt-1 mb-4">{t('unsupportedFilePreview')}</p>
              <button
                onClick={handleDownload}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {t('downloadBill')}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>File: <strong className="font-mono text-slate-700">{bill.fileName}</strong></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}

