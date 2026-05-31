# Visual Fixes Batch 2 — Leaderboard, Verdict, Logo, Settings

> Hasil click-through user. Patuhi `CLAUDE.md`: audit before edit, build green sebelum commit, pause after commit, copy user = Bahasa Indonesia. Semua di `src/`. Backend "Coming Soon" TIDAK termasuk batch ini (lihat §Roadmap bawah).

## Section A — Leaderboard / Hunter Ranking Board

File: `src/components/Leaderboard.tsx` (rank boundaries pakai `grid grid-cols-2 md:grid-cols-3`).

1. **"National Level Hunter" nanggung** — 7 rank, grid 2-3 kolom → item ke-7 (ganjil) sendirian di kiri, keliatan nanggung (di desktop & HP). Fix: item terakhir kalau jadi baris sendiri → span full-width (`col-span-2 md:col-span-3`), ATAU buat semua kartu rank boundary lebih konsisten. Cek `.design-reference/.../RankBadge.jsx` + `rankbadge.css` buat layout yang dimaksud.
2. **Background kotak beda dari reference** — bandingin bg kartu rank boundary sekarang vs `.design-reference/ourlife/project/styles/rankbadge.css`. Samakan (kemungkinan bg/border/gradient beda).

## Section B — Rank progress "bar dobel"

User lihat 2 progress bar di area rank atas. Audit dulu: kemungkinan ada DUA komponen beda yang sama-sama nampilin progress —
- `src/components/StatusCard.tsx:268` (rank progress bar, ungu, `rankProgress.progressPercent`)
- + kartu "E-Rank Lv.4 — 486/500 XP" terpisah (screenshot ke-2) yang juga punya bar.
- + "Hunter Rank Track" di Penghargaan/Achievement (screenshot ke-3) yang JUGA bar.

Tentukan: apakah ini 3 tempat berbeda yang masing-masing valid (Dashboard vs Profile vs Achievement), atau ada duplikasi nyata di satu layar. Kalau emang 2 bar nempel di satu kartu yang sama → itu bug, gabung jadi 1. Kalau beda kartu/konteks → mungkin OK, tapi konfirmasi ke user mana yang dia maksud. JANGAN hapus tanpa tau.

## Section C — Verdict "M" aneh (drop-cap)

File: `src/index.css:1478` — `.sys-body--verdict::first-letter` bikin huruf pertama jadi besar (drop-cap ala koran). Pas verdict mulai "Maaf, ..." → huruf M gede sendiri, keliatan aneh/rusak.

Fix: keputusan user-facing. Opsi: (a) hapus `::first-letter` drop-cap sepenuhnya (paling aman, teks rata), atau (b) pertahankan tapi perhalus (ukuran lebih kecil, line-height fix biar nggak overlap). **Default: hapus drop-cap** — verdict AI sering mulai dengan kata apa aja ("Maaf", "Hunter", angka), drop-cap cuma bagus buat teks naratif konsisten, nggak buat output AI dinamis.

## Section D — Logo pojok kiri atas (header)

File: `src/components/Layout.tsx:69` — `.ol-top-logo` render SVG inline (`ol-brand-grad`), bukan logo asli. User: "logonya masih belum sesuai".

Fix: ganti SVG inline → `<img src="/ourlife-logo.png" alt="OurLife" />` (logo asli, konsisten dgn Login + Onboarding yang udah pakai PNG). Pertahankan `.ol-top-name` wordmark "OurLife" di sebelahnya kalau masih mau. Sesuaikan ukuran di `.ol-top-logo` (kemungkinan ~28-32px).

## Section E — Settings nggak sesuai design-reference

Reference ADA: `.design-reference/ourlife/project/components/Settings.jsx`, `SettingsExtra.jsx`, `SettingsScreen.jsx`, `styles/settings.css`.

File live: `src/components/Settings.tsx`.

Audit: bandingin Settings live (3 tab: My Profile / Goals & Tracking / App Settings) vs reference layar per layar. Catat beda konkret (layout, spacing, warna, komponen) SEBELUM ngedit. Lalu samakan ke reference — TAPI:
- JANGAN sentuh logika: save account, save preferences, equipment toggle, streak token display, delete account, logout, replay intro, semua handler + Firestore.
- "Coming Soon" stub BIARKAN sebagai stub (backend nyusul, lihat roadmap) — cuma rapikan tampilannya kalau beda dari reference.
- Konfirmasi ke user kalau ada beda besar yang ambigu (mungkin live versi sengaja lebih baru dari reference).

---

## Urutan & commit
1. Section C (verdict drop-cap) + D (logo header) → cepat, commit `fix(ui): remove verdict drop-cap + real logo in header`. Pause.
2. Section A (leaderboard) → commit `fix(leaderboard): full-width last rank + match reference bg`. Pause.
3. Section B (progress bar audit) → tentukan dulu, baru fix kalau emang bug. Pause.
4. Section E (Settings) → paling besar, sendiri sampai sempurna. commit `fix(settings): match design-reference layout`. Pause.

Build hijau tiap commit. Tes visual tiap layar di dev.

---

## Roadmap — Backend "Coming Soon" (TIDAK di batch ini — proyek terpisah, bertahap)

User mau fitur "Coming Soon" di Settings dibikin backend-nya (pakai Firebase). Ini 10+ fitur, JANGAN sekaligus. Urutan prioritas (per diskusi user, bisa berubah sesuai kebutuhan / benchmark app fitness general):

**Gelombang 1 — quick win (hampir full frontend):**
- Export My Data (JSON/CSV dari localStorage/Firestore) + Clear Cache. Paling gampang.

**Gelombang 2 — Firebase Auth (standar):**
- Change email / change password (Firebase Auth API langsung).
- 2FA (lebih berat — keamanan, hati-hati).

**Gelombang 3 — kecil tapi UI-wide:**
- Theme toggle (light mode — tapi cek dulu, master prompt bilang light mode mungkin nggak ship), Font size.

**Gelombang 4 — berat (epic, berhari-hari):**
- FCM push notifications (Workout reminder, Streak alert, Achievement, Habit check-in, Daily motivation) — butuh FCM setup + service worker + permission flow + server-side trigger (Cloud Function).
- Progress reports / Weekly digest.

Catatan: ini selaras Tier 2 di `CLAUDE.md` §8 (FCM, 2FA, theme, font, export udah dijadwalkan di sana). Kerjain per-gelombang, satu fitur sampai sempurna, commit terpisah. Masing-masing butuh spec sendiri nanti.
