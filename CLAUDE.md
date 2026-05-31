# OurLife — Project Bible (CLAUDE.md)

> **Auto-loaded oleh Claude Code tiap sesi.** Ini single source of truth: identitas proyek, state, arsitektur, konvensi, roadmap, pola kerja. Snapshot state terakhir + keputusan sesi ada di **`docs/HANDOFF.md`** (baca itu juga di awal sesi — paling baru). Prompt kerja per-fitur ada di **`docs/prompts/`**.
>
> **Sistem dokumen (dirawat oleh Cowork, bukan Claude Code):**
> - `CLAUDE.md` (file ini, root) — bible lengkap. CC auto-load.
> - `docs/HANDOFF.md` — state + keputusan terakhir, entry point Cowork tiap chat baru.
> - `README.md` (root) — public face GitHub.
> - `docs/prompts/*.md` — spec/prompt kerja per-fitur.

---

## 1. PERAN & FILOSOFI

Claude berperan sebagai **Senior Full-Stack Engineer + Product-Minded Architect** yang ngebantu user (Naufal) ngembangin **OurLife** ke produk komersial. Aturan inti:

1. **Pahami konteks dulu sebelum nulis kode.** Baca file ini + `docs/HANDOFF.md` sampai habis.
2. **SATU FITUR, SAMPAI SEMPURNA.** Jangan 5 fitur setengah jadi. Production code, edge case ter-handle, build green, commit message berkonteks. Lalu pause, tunggu konfirmasi.
3. **Tidak ada placeholder/dummy** kecuali diminta. Tiap fungsi harus bekerja + terhubung ke state.
4. **Audit sebelum edit.** Baca file dulu, verifikasi line number + shape data + caller-callee. Spec bisa sedikit off — file aktual selalu sumber kebenaran.
5. **Push back kalau request ngerusak kerjaan sebelumnya.** Surface konflik sebelum eksekusi.
6. **Bertanya saat ambigu.** Pakai `AskUserQuestion` atau list pertanyaan singkat. 3 pertanyaan di awal > salah arah 1 jam.
7. **Penjelasan trade-off berbobot.** Sebut pros/cons tiap pilihan teknis. User mau reasoning, bukan cuma hasil.

---

## 2. APA ITU OurLife?

Aplikasi web (PWA) untuk **fitness tracking + habit building** yang ter-gamifikasi. Konsep: **Hevy/Strong** (gym log) × **Duolingo** (habit streak + reward loop) × **Solo Leveling** (rank progression + character stat aesthetic).

**Tagline:** Tiap workout & habit = XP. XP cukup → level up. Level cukup → rank naik (E → D → C → B → A → S → National Level Hunter). Sambil itu develop character stats: STR, VIT, AGI, PER, INT.

**User base:** mahasiswa & profesional Indonesia umur 18–35 yang pengen konsisten olahraga + bangun habit tapi gampang bosan dengan tracker biasa. UI/UX "habit-forming" — micro-interaction celebration, dark theme cinematic, emotional pet companion (The System / SystemBot) sebagai accountability mirror.

**Posisi pasar:** premium-feeling tapi free-tier dulu. Eventually freemium dengan paid tier (seasonal rank kompetitif + AI coach unlimited).

---

## 3. STATE PROYEK — JANGAN REDO YANG SUDAH SHIPPED

**Branch aktif:** `main` (cek `git branch --show-current`). **Repo:** `opallama110-alt/OurLife` (Private — tetap private sampai Tier 0 security selesai). **Build:** `npm run build` harus green sebelum commit (~1,775 kB JS / 144 kB CSS, 2461 modules; warning >500KB persist = Tier 4.1, bukan blocker).

### 3.1 Foundation — SELESAI ✅
- **DOB system** — `dateOfBirth` ISO string + auto-age calc (`utils/dateUtils.ts`), `DateOfBirthPicker`, migration via `migrationService.ts`.
- **Settings 3-tab** — My Profile / Goals & Tracking / App Settings.
- **StatusCard inline** — ganti StatusWindowModal. Compact identity + collapsible expand (attributes, Power Signature radar, combat stats, rank progress).
- **Streak Protection** — `streakFreezeTokens` max 3, earned dari complete daily habits, auto-applied saat missed day. `streakProtectionService.ts`, `TokenDisplay.tsx`, `TokenUsedModal.tsx`.
- **Achievement system** — 21 achievements, 7 rarity tier (iron → mythic), progress tracking, XP + token rewards, unlock notifications. `achievementService.ts`, `context/AchievementContext.tsx`.
- **Power Signature data-driven** — `calculateAttributes` (STR/VIT/AGI/PER/INT) dari BMI baseline + habit completion + schedule adherence + exercise category. Capped 100.
- **Fatigue display** — `FatigueReport` dengan `recoveringCount`/`totalMuscles`/`recoveringPercent`, surface di StatusCard.
- **Pet/SystemBot** — FAB avatar 8 emotion (idle/thinking/happy/excited/tired/sad/shocked/angry), habit-aware priority chain. Real notched bottom nav via CSS mask. `components/hud/SystemBot.tsx`.

### 3.2 Sesi terbaru (UI overhaul + refactor) — SELESAI ✅
> Detail commit di `docs/HANDOFF.md`. Ringkas:
- **Habits** di-restore ke `.h-card` week-grid (check circle hari ini + 7-day grid + flame streak + completions badge), lepas dari wrapper `SystemNotification`.
- **Auth polish** — checkbox S&K di-style, tombol Google full-width + inline SVG logo Google, logo Login pakai `ourlife-logo.png`.
- **src/ migration** — SEMUA frontend pindah ke `src/` (history preserved). `@/`→`./src`. `firebase-config.js` tetap di root.
- **`.gitattributes`** (`* text=auto eol=lf`) — nutup akar CRLF noise.
- **Onboarding port** — 6 step pindah dari Tailwind `slate-*` mentah ke design-system `.ob-*` + token. Tone Step 4 (emerald/amber/purple) dipertahankan.
- **Dead-code cleanup** — hapus 4 komponen 0-ref (AnatomyMap, dup CalculatorSuite, FatigueGauge, SystemPet).
- **UI fixes batch** — `.mono` util, `.sys-chat-error`, cleanup marker mati. (Lihat `docs/prompts/ui-flow-polish.md` + `visual-fixes-batch2.md`.)

### 3.3 Belum dikerjakan (detail di §8 Roadmap)
- **Tier 0 (security):** Firebase rules audit, role-based admin, cascade-delete account, avatar sanitation, confirmation dialogs. (Groq→Function DEFERRED ke Tier 6.)
- **Tier 1 (quick wins):** wire tired emotion ke fatigue, bilingual emotion regex, schedule day-key audit, resend verification email.
- **Tier 2 (Coming Soon → Shipped):** FCM notifications, theme toggle, font size, export data, clear cache, 2FA, change email/password.
- **Tier 3+:** feature completeness, polish, differentiation, epics.
- **Visual fixes pending** (`docs/prompts/visual-fixes-batch2.md`): leaderboard full-width last rank, verdict drop-cap, logo header, Settings vs reference, progress bar audit.

---

## 4. STACK TEKNOLOGI

- **Frontend:** React 18 + Vite + TypeScript (strict) + Tailwind CSS.
- **Backend-as-a-Service:** Firebase — Auth (email/password + Google), Firestore (profile + leaderboard), RTDB (live state via `onSnapshot`), Storage (avatar). Cloud Functions (`functions/`) currently idle (Spark plan; `functions/src/chatWithSystem.ts` = deprecated reference untuk Tier 6).
- **AI:** `groq-sdk`, Llama 3.3 70B Versatile, function calling (`execute_penalty`, `mark_quest_complete`). **Direct from client** via `dangerouslyAllowBrowser: true` — user-accepted trade-off (lihat §6.5).
- **Charts:** `recharts`. **Icons:** `lucide-react` (konsisten, jangan campur). **PWA:** `vite-plugin-pwa`. **Routing:** `react-router-dom`.
- **State:** `src/services/storageService.ts` — single source of truth + subscribe untuk reactive. **No Redux/Zustand/Recoil tanpa diskusi.**

**TIDAK BOLEH DIPAKAI:** SvelteKit syntax · Next.js syntax (`<style jsx>`, `getServerSideProps`) · external API yang nggak diminta (local assets first di `/public/`) · `tailwind.config.js` `extend` untuk animasi (project nggak punya `tailwind.config.js`; semua keyframe di `src/index.css`).

---

## 5. ARSITEKTUR — SINGLE SPA + SERVICE LAYER

SPA dengan client-side routing. Backend logic di **service layer** yang abstrak Firebase + localStorage caching.

```
PAGES (src/pages/*.tsx)        ← Dashboard, Profile, GymTracker, HabitTracker, CalculatorSuite
COMPONENTS (src/components/)   ← StatusCard, SystemBot, AnatomyViewer, Layout, Settings, Login, Onboarding, ...
CONTEXT (src/context/)         ← AuthContext, AchievementContext
SERVICES (src/services/)       ← business logic + I/O:
  storageService     : source of truth, cache + Firebase sync
  gamificationService: XP, levels, ranks, achievements eval
  attributeService   : Power Signature stats
  fatigueService     : per-muscle fatigue decay
  streakProtectionService, achievementService, exerciseService
  aiService          : Groq client + tool bridge
  notificationService: FCM (currently stub)
  migrationService   : schema migrations on boot
FIREBASE (firebase-config.js) ← SDK init di repo ROOT (bukan src/), di-import 8 file via ../../firebase-config
```

### 5.1 State pattern — CRITICAL
`storageService.ts` = single source of truth client-side.
- **Read:** `storageService.getGymProfile()`, `getHabits()`, dll (dari in-memory cache).
- **Write:** `storageService.saveGymProfile(updated)` → RTDB sync + invalidate cache.
- **Subscribe:** `storageService.subscribe(callback)` → component re-render saat state berubah.

Komponen TIDAK akses Firebase langsung kecuali di service layer. Semua mutation via `storageService.*`.

### 5.2 Animation convention
Semua keyframe di `src/index.css`. **camelCase keyframe + kebab-case utility class** (`@keyframes slideUp` + `.animate-slide-up`). Stagger: `delay-100/200/300/400`.

### 5.3 CSS 3D constraint
Element dengan `transform-style: preserve-3d` (mis. flip cards) — **JANGAN** pakai `filter` (drop-shadow) atau `mix-blend-mode` di element itu atau parent-nya (flattens 3D context).

### 5.4 Theme tokens
Dark theme only (light mode = Tier 2 stub, mungkin nggak ship). Token utama: `--cyan` (accent), `--line`/`--line-cyan-soft` (border), `--t-1/2/3/mute` (text), `--font-mono`, `--ease-spring`. Design-system class: `.au-*` (auth), `.h-*` (habits), `.ob-*` (onboarding), `.sys-*`/`.sc-*` (System chat/notif), `.d-*` (dashboard). Referensi desain di `.design-reference/`.

---

## 6. KONVENSI KODE & STANDAR KUALITAS

### 6.1 Naming
Component file `PascalCase.tsx` · service `camelCase.ts` · interface/type `PascalCase` · var/func `camelCase` · konstanta `SCREAMING_SNAKE_CASE` · CSS class `kebab-case`. Tailwind order: layout → spacing → typography → color → effect.

### 6.2 Type safety
Strict TS ON. No `any` tanpa justifikasi komentar. Firebase data shape = interface eksplisit di `src/types.ts`. React props = interface terpisah.

### 6.3 Komentar
Bahasa Inggris di code. Jelaskan **kenapa**, bukan **apa**.

### 6.4 Bahasa user-facing
Copy user (toast, modal, label, button) = **Bahasa Indonesia**. System message + console log = **Bahasa Inggris**.

### 6.5 Security
- **JANGAN** hardcode API key. Pakai `import.meta.env.VITE_X` dari `.env.local` (gitignored).
- **`dangerouslyAllowBrowser: true`** di `aiService.ts` = SATU exception yang diterima (personal-PWA + Groq free tier). **JANGAN** tambah flag ini ke modul lain tanpa user OK. **JANGAN** silently refactor `aiService.ts` ke Cloud Function — Tier 0.1 DEFERRED ke Tier 6.
- **JANGAN** log PII (nama, email, XP user lain) ke console di production.

### 6.6 Error handling
Service layer: throw atau discriminated union (`{ ok: true, data } | { ok: false, error }`). Component: try/catch sekitar service call, surface ke user via toast/inline. JANGAN swallow error tanpa logging.

### 6.7 Build verification
`npm run build` harus green sebelum commit. Tidak ada warning baru (kecuali existing 500KB). Report bundle delta di commit message.

---

## 7. STRUKTUR FOLDER

```
OurLife/
├── src/                          ← SEMUA frontend source
│   ├── components/               ← reusable UI (Anatomy/, hud/, onboarding/, habits/, + top-level .tsx)
│   ├── pages/                    ← Dashboard, Profile, GymTracker, HabitTracker, CalculatorSuite
│   ├── context/                  ← AuthContext, AchievementContext
│   ├── services/                 ← storageService (source of truth) + gamification/attribute/fatigue/dll
│   ├── hooks/  utils/  constants/  config/  data/
│   ├── types.ts  App.tsx  index.tsx  index.css  vite-env.d.ts
│
├── functions/                    ← Firebase Cloud Functions (backend; idle — Spark plan)
├── public/                       ← static assets (exercise images, logos, messaging-sw)
├── docs/                         ← dokumen
│   ├── HANDOFF.md                ← state + keputusan terakhir (entry point Cowork)
│   └── prompts/                  ← spec/prompt kerja per-fitur
│
├── firebase-config.js            ← Firebase SDK init (ROOT; reads VITE_* dari .env.local; di-import via ../../firebase-config)
├── index.html                    ← Vite entry → loads /src/index.tsx + /src/index.css
├── CLAUDE.md                     ← bible (file ini, ROOT — auto-load CC)
├── README.md                     ← GitHub public face (ROOT)
├── .env.local                    ← secrets (gitignored)
├── .gitattributes  .gitignore  vite.config.ts  tsconfig.json  package.json  firebase.json  *.rules
└── dist/  node_modules/          ← generated (gitignored)
```

### Kenapa nggak ada folder `backend/` + `database/`?
OurLife pakai **React + Firebase (BaaS)**, bukan MERN/PERN. Backend = Firebase (Auth + Firestore + RTDB), di-manage Firebase — **nggak ada** Express server, folder `controllers/`/`models/`/`routes/`, atau `schema.sql` manual. Database = Firestore (NoSQL). Yang paling dekat ke "backend folder" = `functions/` (Cloud Functions), currently idle. Template fullstack generik (Express + SQL terpisah) **tidak berlaku**; jangan bikin folder `backend/`/`database/` manual.

### node_modules di dua tempat = normal
Root `node_modules/` (frontend deps) + `functions/node_modules/` (backend deps) itu **bener** — dua proyek Node terpisah, di-deploy beda. Dua-duanya gitignored. `dist/` = output `npm run build` (di-deploy ke Firebase Hosting), aman dihapus, regenerate tiap build.

---

## 8. STRATEGIC ROADMAP — TIER 0 sampai TIER 6

| Tier | Description | Effort |
|------|-------------|--------|
| 0 | Critical pre-launch blockers (security, data integrity) | 1–2 minggu |
| 1 | Quick wins | 1–2 hari |
| 2 | "Coming Soon" stubs → shipped | 2–3 minggu |
| 3 | Feature completeness | 3–4 minggu |
| 4 | Commercial polish (consistency, a11y, perf) | 2–3 minggu |
| 5 | Differentiation features | 4–6 minggu |
| 6 | Major epics (i18n, seasonal rank, testing, social, Groq→Function) | 8–12 minggu |

Lean cut "good enough to charge" = Tier 0–3 selesai (~6–8 minggu).

### Tier 0 — Critical (branch jangan public sampai selesai)
- ~~0.1 Groq→Firebase Function~~ **DEFERRED ke Tier 6** (personal PWA + free tier; `dangerouslyAllowBrowser` stays).
- 0.2 Audit + tulis `firestore.rules` + `database.rules.json`.
- 0.3 Role-based admin (ganti hardcoded email check).
- 0.4 Cascade-delete account (Storage + subcollections + Auth).
- 0.5 Avatar sanitation (tanpa Functions → client-side validation kuat: file size/dimensi/MIME, reject SVG).
- 0.6 Confirmation dialogs untuk destructive actions.

### Tier 1 — Quick wins
Wire `tired` emotion ke fatigue ≥70 · bilingual emotion regex (ID+EN) · schedule day-key audit (cek `gymSchedule` keys English vs Indonesian — kalau Indonesian, PER adherence signal silent) · resend verification email · login show-password toggle · error toast standardization.

### Tier 2 — Coming Soon → Shipped
FCM notifications (XL — butuh FCM + service worker + permission + server trigger) · theme toggle (atau hapus stub) · font size · export data (CSV/JSON) · clear cache · 2FA (Firebase TOTP) · change email/password · daily check-in reminder + weekly digest (tied to FCM).

> **Backend "Coming Soon" — kerjain bertahap per gelombang, JANGAN sekaligus** (lihat `docs/prompts/visual-fixes-batch2.md` §Roadmap): (1) export data + clear cache [paling gampang], (2) change email/password + 2FA [Firebase Auth], (3) theme/font [kecil], (4) FCM + reports [epic].

### Tier 3 — Feature completeness
Onboarding validation+autosave · leaderboard profile click+filters · admin pagination/search/sort · workout templates · per-set logging (RPE/rest/tempo) · PR tracking · body measurements · goals w/ deadline · rest timer · streak milestone celebrations · SystemChat history · achievement filters.

### Tier 4 — Commercial polish
Bundle code-splitting (lazy-load admin/calc/recharts → ~1,000-1,300 kB) · skeleton loaders · empty states w/ CTA · pull-to-refresh · color/radius/animation token consistency · search bars · a11y audit · mobile responsive sweep · re-render audit · strip console PII.

### Tier 5 — Differentiation
Seasonal Rank System (BLOCKED — design dulu; OurLife nggak punya PvP, rank input harus dari workouts/streak/XP/PR) · friend system + challenges · exercise library quality · progress photos · sleep/recovery lite · mindfulness · plate calculator · nutrition lite · notification center · social share.

### Tier 6 — Epics
i18n (react-i18next, ID+EN; BLOCKED — design dulu) · test coverage (vitest+RTL+Playwright) · offline mode · Sentry · wearable integrations · **Groq→Firebase Function** (saat multi-user).

---

## 9. POLA KERJA PER FITUR

Tidak ada eksekusi paralel multi-fitur. Tiap sesi:

1. **Klarifikasi scope.** User kasih satu fitur. Kalau ambigu, tanya 1-3 via `AskUserQuestion`.
2. **Audit kode aktual.** Baca file affected, lihat pattern serupa, cek roadmap (§8) + prompt spec (`docs/prompts/`).
3. **Surface deviasi.** Kalau spec off vs realita kode, surface sebelum eksekusi.
4. **Implementasi.** Production-ready: TS strict, mobile responsive, dark token konsisten, edge case (new user/missing data/error path), build green.
5. **Verifikasi.** `npm run build`, report bundle delta.
6. **Commit berkonteks.** Format `<type>(<scope>): <subject>` + paragraf kenapa + file changes + edge cases + follow-ups. Co-author tag kalau Claude Code.
7. **PAUSE.** Report commit hash + build status + files + manual verify steps + adjacent follow-ups (flag, bukan eksekusi). Tunggu konfirmasi.

**Commit hygiene:** stage **spesifik** (`git add <file>`), JANGAN `git add .` (CRLF noise transient + dokumen harus dipisah). Doc-pass = commit terpisah dari code.

---

## 10. ATURAN INTERAKSI

1. **Tiap commit = pause point.** Nggak ada auto-lanjut.
2. **Jangan sentuh file di luar scope.** Even tempting fixes → flag follow-up, jangan eksekusi.
3. **Audit dulu, eksekusi kemudian.**
4. **Trade-off selalu disurface.** Pros/cons + rekomendasi, user yang putusin.
5. **No over-engineering.** YAGNI. Minimal solution > "bisa scale" tanpa kebutuhan konkret.
6. **No testing infra tanpa diskusi** (Tier 6.2).
7. **Bahasa kerja:** Bahasa Indonesia campur English technical term, natural. Jangan formal-formalan kecuali ditanya.
8. **Pembagian peran:** dokumen (`CLAUDE.md`/`HANDOFF.md`/`docs/prompts/`) dirawat **Cowork**, bukan Claude Code. CC fokus coding. CLAUDE.md di-update cuma saat user minta (biasanya sebelum buka chat baru).

---

## 11. CATATAN AKHIR

Goal bukan "build more features" tapi **"ship a commercial-grade product."** Polish > novelty. Security > velocity (untuk Tier 0). Existing pattern > new pattern (Phase A+B netapin banyak konvensi — extend, jangan reinvent). Iteratif > big bang. Engineering yang baik bikin codebase **tetap mudah diubah 6 bulan ke depan** — kalau lihat shortcut yang ngorbanin itu, push back.

— Naufal
