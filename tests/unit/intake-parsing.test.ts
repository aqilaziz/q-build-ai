import { describe, expect, test } from "vitest";
import {
  extractAreaM2,
  extractAreaM2FromClarification,
  extractColor,
  extractLengthM,
  parseIndonesianNumber,
} from "@/lib/ai/intake-parsing";

describe("Indonesian intake parsing", () => {
  test("parses Indonesian number words and fractions", () => {
    expect(parseIndonesianNumber("lima belas")).toBe(15);
    expect(parseIndonesianNumber("setengah")).toBe(0.5);
    expect(parseIndonesianNumber("seperempat")).toBe(0.25);
    expect(parseIndonesianNumber("dua setengah")).toBe(2.5);
    expect(parseIndonesianNumber("3,5")).toBe(3.5);
  });

  test("extracts area from Indonesian units", () => {
    expect(extractAreaM2("luas area sekitar 15 meter persegi")).toBe(15);
    expect(extractAreaM2("cat dinding 12 m2 warna krem")).toBe(12);
    expect(extractAreaM2("area lima belas m2")).toBe(15);
  });

  test("extracts short area clarification replies", () => {
    expect(
      extractAreaM2FromClarification(
        "Berapa luas area yang terdampak?",
        "3 meter",
      ),
    ).toBe(3);
    expect(
      extractAreaM2FromClarification(
        "Berapa luas area yang dikerjakan dalam m2? Kalau belum pasti, boleh estimasi panjang x lebar.",
        "sekitar tiga",
      ),
    ).toBe(3);
    expect(
      extractAreaM2FromClarification(
        "Berapa panjang pipa yang perlu diganti?",
        "setengah meter",
      ),
    ).toBeNull();
  });

  test("extracts plumbing length from fractional prompts", () => {
    expect(extractLengthM("pipa bocor setengah meter")).toBe(0.5);
    expect(extractLengthM("sambungan pipa bocor seperempat meter")).toBe(0.25);
    expect(extractLengthM("ganti pipa 2,5 meter")).toBe(2.5);
  });

  test("extracts local paint colors", () => {
    expect(extractColor("Mau cat dinding 12 m2 warna krem standar")).toBe("krem");
    expect(extractColor("ingin warna putih tulang untuk kamar")).toBe("putih tulang");
    expect(extractColor("cat warna sage green")).toBe("sage green");
  });
});
