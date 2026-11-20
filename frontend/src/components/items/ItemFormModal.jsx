import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { compressImage } from '../../utils/imageCompressor';
import { itemApi, supplierApi } from '../../services/api';
import VoiceMicButton from '../common/VoiceMicButton';
import {
  X,
  Upload,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Percent,
  RefreshCw,
  Trash2,
} from 'lucide-react';

const COMMON_CATEGORIES = [
  'Grains & Pulses',
  'Edible Oils',
  'Spices & Masalas',
  'Snacks & Biscuits',
  'Tea & Beverages',
  'Dairy & Eggs',
  'General Stores',
  'Flours',
];

const UNITS = [
  { value: 'KG', labelKey: 'unitKg' },
  { value: 'G', labelKey: 'unitG' },
  { value: 'LITRE', labelKey: 'unitLitre' },
  { value: 'ML', labelKey: 'unitMl' },
  { value: 'PIECE', labelKey: 'unitPiece' },
  { value: 'PACKET', labelKey: 'unitPacket' },
];

export default function ItemFormModal({ isOpen, onClose, onItemSaved, editItem = null }) {
  const { t } = useLanguage();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('KG');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [supplierShopName, setSupplierShopName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // Image shrinker state
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  const [existingSuppliers, setExistingSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load existing suppliers for autocomplete
  useEffect(() => {
    if (isOpen) {
      supplierApi.list().then((res) => {
        if (res.success && res.suppliers) {
          setExistingSuppliers(
            res.suppliers.filter((s) => !s.isUnassigned).map((s) => s.shopName)
          );
        }
      }).catch(console.warn);
    }
  }, [isOpen]);

  // Populate form if editing
  useEffect(() => {
    if (editItem) {
      setName(editItem.name || '');
      setCategory(editItem.category || '');
      setUnit(editItem.unit || 'KG');
      setCostPrice(editItem.currentCostPrice != null ? String(editItem.currentCostPrice) : '');
      setSellingPrice(editItem.currentSellingPrice != null ? String(editItem.currentSellingPrice) : '');
      setQuantity(editItem.quantityPurchased != null ? String(editItem.quantityPurchased) : '');
      setSupplierShopName(
        editItem.supplierShopName && editItem.supplierShopName !== 'No supplier'
          ? editItem.supplierShopName
          : ''
      );
      setPhotoUrl(editItem.photoUrl || '');
      setCompressionInfo(null);
    } else {
      setName('');
      setCategory('');
      setUnit('KG');
      setCostPrice('');
      setSellingPrice('');
      setQuantity('');
      setSupplierShopName('');
      setPhotoUrl('');
      setCompressionInfo(null);
    }
    setError('');
  }, [editItem, isOpen]);

  if (!isOpen) return null;

  // Real-time calculation of profit per unit & margin %
  const cpNum = parseFloat(costPrice) || 0;
  const spNum = parseFloat(sellingPrice) || 0;
  const calculatedProfitPerUnit = (spNum - cpNum).toFixed(2);
  const calculatedMargin = spNum > 0 ? (((spNum - cpNum) / spNum) * 100).toFixed(1) : '0';

  // Handle client-side image compression & upload (FR-3.2)
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setIsCompressing(true);

    try {
      // 1. Shrink image in browser
      const compressed = await compressImage(file, 1024, 1024, 0.8);
      setCompressionInfo({
        originalKb: Math.round(compressed.originalSize / 1024),
        compressedKb: Math.round(compressed.compressedSize / 1024),
        previewUrl: compressed.previewUrl,
      });

      // 2. Upload to storage interface
      setUploadLoading(true);
      const uploadRes = await itemApi.uploadPhoto(compressed.file);
      if (uploadRes.success && uploadRes.photoUrl) {
        setPhotoUrl(uploadRes.photoUrl);
      }
    } catch (err) {
      setError(err.message || 'Image processing failed');
    } finally {
      setIsCompressing(false);
      setUploadLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !category.trim() || costPrice === '' || sellingPrice === '') {
      setError(t('requiredFields'));
      return;
    }

    if (!editItem && (quantity === '' || parseFloat(quantity) < 0)) {
      setError('Please enter a valid initial quantity.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        category: category.trim(),
        unit,
        costPrice: parseFloat(costPrice),
        sellingPrice: parseFloat(sellingPrice),
        supplierShopName: supplierShopName.trim() || null,
        photoUrl: photoUrl || null,
      };

      if (!editItem) {
        payload.quantity = parseFloat(quantity);
        const res = await itemApi.create(payload);
        if (res.success) {
          onItemSaved(res.item);
          onClose();
        } else {
          setError(res.error || 'Failed to create item');
        }
      } else {
        const res = await itemApi.update(editItem.id, payload);
        if (res.success) {
          onItemSaved(res.item);
          onClose();
        } else {
          setError(res.error || 'Failed to update item');
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <h3 className="font-bold text-lg">
            {editItem ? t('editItem') : t('addItem')}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Photo Upload & In-Browser Shrinker (FR-3.2) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              {t('itemPhoto')} (JPG/PNG, Max 5 MB)
            </label>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
                {photoUrl || compressionInfo?.previewUrl ? (
                  <img
                    src={compressionInfo?.previewUrl || photoUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                )}
                {(isCompressing || uploadLoading) && (
                  <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-white animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-1.5">
                <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 cursor-pointer transition-colors shadow-2xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{photoUrl ? t('changePhoto') : t('uploadPhoto')}</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>

                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoUrl('');
                      setCompressionInfo(null);
                    }}
                    className="ml-2 inline-flex items-center gap-1 text-xs text-rose-600 hover:underline cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>{t('removePhoto')}</span>
                  </button>
                )}

                <p className="text-[11px] text-slate-500 leading-snug">
                  {t('photoShrinkNotice')}
                </p>

                {compressionInfo && (
                  <p className="text-[10px] text-emerald-700 font-medium">
                    ✓ Shrunk from {compressionInfo.originalKb} KB to {compressionInfo.compressedKb} KB
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Item Name (Telugu or English FR-3.1) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                {t('itemName')} <span className="text-rose-500">*</span>
              </label>
              <VoiceMicButton
                onTranscript={(txt) => setName(txt)}
                size="sm"
                title="Speak item name"
              />
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('itemNamePlaceholder')}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Category with quick pills */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {t('category')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t('selectCategory')}
              required
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {/* Quick suggestions */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {COMMON_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                    category === cat
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Unit & Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('unit')} <span className="text-rose-500">*</span>
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {t(u.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  {editItem ? t('quantityRemaining') : t('quantity')} <span className="text-rose-500">*</span>
                </label>
                {!editItem && (
                  <VoiceMicButton
                    onTranscript={(txt) => {
                      const num = parseFloat(txt.replace(/[^0-9.]/g, ''));
                      if (!isNaN(num)) setQuantity(String(num));
                    }}
                    size="sm"
                    title="Speak quantity"
                  />
                )}
              </div>
              <input
                type="number"
                step="0.001"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={!!editItem} // Stock updates in edit use quick-sold or restock
                placeholder="e.g. 50"
                required={!editItem}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>
          </div>

          {/* Pricing: CP and SP with Live Profit Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  {t('costPrice')} (₹) <span className="text-rose-500">*</span>
                </label>
                <VoiceMicButton
                  onTranscript={(txt) => {
                    const num = parseFloat(txt.replace(/[^0-9.]/g, ''));
                    if (!isNaN(num)) setCostPrice(String(num));
                  }}
                  size="sm"
                  title="Speak cost price"
                />
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="₹ 0.00"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  {t('sellingPrice')} (₹) <span className="text-rose-500">*</span>
                </label>
                <VoiceMicButton
                  onTranscript={(txt) => {
                    const num = parseFloat(txt.replace(/[^0-9.]/g, ''));
                    if (!isNaN(num)) setSellingPrice(String(num));
                  }}
                  size="sm"
                  title="Speak selling price"
                />
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="₹ 0.00"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Live Profit Preview Pill */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-emerald-800 font-semibold">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>{t('profitPerUnit')}:</span>
              <span className="font-mono text-sm font-bold text-emerald-900">
                ₹{calculatedProfitPerUnit}
              </span>
            </div>

            <div className="flex items-center gap-1 text-emerald-800 font-semibold">
              <Percent className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('marginPercentage')}:</span>
              <span className="font-mono font-bold text-emerald-900">
                {calculatedMargin}%
              </span>
            </div>
          </div>

          {/* Supplier Shop Name (FR-3.8) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              {t('supplierShopName')}
            </label>
            <input
              type="text"
              list="supplier-suggestions"
              value={supplierShopName}
              onChange={(e) => setSupplierShopName(e.target.value)}
              placeholder={t('supplierShopNamePlaceholder')}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
            <datalist id="supplier-suggestions">
              {existingSuppliers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <p className="text-[11px] text-slate-500 leading-snug">
              {t('supplierAutoHint')}
            </p>
          </div>

          {/* Submit & Cancel Buttons */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || isCompressing || uploadLoading}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>{t('save')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

