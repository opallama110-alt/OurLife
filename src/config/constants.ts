export type MuscleGroup = 'chest' | 'shoulders' | 'triceps' | 'biceps' | 'forearms' | 'lats' | 'traps' | 'lower_back' | 'abs' | 'obliques' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'neck';

export const MUSCLE_GROUP_CONFIG: Record<MuscleGroup, { label: string; category: string }> = {
  chest: { label: 'Chest', category: 'Push' },
  shoulders: { label: 'Shoulders', category: 'Push' },
  triceps: { label: 'Triceps', category: 'Push' },
  biceps: { label: 'Biceps', category: 'Pull' },
  forearms: { label: 'Forearms', category: 'Pull' },
  lats: { label: 'Lats', category: 'Pull' },
  traps: { label: 'Traps', category: 'Pull' },
  lower_back: { label: 'Lower Back', category: 'Pull' },
  abs: { label: 'Abs', category: 'Core' },
  obliques: { label: 'Obliques', category: 'Core' },
  quads: { label: 'Quads', category: 'Legs' },
  hamstrings: { label: 'Hamstrings', category: 'Legs' },
  glutes: { label: 'Glutes', category: 'Legs' },
  calves: { label: 'Calves', category: 'Legs' },
  neck: { label: 'Neck', category: 'Other' }
};

export const MUSCLE_ICON_MAP: Record<string, string> = {
  chest: '/assets/muscles/chest.webp',
  pectorals: '/assets/muscles/chest.webp',
  shoulders: '/assets/muscles/shoulders.webp',
  delts: '/assets/muscles/shoulders.webp',
  triceps: '/assets/muscles/triceps.webp',
  biceps: '/assets/muscles/biceps.webp',
  forearms: '/assets/muscles/forearms.webp',
  lats: '/assets/muscles/lats.webp',
  back: '/assets/muscles/lats.webp',
  traps: '/assets/muscles/traps.webp',
  'upper back': '/assets/muscles/traps.webp',
  lower_back: '/assets/muscles/lower_back.webp',
  abs: '/assets/muscles/abs.webp',
  obliques: '/assets/muscles/obliques.webp',
  quads: '/assets/muscles/quads.webp',
  hamstrings: '/assets/muscles/hamstrings.webp',
  glutes: '/assets/muscles/glutes.webp',
  calves: '/assets/muscles/calves.webp',
  neck: '/assets/muscles/neck.webp',
  default: '/assets/muscles/default.webp' // Gambar cadangan (misal icon dumbbell)
};

export const INITIAL_HABITS = [
  { id: 'h1', name: 'Sholat Subuh + Journaling', streak: 0, completedDates: [] },
  { id: 'h2', name: 'Deep Work (Java/UI/VR) - 1 Hr', streak: 0, completedDates: [] },
  { id: 'h3', name: 'Tidur 7+ Jam', streak: 0, completedDates: [] },
  { id: 'h4', name: 'Gym Session + Core', streak: 0, completedDates: [] },
  { id: 'h5', name: 'Protein Intake (1.6g/kg)', streak: 0, completedDates: [] },
];

export const PPL_EXERCISES = {
  Push: [
    { name: 'Incline Dumbbell Press', sets: 3, reps: 10, desc: 'Target Upper Chest. Set bangku 30-45 derajat. Fokus stretch di bawah, squeeze di atas.' },
    { name: 'Flat Bench Press (Barbell/DB)', sets: 3, reps: 8, desc: 'Target Mid Chest & Strength. Kaki menapak kuat, arch punggung sedikit, turunkan bar ke arah puting.' },
    { name: 'Overhead Press (Dumbbell)', sets: 3, reps: 10, desc: 'Target Front Delts. Duduk tegak, core kencang. Dorong beban lurus ke atas kepala.' },
    { name: 'Lateral Raise', sets: 4, reps: 15, desc: 'Target Side Delts (V-Taper). Siku sedikit menekuk, angkat beban seakan menuang teko air. Jangan ayun badan.' },
    { name: 'Tricep Rope Pushdown', sets: 3, reps: 12, desc: 'Target Triceps. Siku tempel di rusuk, jangan goyang. Fokus luruskan tangan ke bawah.' },
  ],
  Pull: [
    { name: 'Lat Pulldown', sets: 3, reps: 10, desc: 'Target Lats (Lebar Punggung). Tarik bar ke arah dada atas, busungkan dada. Jangan bungkuk.' },
    { name: 'Cable Row / DB Row', sets: 3, reps: 10, desc: 'Target Mid Back (Tebal Punggung). Tarik siku ke belakang melewati tubuh. Rasakan jepitan di punggung.' },
    { name: 'Face Pull', sets: 4, reps: 15, desc: 'Target Rear Delts & Posture. Tarik tali ke arah dahi/mata. Bagus untuk kesehatan bahu.' },
    { name: 'Bicep Curl (Bar/DB)', sets: 3, reps: 12, desc: 'Target Biceps. Badan tegak, hanya siku yang bergerak. Tahan sebentar saat beban di atas.' },
    { name: 'Hammer Curl', sets: 3, reps: 12, desc: 'Target Brachialis (Lebar Lengan). Pegang DB seperti memegang palu. Angkat lurus ke depan.' },
  ],
  Legs: [
    { name: 'Squat (Goblet/Barbell)', sets: 3, reps: 8, desc: 'Target Quads & Glutes. Kaki selebar bahu, turun sampai paha paralel lantai. Dada tegak.' },
    { name: 'Romanian Deadlift', sets: 3, reps: 10, desc: 'Target Hamstrings. Lutut tekuk sedikit, dorong pinggul ke belakang sejauh mungkin sampai paha belakang ketarik.' },
    { name: 'Leg Extension', sets: 3, reps: 15, desc: 'Target Quads (Detail). Tahan 1 detik saat kaki lurus di atas. Turun perlahan.' },
    { name: 'Leg Curl', sets: 3, reps: 12, desc: 'Target Hamstrings. Tekuk kaki sampai menyentuh pantat (jika bisa). Kontrol saat menurunkan beban.' },
    { name: 'Calf Raise', sets: 4, reps: 15, desc: 'Target Betis. Gerakan penuh (full range), tumit turun maksimal, jinjit maksimal.' },
  ],
  Core: [
    { name: 'Hanging Leg Raise', sets: 3, reps: 12, desc: 'Target Lower Abs. Gantung di bar, angkat lutut/kaki ke arah dada. Jangan ayun badan.' },
    { name: 'Cable Crunch', sets: 3, reps: 15, desc: 'Target Upper Abs. Berlutut, pegang tali di leher, bungkukkan badan menggunakan otot perut.' },
    { name: 'Plank', sets: 3, reps: 60, desc: 'Target Stability. Tahan posisi lurus. Kencangkan perut dan pantat. Jangan biarkan pinggang turun.' }
  ]
};

export const HOME_EXERCISES = {
  Push: [
    { name: 'Standard Push Up', sets: 4, reps: 15, desc: 'Chest/Triceps. Badan lurus, turun sampai dada hampir menyentuh lantai.' },
    { name: 'Pike Push Up', sets: 3, reps: 10, desc: 'Shoulders. Posisi V terbalik. Target bahu depan.' },
    { name: 'Chair Dips', sets: 3, reps: 12, desc: 'Triceps. Gunakan kursi stabil. Turun perlahan.' },
    { name: 'Diamond Push Up', sets: 3, reps: 10, desc: 'Triceps/Inner Chest. Tangan membentuk wajik.' },
  ],
  Pull: [
    { name: 'Doorframe Row', sets: 4, reps: 12, desc: 'Back. Pegang kusen pintu, tarik badan ke depan.' },
    { name: 'Towel Bicep Curl', sets: 3, reps: 15, desc: 'Biceps. Gunakan handuk diinjak kaki, tarik dengan tangan (isometrik/dinamis).' },
    { name: 'Superman Hold', sets: 3, reps: 30, desc: 'Lower Back. Tidur tengkurap, angkat tangan dan kaki.' },
    { name: 'Pull Up (If Bar Available)', sets: 3, reps: 8, desc: 'Lats. Opsional jika ada bar.' },
  ],
  Legs: [
    { name: 'Bodyweight Squat', sets: 4, reps: 20, desc: 'Quads/Glutes. Fokus volume dan tempo pelan.' },
    { name: 'Bulgarian Split Squat', sets: 3, reps: 10, desc: 'Quads/Glutes. Satu kaki di kursi belakang. Killer exercise.' },
    { name: 'Lunges', sets: 3, reps: 12, desc: 'Legs. Langkah lebar ke depan.' },
    { name: 'Calf Raise (Single Leg)', sets: 4, reps: 15, desc: 'Calves. Jinjit satu kaki maksimal.' },
  ],
  Core: [
    { name: 'Floor Leg Raise', sets: 3, reps: 15, desc: 'Lower Abs. Kaki lurus, angkat 90 derajat.' },
    { name: 'Russian Twist', sets: 3, reps: 20, desc: 'Obliques. Putar badan kiri kanan.' },
    { name: 'Plank', sets: 3, reps: 60, desc: 'Stability. Tahan lurus.' }
  ]
};

export const OURLIFE_SYSTEM_INSTRUCTION = `
Role: Anda adalah "OurLife Personal Growth Architect" khusus untuk Naufal. Fokus utama Anda adalah optimasi dua pilar: Fisik (Gym & Core) dan Kedisiplinan (Habit).

1. PILAR GYM (Hypertrophy, Strength & Core)

Program Utama: Gunakan pola Push, Pull, Legs (PPL).

Integrasi Core/Abs: Wajib menyisipkan minimal 2 latihan Core di setiap akhir sesi (misal: Hanging Leg Raises, Cable Crunches, atau Plank).

Prinsip: Fokus pada Progressive Overload. Berikan instruksi teknis yang detail untuk menghindari cedera.

Nutrisi: Hitung kebutuhan protein dan kalori harian untuk clean bulking.

2. PILAR HABIT (Consistency & Systems)

Teknik: Gunakan "Habit Stacking" (menempelkan kebiasaan baru di atas kebiasaan lama).

Habit Wajib: Bangun pagi, hidrasi, latihan beban, dan review harian sebelum tidur.

Tone: Tegas, langsung, dan padat (Stoic mindset). Beri penilaian + arahan langsung tanpa basa-basi — JANGAN minta maaf, JANGAN bertele-tele, JANGAN bertanya balik kalau konteks sudah cukup. Langsung ke inti.

FORMAT RESPONS:

Gunakan poin-poin pendek biar gampang dibaca di layar HP — kalimat ringkas, hindari paragraf panjang. Boleh pakai heading singkat atau emoji marker per poin biar lebih enak dibaca.

Tutup dengan "Action Item": 2–3 langkah fitness/habit yang bisa Naufal lakukan hari ini juga (HANYA gym/core/habit — tidak ada item keuangan).
`;