# OurLife — Master Prompt & Project Bible

> **Single source of truth.** Paste seluruh isi file ini sebagai pesan pertama ke chat Claude Code di VS Code setiap sesi baru. Mengandung identitas proyek, state saat ini, arsitektur, konvensi, roadmap strategis, detail eksekusi fase, dan pola kerja. Setelah Claude konfirmasi paham, kasih instruksi fitur spesifik.

---

## DAFTAR ISI

1. Peran & Tujuan Claude
2. Apa Itu OurLife?
3. State Proyek Saat Ini (Jangan Redo)
4. Stack Teknologi
5. Arsitektur — Single SPA + Service Layer
6. Konvensi Kode & Standar Kualitas
7. Struktur Folder
8. Strategic Roadmap — Tier 0 sampai Tier 6
9. Detail Eksekusi Fase B–E
10. Pola Kerja Per Fitur
11. Aturan Interaksi
12. File Management & Cleanup
13. Instruksi Pertama Untuk Claude
14. Catatan Akhir

---

## 1. PERAN & TUJUAN CLAUDE

Halo Claude. Kamu berperan sebagai **Senior Full-Stack Engineer + Product-Minded Software Architect** yang membantu saya melanjutkan aplikasi **OurLife** dari state saat ini menuju produk komersial. Kamu wajib:

1. **Memahami konteks dulu sebelum menulis kode.** Baca prompt ini sampai habis sebelum tulis apa pun.

2. **Filosofi inti — SATU FITUR, SAMPAI SEMPURNA.** Jangan kerjakan 5 fitur setengah jadi. Lebih baik 1 fitur yang shipping-ready: production code, edge case ter-handle, build green, commit message yang punya context. Setelah itu pause, tunggu konfirmasi, baru lanjut fitur berikutnya.

3. **Tidak ada placeholder/dummy code** kecuali saya minta. Setiap fungsi harus benar-benar bekerja dan terhubung ke state aplikasi yang ada.

4. **Audit sebelum edit.** Sebelum nge-edit file, baca file itu dulu. Verifikasi line number, verifikasi shape data, verifikasi caller-callee. Spec yang saya kasih bisa jadi sedikit off — file aktual selalu sumber kebenaran.

5. **Push back kalau diminta sesuatu yang ngerusak kerjaan sebelumnya.** Phase A (15+ commit), Phase B (2 commit), Phase A.5/A.6/A.7 adalah keputusan deliberate. Kalau request baru me-revert atau menabrak hasil itu, surface konfliknya sebelum eksekusi.

6. **Bertanya saat ambigu.** Gunakan pattern `AskUserQuestion` kalau tersedia, atau tulis daftar pertanyaan klarifikasi singkat. Lebih baik 3 pertanyaan di awal daripada salah arah 1 jam.

7. **Penjelasan teknis berbobot.** Setiap pilihan trade-off (mis. "kenapa pakai CSS mask daripada SVG path"), jelaskan pros/cons-nya. Saya iteratif developer — saya pengen tahu reasoning, bukan cuma hasil.

---

## 2. APA ITU OurLife?

**OurLife** adalah aplikasi web (PWA) untuk **fitness tracking + habit building** yang ter-gamifikasi. Konsep: gabungan **Hevy/Strong** (gym log) dengan **Duolingo** (habit streak + reward loop) dan **Solo Leveling** (rank progression + character stat aesthetic).

**Tagline:** Setiap workout dan habit yang lo kerjain = XP. XP cukup = level up. Level cukup = rank naik (E-Rank → D → C → B → A → S → National Hunter). Sambil itu, lo develop character stats: STR (kekuatan), VIT (vitalitas), AGI (kelincahan), PER (persepsi/disiplin), INT (intelligence/variasi).

**User base:** mahasiswa & profesional Indonesia umur 18–35 yang pengen konsisten olahraga + bangun habit tapi gampang bosan dengan tracker biasa. UI/UX dimaksudkan untuk "habit-forming" — celebration micro-interactions, dark theme cinematic, emotional pet companion (The System) sebagai accountability mirror.

**Posisi pasar:** premium-feeling tapi free-tier dulu. Eventually freemium dengan paid tier untuk fitur seasonal rank kompetitif + AI coach unlimited.

---

## 3. STATE PROYEK SAAT INI — JANGAN REDO YANG SUDAH SHIPPED

### 3.1 Phase A — SUDAH SELESAI ✅
1. **DOB system** — `dateOfBirth` ISO string ganti static `age`. Auto-age calc di `utils/dateUtils.ts`. `DateOfBirthPicker` component. Migration via `services/migrationService.ts`.
2. **Settings 3-tab redesign** — My Profile / Goals & Tracking / App Settings. Account section embed avatar upload + display name.
3. **StatusCard inline** — replacement untuk StatusWindowModal. Compact identity + collapsible expand (attributes, Power Signature radar, combat stats, rank progress).
4. **Streak Protection** — `streakFreezeTokens` max 3, earned dari complete daily habits, auto-applied saat missed day mau break streak. `services/streakProtectionService.ts`, `components/TokenDisplay.tsx`, `components/TokenUsedModal.tsx`.
5. **Achievement system** — 21 achievements dengan rarity tiers (iron → mythic), progress tracking, XP + token rewards, unlock notifications. `services/achievementService.ts`, `context/AchievementContext.tsx`.

### 3.2 Phase A UI/UX overhaul Steps 1-5 — SUDAH SELESAI ✅
- **Step 1:** `StatusWindowModal.tsx` deleted, `StatusCard.tsx` created.
- **Step 2:** Recovery list emerald glow de-escalated. Status chips (✓ Ready / ⏳ Recovering) added below anatomy viewer.
- **Step 3:** Anatomy SVG drop-shadow filters stripped. EXHAUSTED state pakai translucent red fill. Massive perf win di muscle picker.
- **Step 4:** Pet avatar (round blob, emotion states) — originally `components/SystemPet.tsx`, since superseded by `src/components/hud/SystemBot.tsx` (Phase A.5 FAB). Replace static Sparkles avatar di SystemChat.
- **Step 5a:** StatusCard moved into Stats Grid (3-col on desktop).
- **Step 5b:** `Settings.tsx:122` reads `displayName` from `storageService.getUserState().name` first (UserState canonical).

### 3.3 Phase A.5 + A.6 + A.7 — SUDAH SELESAI ✅
- **A.5:** Pet jadi FAB avatar dengan 8 emotion (idle/thinking/happy/excited/tired/sad/shocked/angry). Habit-aware emotion priority chain (missed habits → angry, streak broken → sad, late → tired, all done → happy).
- **A.6:** FAB recenter di mobile (left-1/2 -translate-x-1/2), halo trick untuk fake-cutout effect.
- **A.7:** Real notched bottom nav via CSS mask radial-gradient. Halo trick dari A.6 dihapus.

### 3.4 Phase B — SUDAH SELESAI ✅
1. **Step 6a Power Signature data-driven** — `calculateAttributes` ekstensi dengan BMI baseline, habit completion rate, schedule adherence, exercise category preference. Signal additif (existing floors preserved). Capped at 100.
2. **Step 6b Fatigue display polish** — `FatigueReport` gain `recoveringCount`, `totalMuscles`, `recoveringPercent`. Surface di StatusCard collapsed sub-line + expanded Top-3 Recovering mini-list.

### 3.5 Branch state
- Active branch: `feature/dob-system` (cek dengan `git branch --show-current`)
- 19+ atomic commits ahead of `main`
- Bundle 1.7 MB JS (Phase C addresses — Tier 4.1)
- Build green (verifikasi dengan `npm run build` sebelum commit)
- GitHub repo: `opallama110-alt/OurLife` (Private, harus tetap Private sampai Tier 0 security selesai)

### 3.6 Yang BELUM dikerjakan (referensi Section 8 untuk detail)
- **Tier 0 (Critical, security):** Move Groq API ke Firebase Function, Firebase rules audit, role-based admin, cascade-delete account, avatar sanitation, confirmation dialogs.
- **Tier 1 (quick wins):** Wire tired emotion ke fatigue, bilingual emotion regex, schedule day-key audit, resend verification email button.
- **Tier 2 (Coming Soon → Shipped):** Notifications FCM, theme toggle, font size, export data, clear cache, 2FA, change email/password.
- **Tier 3 (Feature completeness):** Onboarding validation, leaderboard profile click, admin pagination, workout templates, per-set logging, PR tracking, body measurements, goals.
- **Tier 4–6:** Polish, differentiation features, major epics (i18n, rank seasonal, social, testing).

---

## 4. STACK TEKNOLOGI

- **Frontend:** React 18 + Vite + TypeScript (strict mode) + Tailwind CSS.
- **Backend-as-a-Service:** Firebase
  - Authentication (email/password + Google sign-in)
  - Firestore (denormalized profile data + leaderboard queries)
  - Realtime Database / RTDB (live state via `onSnapshot`)
  - Storage (avatar upload)
  - Cloud Functions (NOT in current scope — project on Spark free plan; `functions/src/chatWithSystem.ts` kept as deprecated reference for future Tier 6 multi-user migration)
- **AI:** `groq-sdk` ^0.7.0, Llama 3.3 70B Versatile, function calling (`execute_penalty`, `mark_quest_complete`). Called **direct from client** via `dangerouslyAllowBrowser: true` — user-accepted trade-off for personal-PWA + Groq free tier. See Section 6.5.
- **Charts:** `recharts` ^3.7.0 (Power Signature radar + future analytics).
- **Icons:** `lucide-react` — pakai konsisten, jangan campur library icon lain.
- **PWA:** `vite-plugin-pwa` — auto-generate service worker.
- **State:** `services/storageService.ts` pattern. Single source of truth + subscribe untuk reactive components. TIDAK BOLEH introduce Redux/Zustand/Recoil tanpa diskusi.

**YANG TIDAK BOLEH DIPAKAI:**
- SvelteKit syntax (`error(500, ...)`, dll). React/Vite only.
- Next.js syntax (`<style jsx>`, `getServerSideProps`, dll).
- Eksternal API yang nggak diminta (mis. `v2.exercisedb.io`). Local assets first di `/public/`.
- `tailwind.config.js` `extend` untuk animasi. Semua keyframe di `index.css` (project gak punya tailwind.config.js).

---

## 5. ARSITEKTUR — SINGLE SPA + SERVICE LAYER

OurLife pakai **single-page application** dengan client-side routing (`react-router-dom`). Backend logic terjadi di **service layer** yang abstrak away Firebase + localStorage caching.

### 5.1 Layer separation

```
┌─────────────────────────────────────┐
│  PAGES (src/pages/*.tsx)            │  ← Dashboard, Profile, Gym, Habits, Settings, Leaderboard, Admin
├─────────────────────────────────────┤
│  COMPONENTS (src/components/*.tsx)  │  ← StatusCard, SystemBot, AnatomyViewer, etc.
├─────────────────────────────────────┤
│  CONTEXT (src/context/*.tsx)        │  ← AuthContext, AchievementContext
├─────────────────────────────────────┤
│  SERVICES (src/services/*.ts)       │  ← business logic + I/O abstraction
│  - storageService     : source of truth, cache + Firebase sync
│  - gamificationService: XP, levels, ranks, achievements eval
│  - attributeService   : Power Signature stats (STR/VIT/AGI/PER/INT)
│  - fatigueService     : per-muscle fatigue decay
│  - streakProtectionService: token economy
│  - achievementService : checkAndGrant flow
│  - aiService          : Groq client + tool bridge
│  - notificationService: FCM (currently stub)
│  - migrationService   : schema migrations on boot
├─────────────────────────────────────┤
│  FIREBASE (firebase-config.js)      │  ← SDK init at repo ROOT (not in src/)
└─────────────────────────────────────┘
```

### 5.2 State pattern — CRITICAL

`storageService.ts` adalah **single source of truth** untuk client-side state. Pattern:

- **Read:** `storageService.getGymProfile()`, `storageService.getHabits()`, dll. Return data dari `localCache` (in-memory).
- **Write:** `storageService.saveGymProfile(updated)`. Triggers RTDB sync + invalidates cache.
- **Subscribe:** `storageService.subscribe(callback)`. Component re-renders saat state berubah.

Komponen TIDAK boleh akses Firebase langsung kecuali di service layer. Semua mutation via `storageService.*` method.

### 5.3 Animation convention

- Semua keyframe di `index.css`.
- Naming: **camelCase keyframe** + **kebab-case utility class**.
  - Contoh: `@keyframes slideUp` + `.animate-slide-up`
  - Contoh: `@keyframes petFloat` + `.animate-pet-float`
- Stagger pattern: `delay-100`, `delay-200`, `delay-300`, `delay-400`.

### 5.4 Theme tokens

- Dark theme only (light mode is Tier 2 stub, may not ship).
- Page bg: `bg-slate-950`
- Card bg: `bg-slate-900`
- Card border: `border-slate-800`
- Primary text: `text-white`
- Secondary text: `text-slate-400`
- Accent (info/active): `text-cyan-400`, `border-cyan-500/30`
- Urgency (warning/exhausted): `text-red-400`, `border-red-500/30`
- Success: `text-emerald-400`
- Card class shorthand: `jarvis-card`, `jarvis-card-glow`, `gradient-border`

---

## 6. KONVENSI KODE & STANDAR KUALITAS

### 6.1 Naming
- React component file: `PascalCase.tsx` (mis. `StatusCard.tsx`)
- Service file: `camelCase.ts` (mis. `attributeService.ts`)
- TypeScript interface/type: `PascalCase` (mis. `GymProfile`)
- Variabel/function: `camelCase`
- Konstanta: `SCREAMING_SNAKE_CASE` (mis. `STR_KEYWORDS`)
- CSS class: `kebab-case`
- Tailwind class order: layout → spacing → typography → color → effect

### 6.2 Type safety
- Strict mode TypeScript ON. Tidak boleh ada `any` kecuali absolutely necessary (di-justify dengan komentar).
- Firebase data shape: interface eksplisit di `types.ts`.
- React props: interface terpisah, bukan inline.

### 6.3 Komentar
- Bahasa Inggris di code (konsisten dengan ecosystem React/TypeScript).
- Komentar menjelaskan **kenapa**, bukan **apa**.
- Block section pemisah:
  ```typescript
  // ═══════════════════════════════════════════════════════════════
  // SECTION NAME
  // ═══════════════════════════════════════════════════════════════
  ```

### 6.4 Bahasa user-facing
- Copy untuk user (toast, modal, label, button): **Bahasa Indonesia**.
- System messages, error logs ke console: **Bahasa Inggris**.

### 6.5 Security
- **JANGAN** introduce hardcoded API keys. Pakai `import.meta.env.VITE_X` dari `.env.local` (yang harus di `.gitignore`).
- **`dangerouslyAllowBrowser: true`** in `aiService.ts` is the project's ONE accepted exception — for direct Groq SDK calls on the personal-PWA / free-tier use case. **JANGAN add the flag to any new module** without explicit user OK.
- **JANGAN** log PII (nama, email, XP user lain) ke console di production code.
- `aiService.ts` security policy: client-side direct Groq call accepted (user decision). Tier 0.1 server-side migration **DEFERRED to Tier 6** — see Section 8.2 row 0.1 note. JANGAN silently refactor to Cloud Function.

### 6.6 Error handling
- Service layer: throw atau return discriminated union (`{ ok: true, data } | { ok: false, error }`).
- Component layer: try/catch sekitar service calls, surface error ke user via toast atau inline message.
- TIDAK boleh swallow error tanpa logging.

### 6.7 Build verification
- Sebelum commit: `npm run build` harus green. Tidak ada warning baru (kecuali existing 500KB warning yang Tier 4.1 address).
- Bundle delta harus di-report di commit message (`+X.X kB` atau `−X.X kB`).

### 6.8 Constraints dari project bible
1. **No SvelteKit syntax.** React/Vite only.
2. **Local assets first.** `/public/exercises/`, `/public/assets/`. No external API fetch tanpa diskusi.
3. **CSS 3D constraints.** Jangan pakai `filter` (drop-shadow) atau `mix-blend-mode` di element dengan `transform-style: preserve-3d` (mis. flip cards) — flattens 3D context.
4. **State management.** `services/storageService.ts` only. `onSnapshot` untuk real-time sync.
5. **Clean navigation.** Main router minimal. Profile, Tools, Admin nested under `/settings` (atau direct route — adjust based on existing).

---

## 7. STRUKTUR FOLDER

> **Catatan (Fase 2, commit `49e787d`):** Semua source frontend sekarang di bawah **`src/`**. Path inline di dokumen ini yang nyebut `components/...`, `services/...`, `pages/...`, dll. maksudnya `src/components/...`, `src/services/...`, `src/pages/...`. Yang TETAP di root: `firebase-config.js`, `index.html`, `vite.config.ts`, `tsconfig.json`, `functions/` (backend), `public/`.

```
OurLife/
├── src/                             ← all frontend source (Fase 2 — moved here from root)
│   ├── components/                  ← reusable UI
│   │   ├── Anatomy/AnatomyViewer.tsx
│   │   ├── hud/                     ← HUD primitives (SystemBot, BottomNav, StatChip, RankBadge, ...)
│   │   ├── onboarding/              ← AnatomicalHeart, FirstDailyQuest, IntroSequence
│   │   ├── habits/NewHabitModal.tsx
│   │   ├── StatusCard.tsx  SystemChat.tsx  Layout.tsx  Settings.tsx
│   │   ├── Login.tsx  Onboarding.tsx  AdminDashboard.tsx  Leaderboard.tsx
│   │   ├── Achievement{Card,Emblem,Gallery,Modal,Notification}.tsx
│   │   └── TokenDisplay.tsx  TokenUsedModal.tsx  DateOfBirthPicker.tsx  VerifyEmailGate.tsx
│   │
│   ├── pages/                       ← Dashboard, Profile, GymTracker, HabitTracker, CalculatorSuite
│   ├── context/                     ← AuthContext.tsx, AchievementContext.tsx
│   │
│   ├── services/                    ← business logic + I/O
│   │   ├── storageService.ts        ← THE source of truth
│   │   ├── gamificationService.ts  attributeService.ts  fatigueService.ts
│   │   ├── streakProtectionService.ts  achievementService.ts  exerciseService.ts
│   │   └── aiService.ts  notificationService.ts  migrationService.ts
│   │
│   ├── hooks/usePWAInstall.ts
│   ├── utils/                       ← dateUtils.ts, bmi.ts
│   ├── constants/muscleMapping.ts   config/constants.ts   data/workoutPackages.ts
│   │
│   ├── types.ts                     ← all TypeScript interfaces
│   ├── App.tsx                      ← router + providers
│   ├── index.tsx                    ← entry (mounted by /index.html)
│   └── index.css                    ← global CSS + all keyframes
│
├── functions/                       ← Firebase Cloud Functions (backend; idle — see note below)
├── public/                          ← static assets (exercise images, logos, messaging-sw)
│
├── firebase-config.js               ← Firebase SDK init (repo ROOT; reads VITE_* from .env.local)
├── index.html                       ← Vite entry → loads /src/index.tsx + /src/index.css
├── CLAUDE.md  PROMPT_CLAUDE_CODE.md  HANDOFF.md  README.md
├── .env.local                       ← secrets (gitignored)
└── .gitignore  vite.config.ts  tsconfig.json  package.json  firebase.json  *.rules
```

### Kenapa nggak ada folder `backend/` + `database/`?

OurLife pakai arsitektur **React + Firebase (BaaS)**, bukan MERN/PERN. Backend = Firebase (Auth + Firestore + RTDB), di-manage Firebase — jadi **nggak ada** Express server, folder `controllers/`/`models/`/`routes/`, atau `schema.sql` yang ditulis manual. Database = Firestore (NoSQL), no SQL schema. Yang paling dekat ke "backend folder" = `functions/` (Cloud Functions) — tapi currently idle (Groq dipanggil dari client, deferred ke Tier 6). Template fullstack generik (backend Express + SQL terpisah) **tidak berlaku** di sini; jangan bikin folder `backend/`/`database/` manual — cuma bikin folder kosong yang misleading.

---

## 8. STRATEGIC ROADMAP — TIER 0 sampai TIER 6

Total 71 findings dari audit. Organized berdasarkan prioritas + timeline.

### 8.1 Ringkasan

| Tier | Description | Items | Estimated effort |
|------|-------------|-------|-------|
| 0 | Critical pre-launch blockers (security, data integrity) | 6 | 1–2 minggu |
| 1 | Phase A.7 + quick wins | 8 | 1–2 hari |
| 2 | "Coming Soon" stubs → actually shipped | 9 | 2–3 minggu |
| 3 | Feature completeness — finishing half-built work | 12 | 3–4 minggu |
| 4 | Commercial polish — consistency, accessibility, perf | 15 | 2–3 minggu |
| 5 | Differentiation features | 10 | 4–6 minggu |
| 6 | Major epics — i18n, rank seasonal, testing, social | 5 | 8–12 minggu |
| **Total** | | **65** | **~4–6 bulan ke fully commercial** |

Lean cut "good enough to charge for it" = **Tier 0–3 selesai = ~6–8 minggu**.

### 8.2 Tier 0 — Critical pre-launch blockers

| # | Item | Effort | Files |
|---|------|--------|-------|
| 0.1 | ~~Move Groq API ke Firebase Function~~ — **DEFERRED to Tier 6** per user decision (personal PWA + free tier). Stays as direct client Groq call with `dangerouslyAllowBrowser`. `functions/src/chatWithSystem.ts` marked deprecated. | — | — |
| 0.2 | Audit + tulis `firestore.rules` + `database.rules.json` | M (3 jam) | rules files |
| 0.3 | Role-based admin (replace hardcoded email check) | M (3 jam) | storageService.ts, App.tsx, AdminDashboard.tsx |
| 0.4 | Cascade-delete account (Storage + subcollections + Auth) | L (5 jam) | AuthContext.tsx, functions/ |
| 0.5 | Avatar sanitation (server-side re-encode) | M (4 jam) | Settings.tsx, functions/ |
| 0.6 | Confirmation dialogs untuk destructive actions | S (2 jam) | New ConfirmDialog component, apply across |

**Branch jangan public sampai Tier 0 selesai.**

### 8.3 Tier 1 — Phase A.7 + quick wins

| # | Item | Effort | Status |
|---|------|--------|--------|
| 1.1 | Phase A.7 — Real notched bottom nav (CSS mask) | S (1 jam) | ✅ DONE |
| 1.2 | Wire `tired` emotion ke fatigue.score >= 70 | S (15 menit) | TODO |
| 1.3 | Bilingual emotion regex (ID + EN keywords) | S (10 menit) | TODO |
| 1.4 | Schedule day-key format audit | S (15 menit) | TODO |
| 1.5 | Resend verification email button | S (30 menit) | TODO |
| 1.6 | Settings disabled-button cleanup atau group | S (30 menit) | TODO |
| 1.7 | Login: show password toggle | S (15 menit) | TODO |
| 1.8 | Error toast standardization | M (3 jam) | TODO |

### 8.4 Tier 2 — Coming Soon → Shipped

| # | Item | Effort |
|---|------|--------|
| 2.1 | FCM notifications (workout reminders, streak alerts, etc.) | XL (2-3 hari) |
| 2.2 | Theme toggle (real light mode) — atau hapus stub | L (6-8 jam) atau S (30 menit) |
| 2.3 | Language i18n (lihat Section 9.3) | XL (1.5-2 hari) |
| 2.4 | Font Size selector | S (1 jam) |
| 2.5 | Export Data (CSV / JSON) | M (3 jam) |
| 2.6 | Clear Cache | S (1 jam) |
| 2.7 | Two-Factor Auth (Firebase TOTP) | M (4 jam) |
| 2.8 | Change Email / Password | M (3 jam) |
| 2.9 | Daily Check-in Reminder + Weekly Digest | XL (2 hari, tied to FCM) |

### 8.5 Tier 3 — Feature completeness

| # | Item | Effort |
|---|------|--------|
| 3.1 | Onboarding validation + autosave | M (2-3 jam) |
| 3.2 | Leaderboard: profile click + filters | M (4 jam) |
| 3.3 | Admin Dashboard: pagination + search + sort | M (4-5 jam) |
| 3.4 | Workout Templates / Saved Routines | M (4 jam) |
| 3.5 | Workout Log: per-set granularity (RPE, rest, tempo) | M (5 jam) |
| 3.6 | PR (Personal Record) Tracking | M (3 jam) |
| 3.7 | Body Measurement Tracking + photo timeline | M-L (6 jam) |
| 3.8 | Goals dengan Deadline | L (8 jam) |
| 3.9 | Rest Timer auto-trigger | S (2 jam) |
| 3.10 | Streak Milestone celebrations | S (2 jam) |
| 3.11 | SystemChat history persistence | M (3 jam) |
| 3.12 | Achievement gallery filters | S-M (2 jam) |

### 8.6 Tier 4 — Commercial polish

| # | Item | Effort |
|---|------|--------|
| 4.1 | Phase C — Bundle code-splitting (lazy-load admin, calc, recharts) | S-M (2 jam) |
| 4.2 | Skeleton loaders (replace spinners) | M (3 jam) |
| 4.3 | Empty states with CTAs | M (4 jam) |
| 4.4 | Pull-to-refresh on mobile lists | M (3 jam) |
| 4.5 | Color consistency pass (tokens: primary, accent, urgency) | M (4 jam) |
| 4.6 | Border-radius consistency | S-M (2 jam) |
| 4.7 | Animation timing tokens | S (2 jam) |
| 4.8 | Search bars on long lists | M (3 jam) |
| 4.9 | Date range picker on charts | M (3 jam) |
| 4.10 | Undo for accidental deletions | M (4 jam) |
| 4.11 | Accessibility audit | L (1 hari) |
| 4.12 | Mobile responsive sweep | M (5 jam) |
| 4.13 | Lazy-load images | S (1 jam) |
| 4.14 | Re-render audit (useMemo / useCallback) | M (4 jam) |
| 4.15 | Strip console.log of PII for production | S (1 jam) |

### 8.7 Tier 5 — Differentiation features

| # | Item | Effort | Status |
|---|------|--------|--------|
| 5.1 | Seasonal Rank System (ML/HoK style) | 3-4 hari | BLOCKED — design first |
| 5.2 | Friend system + challenges | 1 minggu | — |
| 5.3 | Exercise library quality bump (video, instructions) | M (6 jam) + L (3-5 hari curation) | — |
| 5.4 | Progress photos timeline | L (1 hari) | — |
| 5.5 | Sleep / Recovery tracking lite | M (5 jam) | — |
| 5.6 | Mindfulness corner | M (6 jam) | — |
| 5.7 | Plate calculator | S (2 jam) | — |
| 5.8 | Nutrition lite (protein + water) | M (5 jam) | — |
| 5.9 | Notification message center | M (4 jam) | — |
| 5.10 | Share workout to social media | M (5 jam) | — |

### 8.8 Tier 6 — Major epics

| # | Item | Effort | Status |
|---|------|--------|--------|
| 6.1 | i18n system (full EN + ID + extensible) | ~2 hari infra + 1 hari per locale | BLOCKED — design first |
| 6.2 | Test coverage from zero (vitest + RTL + Playwright) | ~2 minggu | — |
| 6.3 | Offline mode (write queue + conflict resolution) | 1 minggu | — |
| 6.4 | Sentry error tracking + perf monitoring | M (1 hari) | — |
| 6.5 | Wearable integrations (Apple Watch / Garmin / Fitbit) | 1 minggu per provider | — |

### 8.9 Suggested execution timeline

**Sprint 1 (Minggu 1-2): Critical + Phase A.7 polish**
- Tier 0.2, 0.3, 0.6, 0.4, 0.5 (Tier 0.1 deferred per user decision — see Section 8.2 row)
- Tier 1.2, 1.3, 1.4, 1.5
- Goal: branch aman di-merge ke main, security closed.

**Sprint 2 (Minggu 3-4): Coming Soon → Shipped**
- Tier 2.4, 2.5, 2.6, 2.7, 2.8, 2.1 (FCM big one)
- Goal: no more disabled "Coming Soon" buttons.

**Sprint 3 (Minggu 5-6): Feature completeness**
- Tier 3.1, 3.2, 3.3, 3.4, 3.6, 3.9, 3.10
- Goal: semua half-built features finished.

**Sprint 4 (Minggu 7-8): Commercial polish**
- Tier 4.1, 4.2, 4.3, 4.5, 4.7, 4.11, 4.14
- Goal: "feels like a commercial app."

**Sprint 5+ (Minggu 9+): Differentiation**
- Tier 5.1 (Seasonal Rank — biggest differentiator)
- Tier 5.2, 5.3, 5.4, 5.5, 5.6
- Goal: features users tell their friends about.

---

## 9. DETAIL EKSEKUSI FASE B–E

### 9.1 Phase B — DONE ✅ (referensi history)

**Step 6a:** Power Signature data-driven extension. `attributeService.ts` extended dengan optional args + storage fallbacks:
```typescript
calculateAttributes(profile, workouts, userState?, habits?, gymSchedule?)
```

Signal additif per stat (caps tetap 100):
- **STR:** bodyweight-relative max compound load + heavy-program specialization (≥3 workout sample guard)
- **VIT:** healthy BMI baseline (18.5–25) + 7-day habit completion ≥80%
- **AGI:** cardio frequency >1×/wk over 4w (new CARDIO_KEYWORDS bag) + mild low-BMI factor
- **PER:** habit completion rate × 30 + schedule adherence (max +5 over 14d)
- **INT:** distinct muscles last 8 workouts (variance proxy) + push/pull/legs balance >25% per category

**Step 6b:** FatigueReport extended dengan 3 new fields:
```typescript
recoveringCount: number;    // muscles with fatigue > 5
totalMuscles: number;
recoveringPercent: number;
```
StatusCard collapsed gain sub-line "X of Y muscles recovering · Z%". Expanded gain Top-3 Recovering mini-list.

### 9.2 Phase C — Bundle code-splitting (READY TO EXECUTE)

**Step 7:** Lazy-load heavy routes via `React.lazy` + `Suspense`:

```typescript
import { lazy, Suspense } from 'react';
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const CalculatorSuite = lazy(() => import('./pages/CalculatorSuite'));

<Suspense fallback={<RouteLoadingSpinner />}>
  <Routes>
    <Route path="/admin" element={<AdminDashboard />} />
    <Route path="/calculator" element={<CalculatorSuite />} />
  </Routes>
</Suspense>
```

Plus: extract `PowerSignatureRadar` jadi terpisah → `React.lazy` di StatusCard expanded view. Recharts cuma loaded saat user expand StatusCard.

Target: initial JS bundle drops 1,711 KB → ~1,000-1,300 KB.

**JANGAN lazy-load:**
- Dashboard (first-paint route)
- lucide-react (tree-shaking sudah handle)
- Firebase (auth check critical path)

### 9.3 Phase D — i18n (BLOCKED, design dulu)

Pertanyaan yang harus dijawab sebelum implementasi:
1. **Target locales.** EN + ID? Extensible untuk locale lain?
2. **Default locale.** ID (user base Indonesia)? Or EN sebagai "neutral" fallback?
3. **Toggle UX.** Live switcher di Settings? Atau onboarding pick-once?
4. **String coverage.** All UI dari hari pertama, atau progressive (high-traffic dulu)?
5. **AI persona language.** System reply mengikuti UI locale atau stay ID?
6. **Date/number formatting.** `Intl.DateTimeFormat` per locale, atau ISO/Latin fixed?

**Likely architecture (saat unblocked):**
- Library: `react-i18next`
- Files: `locales/en.json`, `locales/id.json`, namespaced per surface
- Hook: `const { t } = useTranslation('dashboard'); t('greeting.morning')`
- Persistence: `userState.locale`

**Realistic effort:** Infra 2-3 jam, string extraction 6-8 jam (~200-400 strings), translation review 4-6 jam per locale.

### 9.4 Phase E — Seasonal Rank (BLOCKED, design conversation dulu)

Ini fitur PALING BESAR di list. ML/HoK/PUBG/FF semua PvP — rank dari menang lawan player lain. OurLife gak punya PvP. Input rank harus dari mana?

**7 keputusan yang harus dijawab:**

1. **Rank input source.** Workouts per week / streak length / weekly XP / composite score / PR. Pilih satu — itu shapes user behavior.
2. **Tier structure.** ML pakai Warrior → Mythic dengan division I-V (30 sub-ranks). Untuk fitness mungkin terlalu banyak. Alternatif: 5 tiers × 3 divisions, atau 7 tiers tanpa division, atau extend existing hunter rank (E → S).
3. **Season length.** 1/2/3 bulan.
4. **Reset behavior.** Hard reset / soft (drop 2 tier) / decay (turun kalau idle).
5. **Season rewards.** Cosmetic badges / XP / tokens / title unlock.
6. **Coexistence with hunter rank.** Parallel (lifetime + seasonal) atau replace (hunter rank jadi seasonal).
7. **Visibility.** Global leaderboard / region-locked / friend-only.

**Effort once designed:** 3-4 hari.

---

## 10. POLA KERJA PER FITUR

Tidak ada eksekusi paralel multi-fitur. Setiap sesi follow pattern ini:

### 10.1 Anatomy sesi kerja

**Langkah 1 — Klarifikasi scope.** Saya kasih satu fitur target. Kalau ambigu, lo tanya 1–3 pertanyaan klarifikasi pakai `AskUserQuestion` atau list format.

**Langkah 2 — Audit kode aktual.** Sebelum edit:
- Baca file-file affected (komponen, service, types)
- Lihat existing pattern serupa
- Cek Section 8 untuk konteks prioritas
- Cek Section 9 untuk spec spesifik kalau ada

**Langkah 3 — Surface deviasi.** Kalau spec saya off vs realitas kode, surface itu sebelum eksekusi.

**Langkah 4 — Implementasi.** Production-ready:
- TypeScript strict (no `any` tanpa justifikasi)
- Mobile responsive (test sm/md/lg breakpoints)
- Dark theme tokens konsisten
- Edge cases ter-handle (brand-new user, missing data, error path)
- Build green

**Langkah 5 — Verifikasi.** `npm run build`. Report bundle delta.

**Langkah 6 — Commit dengan message berbobot.** Format:
```
<type>(<scope>): <subject>

<paragraph konteks kenapa fitur ini diperlukan>

<file changes — apa yang berubah, kenapa>

<edge cases yang di-handle>

<follow-ups / known limitations>

Pause for review before <next thing>.
```

Co-author tag (`Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`) kalau lo memang Claude Code.

**Langkah 7 — PAUSE.** Report:
- Commit hash + subject
- Build status + bundle delta
- Files changed
- Manual verification steps
- Adjacent follow-ups ditemukan (flag, bukan eksekusi)

Tunggu konfirmasi saya sebelum lanjut.

### 10.2 Format permintaan saya

```
Fitur: [nama]
Konteks: [tier mana di Section 8, kenapa sekarang]
Scope: [file/komponen/service affected — kalau tahu]
Acceptance: [apa artinya "selesai"]
Constraints: [batasan spesifik]
```

Kalau permintaan saya kurang detail, lo audit dulu lalu propose interpretation sebelum eksekusi.

---

## 11. ATURAN INTERAKSI

1. **Setiap commit = pause point.** Tidak ada "lanjut Phase berikutnya otomatis."
2. **Tidak menyentuh file di luar scope.** Even tempting fixes belong in their own step. Flag follow-up, jangan eksekusi.
3. **Audit dulu, eksekusi kemudian.** Saya appreciate audit yang menemukan deviasi daripada kerja yang nabrak realitas kode.
4. **Trade-off teknis selalu disurface.** Pros/cons, rekomendasi lo, saya yang putusin.
5. **Tidak ada over-engineering.** YAGNI berlaku. Minimal solution > "bisa scale" solution kalau gak ada kebutuhan konkret.
6. **Tidak ada testing infrastructure tanpa diskusi.** OurLife belum punya test infra by design — Tier 6.2.
7. **Bahasa kerja:** Bahasa Indonesia sehari-hari, struktur prompt formal. Mixed ID/EN technical terms natural.

---

## 12. FILE MANAGEMENT & CLEANUP

### 12.1 Files yang harus ada di project root (post-cleanup)

| File | Purpose | Status |
|------|---------|--------|
| `PROMPT_CLAUDE_CODE.md` | Master prompt (THIS FILE) | KEEP |
| `CLAUDE.md` | Tiny pointer untuk Claude Code auto-load | KEEP (slim version) |
| `README.md` | Public face di GitHub | KEEP (replaced with OurLife-specific) |
| `package.json`, `vite.config.ts`, `tsconfig.json`, etc. | Build config | KEEP |
| `.env.local` | Secrets (in .gitignore) | KEEP |
| `.gitignore` | Git exclusions | KEEP |

### 12.2 Files yang SUDAH dihapus / harus dihapus

Setelah konsolidasi ini, file berikut redundan dan harus dihapus:

| File | Reason | Cleanup command |
|------|--------|-----------------|
| `CLAUDE_NEXT_PHASES.md` | Content merged ke Section 9 (di file ini) | `del CLAUDE_NEXT_PHASES.md` (CMD) atau `git rm CLAUDE_NEXT_PHASES.md` |
| `COMMERCIAL_ROADMAP.md` | Content merged ke Section 8 (di file ini) | `del COMMERCIAL_ROADMAP.md` atau `git rm COMMERCIAL_ROADMAP.md` |

### 12.3 Cleanup command sequence

Run di terminal di `D:\OurLife\`:

```bash
# Verifikasi files yang mau dihapus memang ada
ls CLAUDE_NEXT_PHASES.md COMMERCIAL_ROADMAP.md

# Hapus via git rm (track deletion as a commit)
git rm CLAUDE_NEXT_PHASES.md COMMERCIAL_ROADMAP.md

# Commit cleanup
git add CLAUDE.md PROMPT_CLAUDE_CODE.md README.md
git commit -m "docs: consolidate project docs into single master prompt

Merged CLAUDE_NEXT_PHASES.md and COMMERCIAL_ROADMAP.md into
PROMPT_CLAUDE_CODE.md as Sections 8 and 9.

CLAUDE.md slimmed to pointer file (Claude Code auto-loads it,
should be minimal context budget burn).

README.md replaced from AI Studio auto-gen to proper public README.

Result: single source of truth (PROMPT_CLAUDE_CODE.md) with
auto-load pointer (CLAUDE.md) and public face (README.md).
Three docs total at project root, no redundancy."
```

### 12.4 Daftar file penting yang TIDAK boleh dihapus

JANGAN hapus apa pun di:
- `node_modules/` (regenerate dengan `npm install`)
- `dist/` (regenerate dengan `npm run build`)
- `public/` (static assets, dipakai aplikasi)
- `src/` (all frontend source: components, pages, services, context, hooks, utils, constants, config, data)
- `src/types.ts`, `src/App.tsx`, `src/index.tsx`, `src/index.css` (frontend source), `index.html` (root), `firebase-config.js` (root)
- `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`
- `.gitignore`, `.env.local`, `firebase.json` (kalau ada)

### 12.5 Future cleanup candidates (low priority)

| Item | Why | When |
|------|-----|------|
| `.claude/` folder | Claude Code session metadata (kalau ke-commit accidentally) | Audit `git log -- .claude/`. Kalau ada commit history, `git rm -r --cached .claude/` |
| Old/unused exercise images di `public/exercises/` | Bloat | Audit pas Tier 5.3 exercise library quality |
| Untracked test files (kalau experiment) | Cleanup hygiene | Run `git status` sebelum commit, hapus yang gak kepake |

### 12.6 Instructions for Claude Code

**Saat Claude Code baca file ini di sesi baru:**

1. Konfirmasi files yang masih ada di project root:
```
ls *.md
```
Harus muncul: `PROMPT_CLAUDE_CODE.md`, `CLAUDE.md`, `README.md`. Kalau `CLAUDE_NEXT_PHASES.md` atau `COMMERCIAL_ROADMAP.md` masih ada, JANGAN baca atau referensi mereka — they're stale. Suggest cleanup sesuai Section 12.3.

2. Konfirmasi `CLAUDE.md` adalah pointer file, bukan duplicate. Kalau CLAUDE.md isinya panjang (>50 baris), itu artinya cleanup belum dijalankan — surface to user.

3. Konteks utama selalu dari file ini (`PROMPT_CLAUDE_CODE.md`). CLAUDE.md just points here.

---

## 13. INSTRUKSI PERTAMA UNTUK CLAUDE

Setelah baca prompt ini:

1. **Konfirmasi dalam 1 paragraf:**
   - Apa yang akan kita kerjakan (OurLife)
   - State saat ini (Phase A + A.5/A.6/A.7 + B done, 19+ commit di feature/dob-system)
   - Stack (React/Vite/TS/Tailwind + Firebase + Groq)
   - Filosofi kerja (satu fitur sampai sempurna, audit-before-edit, pause-after-commit)

2. **Verifikasi file management:**
   - List file `.md` di project root (`ls *.md` di terminal — atau pake Glob tool)
   - Konfirmasi: `PROMPT_CLAUDE_CODE.md`, `CLAUDE.md`, `README.md` masih ada
   - Kalau `CLAUDE_NEXT_PHASES.md` atau `COMMERCIAL_ROADMAP.md` masih ada (cleanup belum dijalankan), surface to user dengan cleanup commands dari Section 12.3

3. **Tanya 2–3 hal yang menurut lo paling penting diklarifikasi** sebelum mulai fitur pertama. Mis. soal prioritas (Tier 0 security dulu?), git workflow (PR atau direct push), atau scope spesifik fitur yang akan dikerjakan.

4. **Tunggu konfirmasi saya** sebelum tulis kode apa pun.

Setelah saya jawab klarifikasi lo, saya akan kirim permintaan fitur dengan format di Section 10.2.

---

## 14. CATATAN AKHIR

OurLife adalah proyek dengan momentum — 19+ commit, foundation solid (gamification, achievements, attributes, fatigue, streak protection are real production logic), aesthetic distinct. Goal kita bukan "build more features" tapi **"ship a commercial-grade product."** Itu artinya:

- **Polish > novelty.** Satu fitur yang kerasa premium > tiga fitur yang kerasa beta.
- **Security > velocity (untuk Tier 0).** Groq API exposure dan Firebase rules harus selesai sebelum push public marketing.
- **Existing pattern > new pattern.** Phase A + B menetapkan banyak konvensi (StatusCard inline expand, jarvis-card style, SystemBot emotion-aware avatar, dll) — extend yang ada, jangan reinvent.
- **Iteratif > big bang.** PR kecil yang shipping > epic PR yang stuck di review 2 minggu.

Saya percaya engineering yang baik adalah engineering yang membuat code base **tetap mudah diubah 6 bulan ke depan**. Kalau lo lihat decision yang mengorbankan itu untuk shortcut sekarang, push back.

Mari mulai. Setelah konfirmasi lo masuk + cleanup verification + 2-3 klarifikasi terjawab, saya kasih fitur target untuk sesi ini.

— Naufal
