# Refactor Struktur Folder — Roadmap (DIKERJAKAN DULU, sebelum lanjut UI)

> Status: AKTIF — keputusan user: refactor struktur DULU, di atas tree yang masih bersih, baru lanjut auth/ui/onboarding. Refactor ini paling berisiko di seluruh proyek (satu import kelewat → build merah), jadi dikerjakan saat working tree bersih (Habits sudah committed sebagai 3f80c5e). Dua fase, commit terpisah. Patuhi `CLAUDE.md`: audit before edit, build green sebelum commit, pause after commit.
>
> ⚠️ **PENTING — auth Section 1 & 2 ada perubahan uncommitted di working tree.** CC tadi sudah edit `index.css` + `components/Login.tsx` (checkbox + tombol Google) tapi BELUM commit. Sebelum mulai refactor, putuskan: commit dulu auth itu (`fix(auth): …`) ATAU stash. JANGAN mulai `git mv` di atas working tree yang ada perubahan uncommitted — nanti nyampur & susah di-rollback. Rekomendasi: commit auth dulu (kamu tes browser → acc), baru refactor.
>
> 📌 **Setelah Fase 2 selesai, path di `prompts/ui-flow-polish.md` berubah** (`components/…` → `src/components/…`). Update md itu sebelum lanjut onboarding.

## Temuan audit (29 Mei 2026)

- **Frontend & backend SUDAH terpisah secara logis**, cuma nggak keliatan: `functions/` = backend (Firebase Cloud Functions, punya `package.json` + `node_modules` sendiri). Sisanya frontend, tapi berserakan di root nyampur file config.
- **Nggak ada `src/`**: `components/ pages/ services/ context/ hooks/ utils/ constants/ config/ data/` semua di root, sejajar `vite.config.ts`, `tsconfig.json`, `firebase.json`, `index.css`, `index.tsx`, `App.tsx`, `types.ts`.
- **`@/` alias → root** (`vite.config.ts`: `'@': path.resolve(__dirname, '.')` + `tsconfig.json`: `"@/*": ["./*"]`). Pindah ke `src/` HARUS update dua tempat ini bareng.
- **File kemungkinan mati (0 ref — verifikasi dulu):** `services/firebaseConfig.ts`, `services/profileFirestore.ts`.
- **Config Firebase tersebar di 3 tempat:** root `firebase-config.js` (gitignored, ada secret), `config/firebaseConfig.ts`, `services/firebaseConfig.ts`. Bingung mana yang live → konsolidasi.
- **Jejak import typo** pernah muncul di grep history: `usstorageService`, `fireStoreService`, `firstoreService`, `contexts/AuthContext` (folder asli `context/`). Pastikan nggak ada yang masih ke-import (kemungkinan di file mati).

---

## FASE 1 — Bersih-bersih (risiko RENDAH, struktur TETAP)

Tujuan: buang sampah & duplikasi tanpa mindahin apa pun.

1. **Verifikasi & hapus file mati.** Untuk tiap kandidat (`services/firebaseConfig.ts`, `services/profileFirestore.ts`, dan apa pun yang 0-ref), buktikan nol import lewat grep ke seluruh `*.ts/*.tsx` (kecuali node_modules) SEBELUM hapus. Jangan hapus berdasar nama doang.
2. **Konsolidasi config Firebase.** Tentukan satu sumber kebenaran (cek mana yang di-import App/index/context). Hapus/merge dua sisanya. Hati-hati: root `firebase-config.js` gitignored & nyimpen secret — jangan commit secret, jangan hapus tanpa mindahin nilainya ke sumber yang dipilih.
3. **Benerin import typo** kalau masih ada yang live (`contexts/`→`context/`, dst).
4. **Audit `data/` vs `constants/data/` vs `functions/data/` vs `public/data/`** — ada 4 folder `data`. Pastikan nggak ada `exercises.json` kembar yang bikin bingung; satukan kalau perlu (frontend baca dari mana?).
5. Build green → commit `chore(cleanup): remove dead files + consolidate firebase config`. PAUSE.

Acceptance Fase 1:
- [ ] `npm run build` hijau, app jalan sama persis.
- [ ] Tiap file yang dihapus terbukti 0-ref (lampirkan grep di laporan).
- [ ] Cuma SATU config Firebase yang live; secret tetap di file gitignored.

---

## FASE 2 — Migrasi ke `src/` (risiko TINGGI, mekanis)

Tujuan: semua source frontend masuk `src/`, root cuma config + backend folder.

Target struktur:
```
/ (root)
  src/
    components/  pages/  services/  context/  hooks/  utils/
    constants/  config/  data/
    App.tsx  index.tsx  index.css  types.ts  vite-env.d.ts
  functions/            ← backend, JANGAN disentuh
  public/
  index.html
  vite.config.ts  tsconfig.json  package.json  firebase.json  *.rules  dll
  .design-reference/    ← biarkan (referensi, 164K)
```

Langkah (urut, jangan loncat):
1. `git mv` tiap folder/file source ke `src/` (pakai `git mv` biar history kebawa, bukan rm+add).
2. Update `vite.config.ts`: `'@': path.resolve(__dirname, './src')`.
3. Update `tsconfig.json`: `"@/*": ["./src/*"]`.
4. Update `index.html` script src kalau nunjuk `/index.tsx` → `/src/index.tsx`.
5. Cek relative import yang nyebrang (mis. `../../firebase-config` dari komponen) — yang pakai `@/` aman (mayoritas), yang relative manual perlu disesuaikan.
6. `npm run build` + jalanin dev, klik tiap layar (auth, onboarding, dashboard, habits, gym, profile, leaderboard).
7. Commit `refactor(structure): move frontend source into src/`. PAUSE.

Acceptance Fase 2:
- [ ] `npm run build` hijau, no TS error.
- [ ] `@/` alias resolve dari `src/`; semua import jalan.
- [ ] `functions/` (backend) TIDAK tersentuh.
- [ ] Tiap layar dites manual jalan normal.
- [ ] Update path di `CLAUDE.md`, `HANDOFF.md`, `PROMPT_CLAUDE_CODE.md`, dan `prompts/ui-flow-polish.md` (path onboarding/login berubah ke `src/components/...`).

> CATATAN: Fase 2 mengubah hampir semua path di dokumen prompt yang lain. Kalau onboarding (ui-flow-polish Section 6) belum dikerjakan saat Fase 2 jalan, update path-nya dulu di md sebelum kasih ke CC.
