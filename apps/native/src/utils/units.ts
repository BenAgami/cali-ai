export type UnitSystem = "metric" | "imperial";

const IMPERIAL_REGIONS = new Set(["US", "LR", "MM"]);
const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

const regionFromLocale = (locale: string): string | undefined =>
  locale
    .split(/[-_]/)
    .slice(1)
    .find((part) => /^[A-Z]{2}$/.test(part));

export const getDefaultUnitSystem = (): UnitSystem => {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const region = regionFromLocale(locale);
  return region && IMPERIAL_REGIONS.has(region) ? "imperial" : "metric";
};

export const feetInchesToCm = (feet: number, inches: number): number =>
  (feet * 12 + inches) * CM_PER_INCH;

export const cmToFeetInches = (
  cm: number,
): { feet: number; inches: number } => {
  const total = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(total / 12), inches: total % 12 };
};

export const lbToKg = (lb: number): number => lb * KG_PER_LB;

export const kgToLb = (kg: number): number => kg / KG_PER_LB;
