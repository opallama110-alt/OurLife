# Prompt Claude Code — Restore Habits Card ke Desain Reference (lepas dari kotak "System")

> Copy blok di bawah ke Claude Code. Disusun sesuai `CLAUDE.md` + `PROMPT_CLAUDE_CODE.md`: satu fitur sampai sempurna, audit before edit, build green sebelum commit, pause after commit.

---

## PROMPT (copy mulai dari sini)

Halo. Sesi ini fokus **satu fitur: layar Habits** (`pages/HabitTracker.tsx`). Jangan sentuh screen lain.

**Masalah yang mau aku perbaiki**

Sekarang tiap habit card dibungkus `<SystemNotification mode="inline">` (`.sys-frame` / `sys-frame-habit`) + cuma ada "big check hari ini". Tampilannya **kaku kayak kotak notifikasi System dan bukan yang aku mau**. Aku mau **balikin desain kartu ke design reference** yang lebih hidup: kartu `.h-card` dengan **7-day week grid + check circle + flame streak + XP badge**.

**Sumber kebenaran desain (pakai INI, jangan yang lain):**

- `.design-reference/ourlife/project/components/Habits.jsx` — struktur & markup target.
- `.design-reference/ourlife/project/styles/habits.css` — styling target.

Komponen kunci di reference yang harus dibalikin:
- `HabitCard` → `<article className="h-card h-card-{color}">` berisi:
  - `.h-card-top`: `.h-card-check` (circle toggle hari ini) + `.h-card-title` + `.h-card-meta` (`.h-card-streak` dgn `.h-card-flame`, `.h-card-xp` dgn trophy, `.h-card-trash`).
  - `.h-week`: 7× `DayCell` (`.h-day` dgn `.h-day-label` + `.h-day-box` + animasi `.h-day-ripple`, hari ini = `.is-today`, selesai = `.is-on`).
- `StatTile` (`.h-stat`), `.h-hero`, `.h-newproto`, `.h-empty` — biarkan kalau sudah ada, samakan dgn reference.

**SEBELUM nulis kode (WAJIB):**

1. Baca `D:\OurLife\HANDOFF.md` lalu `D:\OurLife\PROMPT_CLAUDE_CODE.md`.
2. Audit `pages/HabitTracker.tsx` (522 baris) — perhatikan yang HARUS dipertahankan (lihat di bawah).
3. Cek `index.css`: grep apakah class `.h-card`, `.h-card-check`, `.h-week`, `.h-day`, `.h-day-ripple`, `.h-card-flame` dll **masih ada** (mungkin nyangkut dari commit `2259d5f`, atau kehapus pas pindah ke `.sys-frame`). Kalau hilang/berubah, **port ulang dari `.design-reference/.../styles/habits.css`** ke `index.css` (camelCase keyframe + kebab-case class, JANGAN `tailwind.config` extends).
4. Konfirmasi pemahaman + tanya 2-3 klarifikasi sebelum coding.

**WAJIB DIPERTAHANKAN (jangan dibuang pas ganti markup) — ini beda dari reference yang cuma prototype:**

- Data layer lewat `storageService` (single source of truth): `getHabits`, `saveHabits`, `grantStreakToken`, `getGymProfile`. **No state lib baru.**
- Model data asli pakai **`completedDates: string[]` (ISO `YYYY-MM-DD`)**, BUKAN `week:[bool×7]` index-based punya reference. Jadi:
  - Render 7 day-cell = 7 tanggal terakhir (today−6 … today). `checked` = `completedDates.includes(tanggalISO)`. `isToday` = cell terakhir.
  - Toggle day-cell panggil `togglePerDay(habitId, dateISO)` yang sudah ada (yang update `completedDates` + `calculateStreak`).
  - Label hari (`S S M T W T F`) dihitung dinamis dari tanggal, jangan hardcode TODAY_IDX=6.
- `calculateStreak` & `calculateLongestStreak` (helper di file) — pakai apa adanya untuk `.h-card-streak` (flame) & stat "STREAK TERBAIK".
- **Sub-task checklist** (`h.subTasks` / `toggleSubTask` / `completedSubTasks`) — reference nggak punya ini. Pertahankan: render di bawah `.h-week` HANYA kalau habit punya sub-task, styling dibuat nyatu dgn `.h-card` (bukan kotak system lagi).
- Freeze token toast + banner `.h-freeze` (saat semua habit selesai) — pertahankan.
- Achievement check (`achievementService.checkAndGrant` + `addUnlocks`) di `persist` — pertahankan.
- Daily Protocol AI evaluator (`DailyProtocolEvaluator`, `aiService.chat`, verdict) — pertahankan LOGIKANYA. Tapi karena ini juga lagi dibungkus `SystemNotification`, **restyle balik ke `.h-system` card** dari reference (`.h-system-head`, `.h-system-eval` "EVALUATE NOW", `.h-system-body`) biar konsisten lepas dari kotak System. Verdict tetap ditampilkan di bawahnya.
- Modal `NewHabitModal` (slide-up) — biarkan, jangan diutak-atik.

**Acceptance criteria (definisi "selesai"):**

- [ ] Tiap habit jadi `.h-card` ala reference: check circle hari ini + 7-day `.h-week` grid + flame streak + XP + trash. TIDAK ada lagi `SystemNotification`/`.sys-frame` di kartu habit.
- [ ] Toggle check circle ATAU day-cell hari ini → update `completedDates` + streak + persist, reaktif.
- [ ] Day-cell 7 hari nampilin history `completedDates` dengan benar (hari ini ter-highlight `.is-today`).
- [ ] Sub-task checklist tetap jalan (untuk habit yang punya), nyatu visual dgn `.h-card`.
- [ ] Daily Protocol pakai `.h-system` look, AI eval tetap jalan.
- [ ] Freeze token + achievement unlock tetap jalan.
- [ ] `npm run build` hijau, no TS error. Responsive mobile, grid 7 hari nggak overflow.

**Constraints (CLAUDE.md — patuhi ketat):**

- React 18 + Vite + TS + Tailwind. No SvelteKit/Next.js. No `<style jsx>`.
- Animasi di `index.css` (camelCase keyframe + kebab-case class). No `tailwind.config` extends.
- Kalau ada `transform-style: preserve-3d`: jangan `filter`/`mix-blend-mode` di element itu/parent.
- Copy user (toast/modal/button) = Bahasa Indonesia. Code/comment/log = English.
- Jangan refactor `aiService.ts` ke Cloud Function.

**Protokol eksekusi:** audit before edit → konfirmasi → satu fitur sampai sempurna → `npm run build` hijau → commit (`feat(habits): ...` / `revert(habits): ...`) → pause, jangan auto-lanjut.

Mulai dari step 1 (baca HANDOFF + audit + grep index.css), lalu konfirmasi ke aku sebelum coding.

## (copy sampai sini)

---

# Saran improvement UI/UX Habits berikutnya (roadmap — di luar restore)

Kerjain satu-satu setelah restore beres (aturan "satu fitur sampai sempurna"). Diurut quick win → epik.

## A. Quick wins
1. **Micro-interaction saat complete** — check circle juicy: scale-bounce + flame "menyala" + angka streak naik. Pakai `.h-day-ripple` yang udah ada di reference sebagai basis, perkuat keyframe-nya di `index.css`.
2. **Streak milestone feedback** — toast pas streak nyentuh 3/7/30/100 hari ("Streak 7 hari! Sistem mengakui konsistensimu."). Reuse pola toast freeze token yang udah ada.
3. **Empty state lebih hidup** — `.h-empty` sekarang minimal; tambah ilustrasi/ikon + CTA "Protokol Baru".
4. **Sort otomatis** — habit belum selesai hari ini naik ke atas; yang selesai turun + dim. Ngurangin friksi.
5. **Haptic feedback** (PWA) — `navigator.vibrate` halus saat complete, bisa di-toggle di Settings.

## B. Konsistensi sistem desain
6. **Cleanup CSS mati** — `index.css` udah 198KB. Setelah lepas dari `.sys-frame` di habits, audit & buang class habits yang nggak kepake lagi.
7. **Skeleton loading** — saat `getHabits()` load, tampilkan skeleton `.h-card`, bukan flash kosong.
8. **Token warna konsisten** — pastikan `h-card-cyan`/`h-card-orange` pakai token yang sama dgn rank colors di Dashboard/Gym.

## C. Fitur baru (differentiation)
9. **Habit detail / progress dashboard** — ini yang dulu di-park sebagai "Tier 6" di komentar kode (`completedDates` + `completedSubTasks` udah cukup, no schema change): heatmap kalender, completion rate %, current vs best streak, sparkline 30 hari. Tap `.h-card` → buka detail.
10. **XP/reward integration** — complete habit kasih XP/token via `gamificationService` biar habits nyatu ke core loop rank, bukan modul terpisah. (`h-card-xp` udah ada slotnya.)
11. **AI habit coach** — manfaatin `aiService`: kalau streak putus, tawarin pecah jadi langkah lebih kecil.
12. **Weekly review + reminder** — recap mingguan (habit selesai, streak terpanjang) + pengingat jadwal (PWA notification).

## D. Accessibility & polish
13. **A11y** — kontras WCAG AA, touch target ≥44px untuk 7 day-cell, `aria-label`/`aria-pressed` (sebagian udah ada), focus state keyboard.
14. **Reduced motion** — hormati `prefers-reduced-motion` untuk ripple/flame.

**Urutan rekomendasi:** Restore card (prompt atas) → A.1 + A.2 (paling cepat ngangkat "feel") → B.6/B.7 → C.9 (progress dashboard) → C.10 (XP) → sisanya.
