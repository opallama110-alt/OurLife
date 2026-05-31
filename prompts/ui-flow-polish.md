# UI/UX Polish — Auth & Onboarding Flow

> Rules doc. CC: baca file ini penuh, lalu kerjakan per section. Patuhi `CLAUDE.md` + `PROMPT_CLAUDE_CODE.md` (satu section sampai sempurna, audit before edit, build green sebelum commit, pause after commit). Copy user = Bahasa Indonesia; code/comment = English. Animasi & style di `index.css` (kebab-case class, camelCase keyframe). No tailwind.config extends.

## Konteks temuan (hasil audit — sudah diverifikasi)

Audit nge-scan tiap `className` di flow vs definisi di `index.css`. Bug visual berasal dari **class yang dipakai di JSX tapi NOL CSS**:

| Class | Dipakai di | Status | Efek |
|---|---|---|---|
| `.au-check`, `.au-check-box` | `src/components/Login.tsx` (register: setuju S&K) | ❌ no CSS | Checkbox native nggak disembunyiin + box custom nggak distyle → jelek pas dipencet |
| `.au-google` | `src/components/Login.tsx` | ⚠️ ada CSS tapi `inline-flex` & di LUAR `.au-form` | Tombol nggak full-width → keliatan ke kanan/miring; harusnya center/full karena ini satu-satunya opsi sosial |
| `.sc-msg-sys` | `src/components/SystemChat.tsx` | ❌ no CSS | Bubble pesan System nggak ke-style |
| `.sys-chat-error` | `src/pages/HabitTracker.tsx` (Daily Protocol error) | ❌ no CSS | Pesan error AI nggak ke-style |
| `.ah-heart` | `src/components/onboarding/AnatomicalHeart.tsx` | ❌ no CSS | Elemen onboarding nggak ke-style |
| `.mono` | banyak (AchievementModal, BodyAnatomy, StatChip dll) | ❌ no CSS | Font mono nggak ke-apply; harusnya `font-family: var(--font-mono)` |
| `.d-card-last` | `src/pages/Dashboard.tsx` | ❌ no CSS | Marker spacing nggak jalan (minor) |

Catatan: token global aman — `--cyan`, `--line`, `--line-cyan-soft`, `--t-1/3/mute`, `--font-mono`, `--ease-spring`, `--bg-1` semua sudah ada di `:root`.

---

## Section 1 — Checkbox S&K (`.au-check`) [PRIORITAS]

Tambah CSS di `index.css`. Pola: sembunyikan input native, style `.au-check-box` sebagai kotak custom, beri state checked + focus + tap.

Target perilaku:
- `.au-check` = baris flex, `align-items: center`, `gap`, font kecil, `cursor: pointer`, `user-select: none`.
- `input[type=checkbox]` di dalam `.au-check` → `position: absolute; opacity: 0` (sembunyikan native, JANGAN `display:none` biar tetap focusable).
- `.au-check-box` = kotak ~18–20px, `border: 1px solid var(--line)`, rounded, transisi. Saat dicentang (parent input `:checked`) → border cyan + bg cyan glow + svg check kelihatan (svg sudah dirender di JSX hanya saat `agree`).
- Focus state: `input:focus-visible + .au-check-box` → ring cyan (`box-shadow: 0 0 0 3px rgba(34,211,238,0.15)`).
- Hilangkan tap-highlight kotak: tambah `-webkit-tap-highlight-color: transparent` (di `.au-check` atau global), biar nggak ada kotak abu-abu pas dipencet di HP.
- Link "Syarat & Ketentuan" (`<a>` di JSX) kasih warna cyan + cursor pointer.

## Section 2 — Tombol Google full-width & rapi

- `.au-google`: ubah dari `inline-flex` → `display: flex; width: 100%` biar selebar `.au-cta`. Pertahankan height/gap/border look.
- Pastikan posisi konsisten: blok `atau` + Google harusnya selebar form. (Markup sudah di luar `<form>` tapi masih dalam `.au-card` — cukup full-width via CSS, nggak perlu pindah markup.)
- **Ikon "G" Google (di dalam tombol):** ganti `<img src="google favicon">` → inline SVG logo Google 4-warna (favicon sering blur/ke-block, sesuai konvensi local-assets-first). [KEPUTUSAN: inline SVG.] Ini ikon Google, BUKAN logo OurLife — jangan ketuker.

## Section 2b — Logo brand OurLife (pakai aset asli)

User konfirmasi: `public/ourlife-logo.png` adalah **logo asli OurLife**. Pakai PNG itu sebagai logo brand, konsisten di Login DAN Onboarding (override spec lama yang nyuruh SVG mark).

- **Login** (`src/components/Login.tsx`): komponen `AuthLogo` sekarang render SVG mark inline (`<svg viewBox="0 0 28 28">…`). Ganti jadi `<img src="/ourlife-logo.png" alt="OurLife" />` dengan ukuran/rounded yang pas (mis. 40–56px, `border-radius` selaras `.au-logo-mark`). Pertahankan `.au-logo-name` + `.au-logo-tag`.
- **Onboarding** (Section 6): sudah pakai `<img src="/ourlife-logo.png">` — biarkan sumbernya, cukup rapikan styling via class tema. JANGAN balik ke SVG.
- Pastikan path `/ourlife-logo.png` ke-resolve dari `public/` (Vite serve root). Tes muncul di kedua layar.

## Section 3 — `.mono` utility

Tambah satu rule global: `.mono { font-family: var(--font-mono); }`. Ini fix konsistensi tipografi di banyak komponen sekaligus (Achievement, anatomy, stat chip).

## Section 4 — `.sc-msg-sys` & `.sys-chat-error`

- `.sc-msg-sys`: style bubble pesan System di SystemChat (selaras dengan `.sc-msg` yang sudah ada — cek dulu `.sc-msg` di index.css, bikin varian sys: aksen cyan, align kiri).
- `.sys-chat-error`: style pesan error (teks merah lembut, padding kecil, border-radius, bg `rgba(red,0.08)`). Dipakai di Daily Protocol HabitTracker.

## Section 5 — `.ah-heart` & `.d-card-last` (minor)

- `.ah-heart`: cek `src/components/onboarding/AnatomicalHeart.tsx`, kasih style yang masuk akal (size/center) — atau kalau ternyata sisa class mati, hapus dari JSX. Audit dulu.
- `.d-card-last`: cek Dashboard, kemungkinan cuma marker margin-bottom terakhir. Kasih `margin-bottom: 0` atau hapus kalau redundant.

---

## Acceptance
- [ ] Checkbox S&K: kotak custom rapi, centang muncul, focus ring jalan, nggak ada kotak abu tap-highlight di HP.
- [ ] Tombol Google full-width sejajar dengan CTA & form; ikon Google = inline SVG 4-warna.
- [ ] Logo OurLife (`/ourlife-logo.png`) muncul di Login & Onboarding (bukan SVG mark).
- [ ] `.mono` apply font monospace di semua pemakaian.
- [ ] Bubble System & error message ke-style.
- [ ] `.ah-heart`/`.d-card-last`: di-style atau dibersihkan setelah audit.
- [ ] `npm run build` hijau, no TS error. Tes di mobile width.

---

## Section 6 — Onboarding belum di-port ke tema (AKAR "kaku") [SCOPE BESAR — section terpisah]

Hasil audit `src/components/Onboarding.tsx` (688 baris, 6 step): file ini **masih pakai Tailwind generik mentah**, belum di-wholesale-port ke design system seperti Login/Habits/Dashboard. Itu sebabnya kerasa "kaku" — secara visual nyangkut di look lama yang flat.

Bukti konkret:
- Wrapper: `bg-slate-950`, kartu `bg-slate-900 border-slate-800 rounded-2xl` — bukan `.au-card` (gradient + corner filigree + cyan glow).
- Tombol Lanjut/Kembali: gradient Tailwind inline (`from-cyan-500 to-blue-600`), bukan `.au-cta`.
- Semua kartu pilihan (gender/goal/activity/focus/equipment): `border-slate-700` + `cyan-500` mentah, bukan token `--line`/`--cyan`.
- Logo: `<img src="/ourlife-logo.png">` PNG — ini logo asli OurLife (lihat Section 2b). Login juga di-switch ke PNG ini, jadi keduanya konsisten. JANGAN ganti ke SVG.
- Transisi: tiap step SUDAH punya `animate-slide-up` (CSS ada, jalan). Transisi BUKAN masalah utama — yang kaku itu stylingnya.

### Strategi umum (audit before edit, JANGAN ubah logika)
Bikin set class tema baru `.ob-*` di `index.css` (selaras token: `--cyan`, `--line`, `--line-cyan-soft`, `--t-1/3/mute`, bg `rgba(7,12,24,.6)`, `--font-mono`, `--ease-spring`). Ganti SEMUA Tailwind `slate-*` mentah dengan class/token tema. Reuse yang sudah ada kalau pas: `.au-card`, `.au-cta`, `.au-field`, `.hud-label`, `.fz-orange`.

**JANGAN sentuh logika/data:** `formData`, `updateField`, `schedule`, `setSchedule`, `PRESETS`, `ACTIVITY_SCHEDULES`, `FOCUS_TO_MUSCLES`, `toggleEquipment`, `handleNext`, `handleFinish`, Firestore `setDoc`, `calcBMI`, `bmiSliderStyle`, `getTrainedMuscleIds`. Komponen anak dibiarkan: `<AnatomyViewer>`, `<DateOfBirthPicker>`, `range-slider` (sudah ada CSS-nya). Cuma class presentasi yang berubah.

### Class tema yang perlu dibuat (saran penamaan)
- `.ob-screen` — full-screen backdrop (ganti `fixed inset-0 bg-slate-950`). Pakai gradient/grid ala `.au-screen` + `.au-bg-grid`.
- `.ob-card` — kartu utama (ganti `bg-slate-900 border-slate-800 rounded-2xl p-8`). Reuse `.au-card` look (gradient + cyan glow + filigree opsional). Lebar `max-width` dinaikin dikit (step 4-6 padat).
- `.ob-progress` + `.ob-progress-fill` — progress bar atas, fill gradient cyan tema.
- `.ob-step` — wrapper tiap step (pertahankan `animate-slide-up`).
- `.ob-step-head` / `.ob-step-title` / `.ob-step-sub` — judul + subjudul tiap step (ganti `text-2xl font-bold text-white` + `text-slate-400`).
- `.ob-label` — label field (ganti `text-sm font-medium text-slate-300`).
- `.ob-choice` + `.ob-choice.is-active` — TOMBOL PILIHAN generik (dipakai gender, goal, activity, duration, focus, env, equipment). Idle: bg gelap + `border var(--line)`; active: `border var(--cyan)` + bg cyan glow + `box-shadow`. Ini class paling penting — sekarang tiap step nulis ulang varian `bg-cyan-500/20 border-cyan-500` manual.
- `.ob-choice-icon`, `.ob-choice-label`, `.ob-choice-sub` — isi tombol pilihan (ikon + label + sub-teks).
- `.ob-nav` / `.ob-back` — footer nav (ganti `border-t border-slate-800`). Tombol Lanjut/Mulai = reuse `.au-cta`; Kembali = tombol teks.

### Per-step (apa yang diganti — logika tetap)

**Wrapper (baris 635-688):** `fixed inset-0 bg-slate-950` → `.ob-screen`; kartu → `.ob-card`; progress bar → `.ob-progress`/`.ob-progress-fill` (width tetap `(step/TOTAL_STEPS)*100%`); logo `<img src="/ourlife-logo.png">` dibiarkan sumbernya (logo asli, lihat Section 2b) — cuma rapikan styling/ukuran via class tema; footer → `.ob-nav`, tombol Lanjut pakai `.au-cta`, Kembali pakai `.ob-back`. Validasi disabled (nama wajib step1, equipment wajib step5) TETAP.

**Step 1 — Sambutan + Nama + Gender + DOB (160-209):** input nama → reuse `.au-field` + `.au-input` (sekarang `bg-slate-800 border-slate-700`). Tombol gender (Pria/Wanita) → `.ob-choice`. `<DateOfBirthPicker>` dibiarkan (komponen sendiri).

**Step 2 — Statistik Tubuh (212-306):** kartu BMI besar + kartu "Rutinitas Tersesuai" → pakai `.ob-card`-inner bertema, tapi PERTAHANKAN `bmi.borderClass/bgClass/colorClass` (itu dinamis dari `calcBMI`, biarkan). BMI scale bar + slider (`range-slider`, `bmiSliderStyle`) JANGAN diubah. Ganti cuma `text-slate-*`/`bg-slate-*` statis → token tema.

**Step 3 — Misi & Aktivitas (309-378):** goal (radio-style 1 kolom) + activity (grid 2 kolom) → `.ob-choice`. Radio dot bisa jadi `.ob-choice-radio`. Hint teks → token tema.

**Step 4 — Pengalaman/Durasi/Fokus (381-514):** PERHATIAN — di sini ada `toneClasses()` yang nge-hardcode warna per-tone (emerald/amber/purple) + glow. Keputusan: (a) pertahankan warna tone sebagai aksen semantik (Pemula=hijau, dst) tapi rapikan jadi util tema, ATAU (b) seragamkan semua ke cyan. **Default: pertahankan tone (a)** — cuma ganti `bg-slate-800 border-slate-700` idle-nya ke token tema, biar konsisten tapi tetap informatif. Durasi & Fokus → `.ob-choice` (+ fokus pakai aksen rose seperti sekarang, opsional). `<AnatomyViewer>` preview JANGAN disentuh.

**Step 5 — Lingkungan & Peralatan (517-594):** env (Rumah/Gym) + equipment multi-select → `.ob-choice`. Badge "✓" equipment aktif → `.ob-choice-check`. Warning "pilih minimal satu" → token amber tema. Counter "{n} dipilih" tetap.

**Step 6 — Jadwal Mingguan (597-633):** preset chips (PPL/Bro Split/dll) → `.ob-chip`; baris hari (Senin-Minggu) `bg-slate-800/50 border-slate-800` → `.ob-day-row` + input transparan bertema. `no-scrollbar` dibiarkan.

### Acceptance Section 6
- [ ] Onboarding satu bahasa visual dengan Login/Habits (gradient cyan, token tema, NOL `slate-*` mentah tersisa — verifikasi: `grep -c "slate-" src/components/Onboarding.tsx` → 0).
- [ ] Logo konsisten: `/ourlife-logo.png` (logo asli) dipakai di Onboarding & Login.
- [ ] `.ob-choice` dipakai konsisten di semua tombol pilihan (gender/goal/activity/duration/focus/env/equipment).
- [ ] 6 step + progress bar + back/next + validasi (nama wajib, equipment wajib) tetap jalan persis.
- [ ] BMI live, slider, AnatomyViewer preview, DateOfBirthPicker, preset jadwal, autofill schedule dari activity — semua fungsi TIDAK berubah.
- [ ] Data tersimpan benar (localStorage + Firestore `setDoc`) — TIDAK berubah.
- [ ] `npm run build` hijau. Tes tiap step (1-6) di mobile width; step 4 (anatomy) & step 6 (7 baris) nggak overflow.

---

## Urutan
1. Section 1 → 2 (auth, paling keliatan) → commit `fix(auth): style checkbox + full-width google button`. Pause.
2. Section 3 → 4 → 5 → commit `fix(ui): add .mono + style system bubble/error + cleanup dead classes`. Pause.
3. Section 6 (onboarding port — paling besar, kerjakan sendiri sampai sempurna) → commit `feat(onboarding): wholesale port to design-system theme`. Pause.

## Catatan (di luar scope, putuskan terpisah)
- Bug tanggal UTC (`toISOString`) di habits — pre-existing, masuk roadmap terpisah.
