// ═══════════════════ BMI — Shared helper (Onboarding + Profile) ═══════════════════
import type { CSSProperties } from 'react';
import type { ExperienceLevel } from '../types';

export type BMICategory = 'Kurus' | 'Ideal' | 'Berlebih' | 'Obesitas';

export interface BMIInfo {
  value: number;                 // raw BMI, 1 decimal
  category: BMICategory;
  colorClass: string;            // tailwind text color
  bgClass: string;               // tailwind bg tint
  borderClass: string;           // tailwind border tint
  sliderVariant: string;         // CSS class for range-slider fill
  recommendation: string;        // tailored routine text (Indonesian)
}

type Gender = 'Male' | 'Female' | undefined;

const genderTag = (g: Gender): string => {
  if (g === 'Female') return 'Hunter wanita';
  if (g === 'Male') return 'Hunter pria';
  return 'Hunter';
};

const experiencePrefix = (exp?: ExperienceLevel): string => {
  switch (exp) {
    case 'Pemula':   return 'Sebagai pemula, ';
    case 'Menengah': return 'Dengan pengalaman menengah, ';
    case 'Lanjut':   return 'Sebagai atlet lanjut, ';
    default:         return '';
  }
};

export const calcBMI = (
  heightCm: number,
  weightKg: number,
  gender?: Gender,
  experience?: ExperienceLevel,
): BMIInfo => {
  const safeHeight = heightCm > 0 ? heightCm : 170;
  const safeWeight = weightKg > 0 ? weightKg : 60;
  const bmi = safeWeight / Math.pow(safeHeight / 100, 2);
  const rounded = Math.round(bmi * 10) / 10;

  let category: BMICategory;
  let colorClass: string;
  let bgClass: string;
  let borderClass: string;
  let sliderVariant: string;
  let core: string;

  if (rounded < 18.5) {
    category = 'Kurus';
    colorClass = 'text-cyan-400';
    bgClass = 'bg-cyan-500/10';
    borderClass = 'border-cyan-500/40';
    sliderVariant = 'bmi-underweight';
    core =
      'fokus pada latihan hipertrofi (8–12 reps) dan makan dalam surplus kalori. Prioritaskan compound lift dan asup 1.6–2.0g protein per kg berat badan untuk membangun massa otot tanpa lemak.';
  } else if (rounded < 25) {
    category = 'Ideal';
    colorClass = 'text-emerald-400';
    bgClass = 'bg-emerald-500/10';
    borderClass = 'border-emerald-500/40';
    sliderVariant = 'bmi-normal';
    core =
      'kamu berada di titik manis. Pertahankan dengan split PPL seimbang, progressive overload, dan tetap di ±200 kkal dari maintenance. Tambahkan 1–2 sesi kardio per minggu untuk kesehatan jantung.';
  } else if (rounded < 30) {
    category = 'Berlebih';
    colorClass = 'text-amber-400';
    bgClass = 'bg-amber-500/10';
    borderClass = 'border-amber-500/40';
    sliderVariant = 'bmi-overweight';
    core =
      'kombinasikan latihan kekuatan dengan kardio sedang. Targetkan defisit 300–500 kkal, jaga protein tinggi (2g/kg) untuk mempertahankan otot, dan capai 8–10rb langkah per hari.';
  } else {
    category = 'Obesitas';
    colorClass = 'text-rose-400';
    bgClass = 'bg-rose-500/10';
    borderClass = 'border-rose-500/40';
    sliderVariant = 'bmi-obese';
    core =
      'mulailah dengan kardio low-impact konsisten (jalan, sepeda, renang) dan latihan full-body 2–3×/minggu. Fokus pada kebiasaan berkelanjutan dan defisit kalori moderat — konsistensi mengalahkan intensitas.';
  }

  const recommendation = `${experiencePrefix(experience)}${genderTag(gender)} disarankan untuk ${core}`;

  return { value: rounded, category, colorClass, bgClass, borderClass, sliderVariant, recommendation };
};

export const bmiSliderStyle = (val: number, min: number, max: number): CSSProperties => {
  const percent = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
  return { ['--val' as any]: `${percent}%` };
};
