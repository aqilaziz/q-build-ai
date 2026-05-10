import { describe, expect, test } from "vitest";
import {
  calculateInstallment,
  calculatePaint,
  calculateSubtotal,
  calculateTiles,
  calculateWaterproofing,
} from "@/lib/calculators";

describe("renovation calculators", () => {
  test("calculates waterproofing requirement deterministically", () => {
    expect(
      calculateWaterproofing({
        areaM2: 15,
        coats: 2,
        coverageKgPerM2PerCoat: 1,
      }),
    ).toMatchObject({
      areaM2: 15,
      coats: 2,
      requiredKg: 30,
    });
  });

  test("calculates paint requirement from area, coats, and coverage", () => {
    const result = calculatePaint({
      areaM2: 12,
      coats: 2,
      coveragePerKg: 10,
    });

    expect(result).toMatchObject({
      areaM2: 12,
      coats: 2,
      requiredKg: 2.4,
    });
    expect(result.explanation).toContain("m2/L/lapis");
  });

  test("rounds tile boxes to purchasable units", () => {
    expect(
      calculateTiles({
        areaM2: 10,
        wastePercent: 10,
        boxCoverageM2: 1.44,
      }),
    ).toMatchObject({
      requiredAreaM2: 11,
      boxes: 8,
    });
  });

  test("calculates line totals and subtotal", () => {
    expect(
      calculateSubtotal([
        { name: "Waterproofing 20kg", unitPrice: 425000, quantity: 2 },
        { name: "Roller", unitPrice: 69000, quantity: 1 },
      ]),
    ).toMatchObject({
      subtotal: 919000,
      items: [
        { name: "Waterproofing 20kg", lineTotal: 850000 },
        { name: "Roller", lineTotal: 69000 },
      ],
    });
  });

  test("normalizes percentage installment rates", () => {
    expect(
      calculateInstallment({
        total: 1200000,
        months: 12,
        interestRate: 6,
      }),
    ).toMatchObject({
      interestRate: 0.06,
      interestAmount: 72000,
      totalWithInterest: 1272000,
      monthlyPayment: 106000,
    });
  });

  test("rejects invalid quantities", () => {
    expect(() => calculateWaterproofing({ areaM2: 0 })).toThrow("areaM2");
    expect(() => calculateSubtotal([])).toThrow("items");
  });
});
