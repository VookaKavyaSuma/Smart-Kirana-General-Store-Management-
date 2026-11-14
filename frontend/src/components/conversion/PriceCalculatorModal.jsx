import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  calculatePriceForQuantity,
  calculateQuantityForAmount,
  generateReadyPriceChart,
} from '../../utils/calculations';
import {
  X,
  Calculator,
  Scale,
  IndianRupee,
  Table,
  Check,
  Zap,
} from 'lucide-react';

export default function PriceCalculatorModal({ isOpen, onClose, initialItem = null }) {
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState('chart'); // 'chart' | 'qtyToPrice' | 'priceToQty'
  const [sellingPrice, setSellingPrice] = useState('60'); // default ₹60 as per requirements
  const [baseUnit, setBaseUnit] = useState('KG'); // 'KG' | 'LITRE'

  // Quantity to price state
  const [inputQty, setInputQty] = useState('0.5'); // default 1/2 kg
  const [inputUnit, setInputUnit] = useState('KG');

  // Amount to quantity state
  const [inputAmount, setInputAmount] = useState('10'); // default ₹10

  // Pre-fill from item if opened for a specific item
  useEffect(() => {
    if (initialItem) {
      if (initialItem.currentSellingPrice) {
        setSellingPrice(String(initialItem.currentSellingPrice));
      }
      if (initialItem.unit === 'LITRE' || initialItem.unit === 'ML') {
        setBaseUnit('LITRE');
        setInputUnit('LITRE');
      } else {
        setBaseUnit('KG');
        setInputUnit('KG');
      }
    }
  }, [initialItem, isOpen]);

  if (!isOpen) return null;

  const spNum = parseFloat(sellingPrice) || 0;

  // Live calculations
  const calculatedPrice = calculatePriceForQuantity(spNum, parseFloat(inputQty) || 0, inputUnit);
  const calculatedQuantity = calculateQuantityForAmount(spNum, parseFloat(inputAmount) || 0, baseUnit);
  const readyChart = generateReadyPriceChart(spNum, baseUnit);

  const isLitre = baseUnit === 'LITRE';
  const baseLabel = isLitre ? 'litre' : 'kg';
  const subLabel = isLitre ? 'ml' : 'g';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">{t('unitConversion')}</h3>
              <p className="text-[11px] text-slate-400">
                {initialItem ? `${initialItem.name} (SP: ₹${sellingPrice})` : 'Live 2-Way Calculator (FR-4)'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Selling Price & Unit Input */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                {t('enterSellingPrice')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-sm">
                  ₹
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="60.00"
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 font-mono font-bold text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
            </div>

            {/* Base Unit Selector (KG vs LITRE) */}
            <div className="shrink-0">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Base Unit
              </label>
              <div className="inline-flex p-1 bg-slate-200 rounded-xl border border-slate-300">
                <button
                  type="button"
                  onClick={() => {
                    setBaseUnit('KG');
                    setInputUnit('KG');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    baseUnit === 'KG' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  kg / g
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBaseUnit('LITRE');
                    setInputUnit('LITRE');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    baseUnit === 'LITRE' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Litre / ml
                </button>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 text-xs font-bold">
            <button
              onClick={() => setActiveTab('chart')}
              className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'chart'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>{t('readyPriceChart')}</span>
            </button>

            <button
              onClick={() => setActiveTab('qtyToPrice')}
              className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'qtyToPrice'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>{t('quantityToPrice')}</span>
            </button>

            <button
              onClick={() => setActiveTab('priceToQty')}
              className={`pb-2.5 px-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'priceToQty'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <IndianRupee className="w-4 h-4" />
              <span>{t('amountToQuantity')}</span>
            </button>
          </div>

          {/* Tab 1: Ready Price Chart (FR-4.3) */}
          {activeTab === 'chart' && (
            <div className="space-y-4">
              <p className="text-[11px] text-slate-500">
                Ready pricing chart for loose goods at ₹{sellingPrice} per {baseLabel}.
              </p>

              {/* Standard Weights Table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-100 px-3.5 py-2 font-bold text-xs text-slate-700 flex items-center justify-between">
                  <span>Standard Weights (బరువుకు ధర)</span>
                  <span>Price (₹)</span>
                </div>
                <div className="divide-y divide-slate-100 text-xs font-semibold">
                  {readyChart.standardWeights.map((w) => (
                    <div key={w.label} className="px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50">
                      <span className="text-slate-700">{w.label}</span>
                      <span className="font-mono font-bold text-emerald-700 text-sm">
                        ₹{w.price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Standard Rupees Table */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-100 px-3.5 py-2 font-bold text-xs text-slate-700 flex items-center justify-between">
                  <span>Rupee Amounts (మొత్తానికి బరువు)</span>
                  <span>Quantity You Get</span>
                </div>
                <div className="divide-y divide-slate-100 text-xs font-semibold">
                  {readyChart.standardAmounts.map((a) => (
                    <div key={a.amount} className="px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50">
                      <span className="font-bold text-slate-900 font-mono">₹{a.amount}</span>
                      <span className="font-mono font-bold text-indigo-700 text-sm">
                        {a.formatted}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Quantity to Price (FR-4.1) */}
          {activeTab === 'qtyToPrice' && (
            <div className="space-y-4">
              <p className="text-[11px] text-slate-500">
                Enter any loose weight or volume to calculate exact selling price.
              </p>

              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={inputQty}
                  onChange={(e) => setInputQty(e.target.value)}
                  placeholder="e.g. 0.25"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                <select
                  value={inputUnit}
                  onChange={(e) => setInputUnit(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 font-bold text-xs bg-white"
                >
                  <option value={isLitre ? 'LITRE' : 'KG'}>{isLitre ? 'Litre (L)' : 'Kilogram (kg)'}</option>
                  <option value={isLitre ? 'ML' : 'G'}>{isLitre ? 'Millilitre (ml)' : 'Gram (g)'}</option>
                </select>
              </div>

              {/* Quick Presets */}
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => { setInputQty('1'); setInputUnit(baseUnit); }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  1 {baseLabel}
                </button>
                <button
                  type="button"
                  onClick={() => { setInputQty('0.5'); setInputUnit(baseUnit); }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  1/2 {baseLabel} (500 {subLabel})
                </button>
                <button
                  type="button"
                  onClick={() => { setInputQty('0.25'); setInputUnit(baseUnit); }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  1/4 {baseLabel} (250 {subLabel})
                </button>
                <button
                  type="button"
                  onClick={() => { setInputQty('100'); setInputUnit(isLitre ? 'ML' : 'G'); }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  100 {subLabel}
                </button>
              </div>

              {/* Calculated Result Card */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 uppercase block">
                    {t('calculatedPrice')}
                  </span>
                  <span className="text-xs text-emerald-700">
                    For {inputQty} {inputUnit.toLowerCase()}
                  </span>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-900">
                  ₹{calculatedPrice.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Amount to Quantity (FR-4.2) */}
          {activeTab === 'priceToQty' && (
            <div className="space-y-4">
              <p className="text-[11px] text-slate-500">
                Customer says "Give me ₹10 of sugar"? Type the amount to get the exact weight.
              </p>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 font-bold text-base">
                  ₹
                </div>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-base focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Amount Presets */}
              <div className="flex gap-1.5 flex-wrap">
                {[5, 10, 20, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setInputAmount(String(amt))}
                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              {/* Result Card */}
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-indigo-800 uppercase block">
                    {t('calculatedQuantity')}
                  </span>
                  <span className="text-xs text-indigo-700">
                    For ₹{inputAmount} at ₹{sellingPrice}/{baseLabel}
                  </span>
                </div>
                <div className="text-2xl font-black font-mono text-indigo-900">
                  {calculatedQuantity.formattedString}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

