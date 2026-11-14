/**
 * Client-Side Unit and Price Calculations (FR-4 & FR-5.2)
 */

export function calculateProfitPerUnit(costPrice, sellingPrice) {
  const cp = Number(costPrice) || 0;
  const sp = Number(sellingPrice) || 0;
  return Number((sp - cp).toFixed(2));
}

export function calculateMarginPercentage(costPrice, sellingPrice) {
  const cp = Number(costPrice) || 0;
  const sp = Number(sellingPrice) || 0;
  if (sp <= 0) return 0;
  return Number((((sp - cp) / sp) * 100).toFixed(1));
}

export function normalizeToBaseUnit(quantity, unit) {
  const qty = Number(quantity) || 0;
  const u = (unit || '').toUpperCase();
  if (u === 'G' || u === 'ML') {
    return qty / 1000;
  }
  return qty;
}

/**
 * Quantity to Price (FR-4.1, FR-4.5)
 * SP ₹60/kg -> 1 kg = ₹60, 1/2 kg = ₹30, 1/4 kg = ₹15, 100 g = ₹6
 */
export function calculatePriceForQuantity(pricePerBaseUnit, quantity, inputUnit = 'KG') {
  const sp = Number(pricePerBaseUnit) || 0;
  const qtyInBaseUnit = normalizeToBaseUnit(quantity, inputUnit);
  return Number((sp * qtyInBaseUnit).toFixed(2));
}

/**
 * Amount to Quantity (FR-4.2, FR-4.5)
 * SP ₹60/kg, ₹10 buys 166.7 g
 */
export function calculateQuantityForAmount(pricePerBaseUnit, amount, baseUnit = 'KG') {
  const sp = Number(pricePerBaseUnit) || 0;
  const amt = Number(amount) || 0;
  const isLitre = (baseUnit || '').toUpperCase() === 'LITRE';

  if (sp <= 0 || amt <= 0) {
    return {
      quantityInBaseUnit: 0,
      quantityInSubUnit: 0,
      subUnitName: isLitre ? 'ml' : 'g',
      baseUnitName: isLitre ? 'litre' : 'kg',
      formattedString: isLitre ? '0 ml' : '0 g',
    };
  }

  const inBase = amt / sp;
  const inSub = inBase * 1000;

  const roundedSub = Number(inSub.toFixed(1));
  const roundedBase = Number(inBase.toFixed(3));
  const subName = isLitre ? 'ml' : 'g';
  const baseName = isLitre ? 'litre' : 'kg';

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
 * Ready Price Chart (FR-4.3)
 */
export function generateReadyPriceChart(pricePerBaseUnit, baseUnit = 'KG') {
  const sp = Number(pricePerBaseUnit) || 0;
  const isLitre = (baseUnit || '').toUpperCase() === 'LITRE';
  const baseLabel = isLitre ? 'litre' : 'kg';
  const subLabel = isLitre ? 'ml' : 'g';

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

