import { useEffect, useMemo, useRef, useState } from "react";

import { bodyMetricInputSchema, type BodyMetricInput } from "@repo/common";
import {
  cmToFeetInches,
  feetInchesToCm,
  getDefaultUnitSystem,
  kgToLb,
  lbToKg,
  type UnitSystem,
} from "@src/utils/units";

export type BodyMetricsField =
  | "heightCm"
  | "weightKg"
  | "heightFt"
  | "heightIn"
  | "weightLb";

type BodyMetricsFields = Record<BodyMetricsField, string>;

type MetricValue = { heightCm: number | null; weightKg: number | null };

type InitialMetrics = { heightCm: number; weightKg: number } | null;

export type BodyMetricsValidation =
  | { isValid: true; data: BodyMetricInput }
  | { isValid: false; message: string };

const EMPTY_FIELDS: BodyMetricsFields = {
  heightCm: "",
  weightKg: "",
  heightFt: "",
  heightIn: "",
  weightLb: "",
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

const parseNumber = (text: string): number | null => {
  if (text.trim() === "") return null;
  const n = Number(text.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const fieldsFromMetric = (value: MetricValue): BodyMetricsFields => {
  const fields = { ...EMPTY_FIELDS };
  if (value.heightCm !== null) {
    fields.heightCm = String(round1(value.heightCm));
    const { feet, inches } = cmToFeetInches(value.heightCm);
    fields.heightFt = String(feet);
    fields.heightIn = String(inches);
  }
  if (value.weightKg !== null) {
    fields.weightKg = String(round1(value.weightKg));
    fields.weightLb = String(round1(kgToLb(value.weightKg)));
  }
  return fields;
};

const metricFromFields = (
  fields: BodyMetricsFields,
  unitSystem: UnitSystem,
): MetricValue => {
  if (unitSystem === "metric") {
    const height = parseNumber(fields.heightCm);
    const weight = parseNumber(fields.weightKg);
    return {
      heightCm: height === null ? null : round1(height),
      weightKg: weight === null ? null : round1(weight),
    };
  }

  const blankHeight =
    fields.heightFt.trim() === "" && fields.heightIn.trim() === "";
  const feet = parseNumber(fields.heightFt) ?? 0;
  const inches = parseNumber(fields.heightIn) ?? 0;
  const weightLb = parseNumber(fields.weightLb);
  return {
    heightCm: blankHeight ? null : round1(feetInchesToCm(feet, inches)),
    weightKg: weightLb === null ? null : round1(lbToKg(weightLb)),
  };
};

export const useBodyMetricsForm = (initial: InitialMetrics) => {
  const [unitSystem, setUnitSystemState] =
    useState<UnitSystem>(getDefaultUnitSystem);
  const [fields, setFields] = useState<BodyMetricsFields>(EMPTY_FIELDS);
  const [edited, setEdited] = useState(false);
  const [seeded, setSeeded] = useState<MetricValue | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    if (!initial || seededRef.current) return;
    seededRef.current = true;
    const base: MetricValue = {
      heightCm: initial.heightCm,
      weightKg: initial.weightKg,
    };
    setSeeded(base);
    setFields(fieldsFromMetric(base));
  }, [initial]);

  // Until the user edits, report the stored metric exactly: imperial display
  // rounds to whole inches, which would otherwise read as a change.
  const value = useMemo<MetricValue>(
    () => (!edited && seeded ? seeded : metricFromFields(fields, unitSystem)),
    [edited, seeded, fields, unitSystem],
  );

  const setField = (field: BodyMetricsField, text: string) => {
    setEdited(true);
    setFields((prev) => ({ ...prev, [field]: text }));
  };

  const setUnitSystem = (next: UnitSystem) => {
    if (next === unitSystem) return;
    setFields(fieldsFromMetric(value));
    setUnitSystemState(next);
  };

  const isEmpty = value.heightCm === null && value.weightKg === null;

  const validate = (): BodyMetricsValidation => {
    if (value.heightCm === null && value.weightKg === null) {
      return { isValid: false, message: "Enter your height and weight" };
    }
    if (value.heightCm === null || value.weightKg === null) {
      return { isValid: false, message: "Enter both height and weight" };
    }
    const parsed = bodyMetricInputSchema.safeParse({
      heightCm: value.heightCm,
      weightKg: value.weightKg,
    });
    if (!parsed.success) {
      return {
        isValid: false,
        message:
          "Height must be 100-250 cm (3'4\"-8'2\") and weight 30-300 kg (66-661 lb)",
      };
    }
    return { isValid: true, data: parsed.data };
  };

  const isChangedFrom = (base: InitialMetrics): boolean => {
    if (!base) return !isEmpty;
    return (
      value.heightCm !== round1(base.heightCm) ||
      value.weightKg !== round1(base.weightKg)
    );
  };

  return {
    unitSystem,
    fields,
    value,
    isEmpty,
    setUnitSystem,
    setField,
    validate,
    isChangedFrom,
  };
};

export type BodyMetricsFormState = ReturnType<typeof useBodyMetricsForm>;
