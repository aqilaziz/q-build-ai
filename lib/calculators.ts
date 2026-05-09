export type WaterproofingInput = {
  areaM2: number;
  coats?: number;
  coverageKgPerM2PerCoat?: number;
};

export type PaintInput = {
  areaM2: number;
  coats?: number;
  coveragePerKg?: number;
  coverageM2PerKgPerCoat?: number;
};

export type TilesInput = {
  areaM2: number;
  wastePercent?: number;
  boxCoverageM2?: number;
};

export type SubtotalItemInput = {
  productId?: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
};

const roundUp = (value: number, precision = 2) => {
  const multiplier = 10 ** precision;
  return Math.ceil(value * multiplier) / multiplier;
};

const roundCurrency = (value: number) => Math.round(value);

const assertPositive = (name: string, value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} harus lebih dari 0.`);
  }
};

export function calculateWaterproofing({
  areaM2,
  coats = 2,
  coverageKgPerM2PerCoat = 1,
}: WaterproofingInput) {
  assertPositive("areaM2", areaM2);
  assertPositive("coats", coats);
  assertPositive("coverageKgPerM2PerCoat", coverageKgPerM2PerCoat);

  const requiredKg = roundUp(areaM2 * coats * coverageKgPerM2PerCoat, 2);

  return {
    areaM2,
    coats,
    coverageKgPerM2PerCoat,
    requiredKg,
    explanation: `${areaM2} m2 x ${coats} lapis x ${coverageKgPerM2PerCoat} kg/m2/lapis = ${requiredKg} kg.`,
  };
}

export function calculatePaint({
  areaM2,
  coats = 2,
  coveragePerKg,
  coverageM2PerKgPerCoat,
}: PaintInput) {
  const effectiveCoveragePerKg =
    coveragePerKg ?? coverageM2PerKgPerCoat ?? 10;

  assertPositive("areaM2", areaM2);
  assertPositive("coats", coats);
  assertPositive("coveragePerKg", effectiveCoveragePerKg);

  const requiredKg = roundUp((areaM2 * coats) / effectiveCoveragePerKg, 2);

  return {
    areaM2,
    coats,
    coveragePerKg: effectiveCoveragePerKg,
    requiredKg,
    explanation: `(${areaM2} m2 x ${coats} lapis) / ${effectiveCoveragePerKg} m2/kg/lapis = ${requiredKg} kg.`,
  };
}

export function calculateTiles({
  areaM2,
  wastePercent = 10,
  boxCoverageM2,
}: TilesInput) {
  assertPositive("areaM2", areaM2);
  if (!Number.isFinite(wastePercent) || wastePercent < 0) {
    throw new Error("wastePercent tidak boleh negatif.");
  }

  const wasteMultiplier = 1 + wastePercent / 100;
  const requiredAreaM2 = roundUp(areaM2 * wasteMultiplier, 2);
  if (boxCoverageM2 !== undefined) {
    assertPositive("boxCoverageM2", boxCoverageM2);
  }
  const boxes = boxCoverageM2 ? Math.ceil(requiredAreaM2 / boxCoverageM2) : null;

  return {
    areaM2,
    wastePercent,
    requiredAreaM2,
    boxCoverageM2: boxCoverageM2 ?? null,
    boxes,
    explanation:
      boxes === null
        ? `${areaM2} m2 + waste ${wastePercent}% = ${requiredAreaM2} m2 keramik.`
        : `${areaM2} m2 + waste ${wastePercent}% = ${requiredAreaM2} m2, dibulatkan menjadi ${boxes} dus.`,
  };
}

export function calculateSubtotal(items: SubtotalItemInput[]) {
  if (items.length === 0) {
    throw new Error("items tidak boleh kosong.");
  }

  const lineItems = items.map((item) => {
    assertPositive("unitPrice", item.unitPrice);
    assertPositive("quantity", item.quantity);

    const lineTotal = roundCurrency(item.unitPrice * item.quantity);

    return {
      ...item,
      lineTotal,
    };
  });

  return {
    items: lineItems,
    subtotal: roundCurrency(
      lineItems.reduce((total, item) => total + item.lineTotal, 0),
    ),
  };
}

export function calculateInstallment({
  total,
  months,
  interestRate = 0,
}: {
  total: number;
  months: number;
  interestRate?: number;
}) {
  assertPositive("total", total);
  assertPositive("months", months);
  if (!Number.isInteger(months)) {
    throw new Error("months harus bilangan bulat.");
  }
  if (!Number.isFinite(interestRate) || interestRate < 0) {
    throw new Error("interestRate tidak boleh negatif.");
  }

  const normalizedRate = interestRate > 1 ? interestRate / 100 : interestRate;
  const interestAmount = roundCurrency(total * normalizedRate);
  const totalWithInterest = roundCurrency(total + interestAmount);
  const monthlyPayment = roundCurrency(totalWithInterest / months);

  return {
    total,
    months,
    interestRate: normalizedRate,
    interestAmount,
    totalWithInterest,
    monthlyPayment,
    explanation: `${months} bulan dengan bunga ${(normalizedRate * 100).toFixed(2)}%: sekitar Rp${monthlyPayment.toLocaleString("id-ID")} per bulan.`,
  };
}
