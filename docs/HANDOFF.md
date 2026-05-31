# OurLife — Session Handoff

> **Entry point Cowork + Claude Code tiap chat/sesi baru.** Baca file ini DULU, lalu `CLAUDE.md` (bible lengkap di root). Berisi snapshot keputusan & state terakhir. Dirawat oleh **Cowork** — di-update cuma saat user minta (biasanya sebelum buka chat baru).

**Last updated:** 2026-06-01 — doc reorg (docs/ + docs/prompts/), CLAUDE.md jadi bible tunggal (master prompt lama digabung + dihapus), + UI polish lengkap (habits, auth, onboarding, src/ migration, visual fixes)
**Branch when last touched:** `main`

---

## 1. SISTEM DOKUMEN (struktur baru — 2026-06-01)

- **`CLAUDE.md`** (root) — bible TUNGGAL: identitas, arsitektur, konvensi, roadmap, pola kerja. Auto-load Claude Code. (Dulu master prompt file terpisah — udah digabung ke sini & dihapus.)
- **`docs/HANDOFF.md`** (file ini) — state + keputusan terakhir. Entry point tiap chat baru.
- **`README.md`** (root) — public face GitHub.
- **`docs/prompts/*.md`** — spec/prompt kerja per-fitur (habits-restore, refactor-structure, ui-flow-polish, visual-fixes-batch2).

**Pembagian peran:** dokumen dirawat **Cowork** (bukan Claude Code). CC fokus coding. CLAUDE.md/HANDOFF di-update saat user minta.

**Pola pemakaian:** awal sesi baca HANDOFF → CLAUDE.md. Akhir sesi besar (saat user minta): rangkum entry baru di atas, kronologis newest-first.

---

## 2. SESI TERAKHIR — 2026-05-31 (src/ migration · cleanup · auth · CRLF fix)

> State paling baru. 5 commit landed di `main` (`daa0228` → `37c5cf5`). Struktur folder di Section 7 master prompt sudah diselaraskan ke `src/`.

### Commit sesi ini (kronologis)
| Commit | Isi |
|--------|-----|
| `daa0228` | Auth Section 1+2 — checkbox S&K (`.au-check`/`.au-check-box`) di-style (custom box, state checked/focus/tap, link cyan) + tombol Google full-width + inline SVG logo Google. (User commit manual.) |
| `be58731` | Hapus 4 komponen 0-ref: `AnatomyMap`, `components/CalculatorSuite` (dup dari `pages/CalculatorSuite`), `FatigueGauge`, `SystemPet`. Verified via Node import-resolver + bundle byte-identical. |
| `49e787d` | **src/ migration (Fase 2).** Semua frontend `git mv` ke `src/` (history preserved). `@/`→`./src` (vite + tsconfig). `index.html` → `/src/index.tsx` + `/src/index.css`. 8 import `firebase-config` → `../../firebase-config`. |
| `58c9ebc` | Docs selaras `src/` (README, CLAUDE, HANDOFF, PROMPT, ui-flow-polish) + arch note "kenapa nggak ada folder backend/" + hapus ref file mati. |
| `37c5cf5` | `.gitattributes` (`* text=auto eol=lf`) — nutup akar CRLF noise. |

### Struktur sekarang
- **`src/`** = SEMUA frontend: `components/ pages/ services/ context/ hooks/ utils/ constants/ config/ data/` + `App.tsx index.tsx index.css types.ts vite-env.d.ts`.
- **Root** = `vite.config.ts tsconfig.json package.json index.html`, **`firebase-config.js`** (Firebase SDK init — di-import 8 file via `../../firebase-config`; **JANGAN pindah ke `src/`**), **`functions/`** (backend Cloud Functions, idle), `public/`, `.gitattributes`, `.env.local`.
- Arsitektur = **React + Firebase BaaS** (bukan MERN/PERN). NGGAK ada `backend/`/`database/`. `functions/` = satu-satunya "backend folder", currently idle (Groq dipanggil dari client, deferred ke Tier 6).

### Keputusan kunci
- `@/` alias di-update ke `./src` walau ternyata **0 import** yang pakai (semua relative) — hygiene; build nggak bergantung di situ.
- `firebase-config.js` **sengaja** tetap di root.
- CRLF: `.gitattributes` cukup nutup akar (`core.autocrlf=true` tanpa attributes = sumber noise). Working-tree fisik masih CRLF tapi git clean-filter normalisasi → `git status` clean & deterministik. **NGGAK** paksa konversi LF (kosmetik).
- Commit hygiene: stage **spesifik** (`git add src/ vite.config.ts tsconfig.json index.html`), JANGAN `git add .` (CRLF noise transient + editan `prompts/` harus dipisah). Doc-pass = commit terpisah dari code.
- Dead-file proof: bundle byte-identical pre/post hapus.

### Build
`npm run build` hijau — ~1,775 kB JS (gzip 469) / 144 kB CSS, 2461 modules. Warning >500KB persist (Tier 4.1, bukan blocker).

### NEXT-UP (belum dikerjakan)
- **UI onboarding Section 6** (`docs/prompts/ui-flow-polish.md`): `src/components/Onboarding.tsx` (688 baris) masih pakai Tailwind `slate-*` mentah, belum di-port ke tema. TODO: bikin set class `.ob-*` bertema, ganti SEMUA `slate-*` → token tema (`--cyan`/`--line`/dst). **Keputusan terkunci:** warna tone Step 4 DIPERTAHANKAN (hijau/amber/ungu), logo pakai `ourlife-logo.png`. JANGAN sentuh logika form/step/Firestore. Acceptance: `grep -c "slate-" src/components/Onboarding.tsx` → 0.
- **Sisa ui-flow-polish Section 3-5** (kalau masih relevan): `.mono` util, `.sc-msg-sys` + `.sys-chat-error`, audit `.ah-heart`/`.d-card-last`. (Section 1+2 sudah selesai di `daa0228`.)
- Path di `docs/prompts/ui-flow-polish.md` sudah ke-`src/`.

---

## KEPUTUSAN KRITIS — SESI SEBELUMNYA (Groq deferral · doc consolidation · cleanup)

### 2.1 Groq API migration ke Firebase Function — DEFERRED

**Decision:** Tier 0.1 (Move Groq API ke Firebase Function untuk close client-side key exposure) di-**DEFERRED ke Tier 6** (future multi-user scenario).

**Reasoning:**
- Project saat ini di Firebase Spark (free) plan, gak punya akses ke Cloud Functions.
- Use case saat ini adalah personal-use PWA — bukan public-facing multi-user app.
- Groq free tier punya rate limit yang naturally cap abuse damage kalau key bocor.
- Migration ke Functions butuh upgrade ke Blaze plan (pay-as-you-go) — added cost & complexity yang gak proporsional untuk skala saat ini.

**Trade-off accepted:**
- `VITE_GROQ_API_KEY` bundled ke client bundle.
- `aiService.ts` tetap pakai `dangerouslyAllowBrowser: true`.
- Risk: anyone with DevTools bisa extract key dan use Groq quota.
- Mitigation: Groq free tier limits damage. Repo tetap Private until further decision.

**When to revisit:**
- Saat OurLife mau go public/multi-user.
- Saat upgrade ke Blaze plan untuk reason lain (e.g., FCM Cloud Functions).
- Saat Groq move to paid-only tier.

**Artifact:**
- `functions/src/chatWithSystem.ts` (kalau ditemukan di branch experiment) — kept as deprecated reference for future migration. Jangan dipakai sekarang. Jangan dihapus.
- CLAUDE.md Security Policy section explicitly forbids refactoring back to Cloud Function tanpa explicit user OK.

**Impact on roadmap (CLAUDE.md §8):**
- Tier 0.1 removed from Sprint 1 critical blockers.
- Tier 0 sekarang fokus ke: Firebase rules audit (0.2), role-based admin (0.3), cascade-delete (0.4), avatar sanitation (0.5), confirmation dialogs (0.6).
- Tier 6 gains: Groq API → Firebase Function (saat multi-user scenario tercapai).

### 2.2 Documentation consolidation

**Decision:** 5 separate `.md` files di project root → konsolidasi jadi 4.

**Before (sebelum sesi ini):**
- CLAUDE.md (project rules — verbose)
- CLAUDE_NEXT_PHASES.md (Phase B-E execution detail)
- COMMERCIAL_ROADMAP.md (71-finding strategic roadmap)
- master prompt file (session entry-point prompt)
- README.md (AI Studio auto-gen, tidak relevan)

**After:**
- CLAUDE.md (slim pointer — 30 baris)
- master prompt file (master single source — semua content dari ex-files)
- HANDOFF.md (this file — session snapshot)
- README.md (proper OurLife public-facing README dengan badges, feature list, status)

**Reasoning:** Reduce cognitive load. Single source of truth (master prompt file). Minimal context budget burn for Claude Code auto-load (CLAUDE.md slim).

### 2.3 Cleanup pass eksekusi

**Done in commit `9cf6fd1` on main:**
- Deleted: `CLAUDE_NEXT_PHASES.md`, `COMMERCIAL_ROADMAP.md` (merged ke master)
- Deleted: `npm` (0-byte accidental file)
- Deleted: `clean.mjs` (one-off SVG cleanup script, operation complete)
- Deleted: `ourlife_exercises.json` (1.3MB seed file, confirmed unused via sub-audit — data lives di Firestore `collection('exercises')`)
- `.gitignore` additions: `.claude/`, `*.bak`, `*.orig`, `*~`, `Thumbs.db`
- Net: 30,157 lines deleted (mostly the JSON file), build stayed green.

---

## 3. STATE PROYEK SAAT INI

### 3.1 Git state
- **Branch saat ini:** `main` (cleanup commit landed di sini, bukan di `feature/dob-system`)
- **Latest commit:** `9cf6fd1 chore: cleanup file management — consolidate docs + tighten gitignore + remove orphans`
- **GitHub repo:** `opallama110-alt/OurLife` (Private)
- **Push status:** Kemungkinan belum di-push — verify dengan `git log origin/main..HEAD --oneline`

### 3.2 Branch confusion to resolve

User sebelumnya kerja di branch `feature/dob-system` selama Phase A + B (19+ commit). Sekarang cleanup commit di `main`. Possible scenarios:

**Scenario A:** `feature/dob-system` udah di-merge ke `main` di sesi terdahulu (mungkin via PR di GitHub). `main` punya semua feature commits + cleanup di paling atas. Verify dengan `git log --oneline -25` — kalau ada commit Phase A/B, scenario A confirmed.

**Scenario B:** `feature/dob-system` masih separate. `main` cuma punya pre-Phase-A state + cleanup commit yang loncat sendirian. Ini awkward state. Solution: merge `feature/dob-system` ke `main`:
```bash
git merge feature/dob-system
# Cleanup commit harusnya merge cleanly atau bisa rebased ke atas
git push origin main
git push origin feature/dob-system
```

**Action for next session:** Run `git log --oneline -25` dan kasih tau user kalau Scenario B terdeteksi.

### 3.3 Files di project root (post-cleanup)

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Bible tunggal — auto-load Claude Code (identitas, arsitektur, roadmap, konvensi) |
| `docs/HANDOFF.md` | This file — session state overlay |
| `README.md` | GitHub public face |
| `.env.local` | Secrets (Firebase + Groq API key — in .gitignore) |
| `.gitignore` | Updated dengan pattern lengkap |
| `firebase-config.js`, `firebase.json`, `firestore.rules`, `database.rules.json`, `firestore.indexes.json` | Firebase config |
| `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, `index.html` | Build config |
| `src/` (App.tsx, index.tsx, index.css, types.ts + components/pages/services/context/hooks/utils/constants/config/data) | All frontend source — moved under `src/` in Fase 2 (commit 49e787d); no longer at root |

### 3.4 Build & bundle
- `npm run build` last run: green ✅
- Bundle size: 1,741 kB JS (gzipped 453 kB)
- Bundle warning persists (>500KB) — addressed by Tier 4.1 (Phase C code-splitting), bukan blocker.

---

## 4. ROADMAP UPDATES POST-DEFERRAL

### 4.1 New Tier 0 (Sprint 1 fokus)
Setelah Groq item deferred:

| # | Item | Effort | Status |
|---|------|--------|--------|
| ~~0.1~~ | ~~Move Groq API ke Firebase Function~~ | — | DEFERRED ke Tier 6 |
| 0.2 | Audit + tulis `firestore.rules` + `database.rules.json` | M (3 jam) | TODO |
| 0.3 | Role-based admin (replace hardcoded email check) | M (3 jam) | TODO |
| 0.4 | Cascade-delete account (Storage + subcollections + Auth) | L (5 jam) | TODO |
| 0.5 | Avatar sanitation (server-side re-encode) — atau client-side validation kuat | M (4 jam) | TODO, mungkin scope-reduce (no Functions = no server-side processing) |
| 0.6 | Confirmation dialogs untuk destructive actions | S (2 jam) | TODO |

**Note 0.5:** Avatar sanitation originally proposed pakai Cloud Functions (Sharp untuk re-encode). Tanpa Functions, options-nya:
- Strict client-side validation (file size, dimensions, MIME via Image() load test)
- Reject SVG entirely (only allow JPEG/PNG/WebP)
- Defer ke saat upgrade Blaze

Recommend approach: client-side validation kuat untuk now. Tambahin di handoff "design decision needed" kalau lo mau eksekusi 0.5.

### 4.2 New Tier 1 (after Tier 0)

Quick wins yang tetap valid:
- 1.2 Wire `tired` emotion ke fatigue.score ≥ 70 (5 menit)
- 1.3 Bilingual emotion regex (Bahasa Indonesia + English keyword) (10 menit)
- 1.4 Schedule day-key audit (15 menit)
- 1.5 Resend verification email button (30 menit)
- 1.6 Settings disabled-button group/cleanup (30 menit)
- 1.7 Login: show password toggle (15 menit)
- 1.8 Error toast standardization (3 jam)

### 4.3 Recommended next session priority

**Option A — Tier 0 security pass (3-5 jam sesi):**
- 0.6 Confirmation dialogs (warm-up, ~2 jam)
- 0.2 Firebase rules (~3 jam)
- Goal: Sprint 1 critical security blockers minus deferred Groq item.

**Option B — Tier 1 quick wins batch (1-2 jam sesi):**
- 1.2 + 1.3 + 1.4 + 1.7 di satu sesi (~1-1.5 jam total)
- Goal: Beberapa small wins untuk momentum + validate master prompt + handoff flow works.

**Option C — Tier 4.1 Phase C bundle splitting (1 jam sesi):**
- Lazy-load AdminDashboard + CalculatorSuite + recharts radar
- Goal: Drop initial bundle ke ~1,000-1,300 kB. Pure perf win.

**Gw saran Option B dulu** — kalau master prompt + handoff flow bekerja baik buat fitur sekecil ini, sebelum tackle yang lebih berat di Option A atau C.

---

## 5. KNOWN FOLLOW-UPS / FLAGGED REFACTORS

Identified during cleanup audit. NOT blocker, NOT urgent. Buat eksekusi terpisah saat ada bandwidth.

### 5.1 Folder structure consistency
- `src/index.tsx` — Vite convention biasa `main.tsx`. Rename kalau mau strict alignment, tapi works as-is.
- `src/constants/` folder isi cuma 1 file (`muscleMapping.ts`). Mungkin merge ke `src/config/` (yang juga isi 1 file: `constants.ts`). Two folders dengan 1 file masing-masing = confusing.
- `src/data/` folder isi cuma 1 file (`workoutPackages.ts`). Mungkin pindah ke `src/config/data/` atau langsung ke `src/config/`.
- `src/hooks/` folder isi cuma 1 file (`usePWAInstall.ts`). React convention valid, leave alone.
- `firebase-config.js` **tetap di root** setelah Fase 2 (di-import 8 file via `../../firebase-config`) — keputusan deliberate, JANGAN pindah ke `src/`.

**Reason flag:** Each refactor butuh import-path updates di banyak file. Single commit per refactor. Easy to verify dengan `npm run build` after move.

### 5.2 .remember folder
Folder `.remember/` di root muncul dari tooling lain (mungkin AI Studio atau similar). Punya own `.gitignore` internal, so it's self-managed. Tidak di-track di main repo. Kalau lo gak pakai tool yang generate ini, aman dihapus.

### 5.3 Tier 1.4 schedule day-key audit
**Specific check yang dipending dari Phase B Step 6a:** `gymSchedule` keys diharapkan `'monday'`, `'tuesday'`, dll (lowercase English). Kalau actual data pakai `'senin'`, `'selasa'` (Indonesian), PER schedule adherence signal di `attributeService.ts` silently never fires.

**To verify (5 menit):**
```bash
# Open browser DevTools, paste in console:
JSON.stringify(JSON.parse(localStorage.getItem('ourlife_gym_schedule') || '{}'), null, 2)
```
Atau lewat Firebase Console → RTDB → `users/{uid}/gymSchedule`.

Kalau keys English → safe, do nothing. Kalau Indonesian → patch `attributeService.ts` untuk normalize keys atau handle both.

### 5.4 Public Repo readiness
Repo tetap **Private** sampai keputusan eksplisit go-public. Pre-public checklist:
- [x] No secrets di git history (verified ✅)
- [x] `.gitignore` covers `.env*`, `node_modules/`, `dist/`, `.firebase/` (verified ✅)
- [ ] Firebase security rules audit selesai (Tier 0.2)
- [ ] Role-based admin shipped (Tier 0.3)
- [ ] Account deletion cascade shipped (Tier 0.4)
- [ ] Decision soal Groq exposure trade-off — currently personal-use scope, kalau public-facing rethink (revisit Tier 6.x)

---

## 6. VERIFICATION COMMANDS — RUN AT START OF NEW SESSION

```bash
cd D:\OurLife

# 1. Branch + commit state
git branch --show-current
git log --oneline -10
git status

# 2. File management verification (must match HANDOFF §3.3)
ls *.md
# Expected (root): CLAUDE.md, README.md  (HANDOFF.md → docs/, prompt specs → docs/prompts/)

# 3. Stale files check (must be absent)
ls CLAUDE_NEXT_PHASES.md COMMERCIAL_ROADMAP.md npm clean.mjs ourlife_exercises.json 2>&1
# Expected: "cannot access" errors untuk semua

# 4. Build sanity
npm run build 2>&1 | tail -5
# Expected: "✓ built in X.XXs", no new errors

# 5. Secret scan (defensive)
git log --all --oneline -- .env .env.local
# Expected: empty output

# 6. Push status to GitHub
git log origin/main..HEAD --oneline 2>&1
# If output: unpushed commits exist. Suggest user push.
```

---

## 7. CONVENTIONS — TIP UNTUK MODEL BARU

Pesan singkat buat Claude model yang baru (Cowork 4.8 atau apa pun) yang baca file ini:

- **User communication style:** Bahasa Indonesia campur bahasa Inggris (technical terms). User suka mixed natural. Jangan formal-formalan kecuali ditanya.
- **Pace:** User suka iteratif, gak suka over-engineering. YAGNI berlaku. Mulai dari minimal viable, scale kalau benar dibutuhkan.
- **Communication:** Push back kalau request lo rasa salah arah — user appreciate ketegasan teknis lebih dari yes-man behavior. Tapi tetap diplomatis.
- **Code commits:** Atomic. Single feature = single commit. Pause after each commit. Bukan batch.
- **Audit > assume:** Baca file aktual sebelum edit. Spec yang user kasih kadang sedikit off — realita kode sumber kebenaran.
- **Trade-off transparency:** Sebut pros/cons setiap pilihan teknis besar. User mau tahu reasoning, bukan cuma hasil.

User explicitly chose model upgrade ke Cowork 4.8 (kalau ini kasusnya). Apresiasi capability boost, but tetap follow workflow yang udah established di master prompt + handoff ini. Don't reinvent the pattern.

---

## 8. ENTRY POINT — APA YANG GW DO PERTAMA

Setelah baca HANDOFF + CLAUDE.md:

1. Run verification commands di Section 6.
2. Konfirmasi user dengan 1 paragraf:
   - "Halo. Gw udah baca HANDOFF + master prompt. State saat ini: [branch], [last commit]. [Insight kalau ada anomaly]."
3. Tanya 2-3 hal klarifikasi prioritas:
   - "Lo mau lanjut Option A/B/C yang gw saran di HANDOFF §4.3, atau ada prioritas lain?"
   - "Branch scenario A atau B (dari §3.2) — mana yang sesuai sama state lo?"
   - "Ada keputusan baru sejak handoff ini ditulis yang gw harus tahu?"
4. Tunggu user direction. Jangan langsung code.

---

**End of handoff.** Update file ini di akhir sesi besar dengan entry baru di atas Section 2. Sesi-sesi kecil cukup di commit message.
