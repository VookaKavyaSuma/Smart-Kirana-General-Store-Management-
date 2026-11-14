/**
 * Unified Financial and Unit Conversion Calculations Module (Requirements FR-4 & FR-5 & Section 5.2)
 *
 * All formulas are pure functions:
 * - Profit per unit = SP - CP
 * - Margin % = ((SP - CP) / SP) * 100
 * - Units sold = quantityPurchased - quantityRemaining
 * - Overall cost = sum(quantityPurchased * CP)
 * - Expected profit = sum(quantityPurchased * (SP - CP))
 * - Profit earned = sum(unitsSold * (SP - CP))
 * - Supplier profit = sum(unitsSold of its items * (SP - CP))
 *
 * Unit Conversions:
 * - 1 kg = 1000 g
 * - 1 litre = 1000 ml
 * - Price for weight = SP per kg * weight in kg
 * - Weight for amount = (amount / SP per kg) kg
 * - Money rounded to 2 decimals, weight/volume rounded to 1 decimal
 */

export type WeightVolumeUnit = 'KG' | 'G' | 'LITRE' | 'ML' | 'PIECE' | 'PACKET';

export interface ItemFinancials {
  quantityPurchased: number;
  quantityRemaining: number;
  costPrice: number;
  sellingPrice: number;
}

export interface PurchaseLineItem {
  quantity: number;
  costPrice: number;
  sellingPrice: number;
}

// ----------------------------------------------------
// 1. Profit & Margin Calculations (Section 5.2)
// ----------------------------------------------------

/**
 * Profit per unit: SP - CP
 */
export function calculateProfitPerUnit(costPrice: number, sellingPrice: number): number {
  const cp = Number(costPrice) || 0;
  const sp = Number(sellingPrice) || 0;
  return Number((sp - cp).toFixed(2));
}

/**
 * Profit margin %: ((SP - CP) / SP) * 100
 */
export function calculateMarginPercentage(costPrice: number, sellingPrice: number): number {
  const cp = Number(costPrice) || 0;
  const sp = Number(sellingPrice) || 0;
  if (sp <= 0) return 0;
  const margin = ((sp - cp) / sp) * 100;
  return Number(margin.toFixed(2));
}

/**
 * Units sold: quantityPurchased - quantityRemaining
 */
export function calculateUnitsSold(quantityPurchased: number, quantityRemaining: number): number {
  const purchased = Number(quantityPurchased) || 0;
  const remaining = Number(quantityRemaining) || 0;
  return Math.max(0, Number((purchased - remaining).toFixed(3)));
}

/**
 * Realized profit earned on units sold: unitsSold * (SP - CP)
 */
export function calculateProfitEarned(
  costPrice: number,
  sellingPrice: number,
  quantityPurchased: number,
  quantityRemaining: number
): number {
  const unitsSold = calculateUnitsSold(quantityPurchased, quantityRemaining);
  const profitPerUnit = calculateProfitPerUnit(costPrice, sellingPrice);
  return Number((unitsSold * profitPerUnit).toFixed(2));
}

/**
 * Expected profit on total purchased: quantityPurchased * (SP - CP)
 */
export function calculateExpectedProfit(
  costPrice: number,
  sellingPrice: number,
  quantityPurchased: number
): number {
  const purchased = Number(quantityPurchased) || 0;
  const profitPerUnit = calculateProfitPerUnit(costPrice, sellingPrice);
  return Number((purchased * profitPerUnit).toFixed(2));
}

/**
 * Overall cost: quantityPurchased * CP
 */
export function calculateTotalCost(costPrice: number, quantityPurchased: number): number {
  const cp = Number(costPrice) || 0;
  const purchased = Number(quantityPurchased) || 0;
  return Number((cp * purchased).toFixed(2));
}

/**
 * Purchase Totals (FR-5.4)
 * Calculates total purchase amount paid and expected profit for a purchase
 */
export function calculatePurchaseTotals(lines: PurchaseLineItem[]): {
  totalAmount: number;
  expectedProfit: number;
  totalQuantity: number;
} {
  let totalAmount = 0;
  let expectedProfit = 0;
  let totalQuantity = 0;

  for (const line of lines) {
    const qty = Number(line.quantity) || 0;
    const cp = Number(line.costPrice) || 0;
    const sp = Number(line.sellingPrice) || 0;

    totalQuantity += qty;
    totalAmount += qty * cp;
    expectedProfit += qty * (sp - cp);
  }

  return {
    totalAmount: Number(totalAmount.toFixed(2)),
    expectedProfit: Number(expectedProfit.toFixed(2)),
    totalQuantity: Number(totalQuantity.toFixed(3)),
  };
}

/**
 * Supplier Totals across items (FR-5.7)
 */
export function calculateSupplierTotals(items: ItemFinancials[]): {
  totalItems: number;
  totalQuantityPurchased: number;
  totalQuantityRemaining: number;
  totalUnitsSold: number;
  totalSpent: number;
  totalProfitEarned: number;
  totalExpectedProfit: number;
} {
  let totalQuantityPurchased = 0;
  let totalQuantityRemaining = 0;
  let totalSpent = 0;
  let totalProfitEarned = 0;
  let totalExpectedProfit = 0;

  for (const item of items) {
    const purchased = Number(item.quantityPurchased) || 0;
    const remaining = Number(item.quantityRemaining) || 0;
    const cp = Number(item.costPrice) || 0;
    const sp = Number(item.sellingPrice) || 0;

    const unitsSold = calculateUnitsSold(purchased, remaining);
    const profitPerUnit = calculateProfitPerUnit(cp, sp);

    totalQuantityPurchased += purchased;
    totalQuantityRemaining += remaining;
    totalSpent += purchased * cp;
    totalProfitEarned += unitsSold * profitPerUnit;
    totalExpectedProfit += purchased * profitPerUnit;
  }

  const totalUnitsSold = Math.max(0, totalQuantityPurchased - totalQuantityRemaining);

  return {
    totalItems: items.length,
    totalQuantityPurchased: Number(totalQuantityPurchased.toFixed(3)),
    totalQuantityRemaining: Number(totalQuantityRemaining.toFixed(3)),
    totalUnitsSold: Number(totalUnitsSold.toFixed(3)),
    totalSpent: Number(totalSpent.toFixed(2)),
    totalProfitEarned: Number(totalProfitEarned.toFixed(2)),
    totalExpectedProfit: Number(totalExpectedProfit.toFixed(2)),
  };
}

// ----------------------------------------------------
// 2. Unit and Price Conversions (FR-4)
// ----------------------------------------------------

/**
 * Converts a quantity from one unit to the base unit (KG or LITRE)
 * Example: 500 g -> 0.5 kg, 250 ml -> 0.25 litre
 */
export function normalizeToBaseUnit(quantity: number, unit: WeightVolumeUnit): number {
  const qty = Number(quantity) || 0;
  const upperUnit = unit.toUpperCase();

  if (upperUnit === 'G' || upperUnit === 'ML') {
    return qty / 1000;
  }
  return qty; // Already KG, LITRE, PIECE, PACKET
}

/**
 * Quantity to Price (FR-4.1, FR-4.4, FR-4.5)
 * If SP is ₹60 per kg:
 * - 1 kg -> ₹60.00
 * - 1/2 kg (0.5 kg or 500 g) -> ₹30.00
 * - 1/4 kg (0.25 kg or 250 g) -> ₹15.00
 * - 100 g -> ₹6.00
 * Rounded to 2 decimal places for money.
 */
export function calculatePriceForQuantity(
  pricePerBaseUnit: number,
  quantity: number,
  inputUnit: WeightVolumeUnit = 'KG'
): number {
  const sp = Number(pricePerBaseUnit) || 0;
  const qtyInBaseUnit = normalizeToBaseUnit(quantity, inputUnit);
  const price = sp * qtyInBaseUnit;
  return Number(price.toFixed(2));
}

/**
 * Price to Quantity (FR-4.2, FR-4.4, FR-4.5)
 * If SP is ₹60 per kg:
 * - ₹10 buys 166.7 g
 * Rounded to 1 decimal place for weight/volume.
 * Returns both base unit (kg/litre) and sub unit (g/ml).
 */
export function calculateQuantityForAmount(
  pricePerBaseUnit: number,
  amount: number,
  baseUnit: 'KG' | 'LITRE' = 'KG'
): {
  quantityInBaseUnit: number;
  quantityInSubUnit: number;
  subUnitName: 'g' | 'ml';
  baseUnitName: 'kg' | 'litre';
  formattedString: string;
} {
  const sp = Number(pricePerBaseUnit) || 0;
  const amt = Number(amount) || 0;
  const isLitre = baseUnit.toUpperCase() === 'LITRE';

  if (sp <= 0 || amt <= 0) {
    return {
      quantityInBaseUnit: 0,
      quantityInSubUnit: 0,
      subUnitName: isLitre ? 'ml' : 'g',
      baseUnitName: isLitre ? 'litre' : 'kg',
      formattedString: isLitre ? '0 ml' : '0 g',
    };
  }

  const inBase = amt / sp; // weight in kg or volume in litre
  const inSub = inBase * 1000; // in grams or ml

  const roundedSub = Number(inSub.toFixed(1));
  const roundedBase = Number(inBase.toFixed(3));

  const subName = isLitre ? 'ml' : 'g';
  const baseName = isLitre ? 'litre' : 'kg';

  // Format nicely: if >= 1000g, also show kg
  const formattedString =
    roundedSub >= 1000
      ? `${Number((roundedSub / 1000).toFixed(2))} ${baseName} (${roundedSub} ${subName})`
      : `${roundedSub} ${subName}`;

  return {
    quantityInBaseUnit: roundedBase,
    quantityInSubUnit: roundedSub,
    subUnitName: subName,
    baseUnitName: baseName,
    formattedString,
  };
}

/**
 * Standard Ready Price Chart (FR-4.3, FR-4.4)
 * For loose items (kg/g or litre/ml):
 * - Price for: 1 kg, 1/2 kg, 1/4 kg, 100 g
 * - Weight/Volume for: ₹5, ₹10, ₹20, ₹50, ₹100
 */
export function generateReadyPriceChart(
  pricePerBaseUnit: number,
  baseUnit: 'KG' | 'LITRE' = 'KG'
): {
  baseUnit: 'KG' | 'LITRE';
  standardWeights: Array<{ label: string; unit: string; quantity: number; price: number }>;
  standardAmounts: Array<{ amount: number; quantity: number; unit: string; formatted: string }>;
} {
  const sp = Number(pricePerBaseUnit) || 0;
  const isLitre = baseUnit.toUpperCase() === 'LITRE';

  const baseLabel = isLitre ? 'litre' : 'kg';
  const subLabel = isLitre ? 'ml' : 'g';

  // 1. Standard quantities: 1 kg/L, 1/2 kg/L, 1/4 kg/L, 100 g/ml
  const standardWeights = [
    {
      label: `1 ${baseLabel}`,
      unit: baseLabel,
      quantity: 1,
      price: calculatePriceForQuantity(sp, 1, isLitre ? 'LITRE' : 'KG'),
    },
    {
      label: `1/2 ${baseLabel} (500 ${subLabel})`,
      unit: subLabel,
      quantity: 500,
      price: calculatePriceForQuantity(sp, 500, isLitre ? 'ML' : 'G'),
    },
    {
      label: `1/4 ${baseLabel} (250 ${subLabel})`,
      unit: subLabel,
      quantity: 250,
      price: calculatePriceForQuantity(sp, 250, isLitre ? 'ML' : 'G'),
    },
    {
      label: `100 ${subLabel}`,
      unit: subLabel,
      quantity: 100,
      price: calculatePriceForQuantity(sp, 100, isLitre ? 'ML' : 'G'),
    },
  ];

  // 2. Standard rupee amounts: ₹5, ₹10, ₹20, ₹50, ₹100
  const amounts = [5, 10, 20, 50, 100];
  const standardAmounts = amounts.map((amount) => {
    const calc = calculateQuantityForAmount(sp, amount, baseUnit);
    return {
      amount,
      quantity: calc.quantityInSubUnit,
      unit: calc.subUnitName,
      formatted: calc.formattedString,
    };
  });

  return {
    baseUnit,
    standardWeights,
    standardAmounts,
  };
}

