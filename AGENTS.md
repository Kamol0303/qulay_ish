# AGENTS.md

## Cursor Cloud specific instructions

### What this is
`Qulay Ish` — a single-page **React 19 + Vite + TypeScript** job-board web app. The backend is **hosted Firebase** (Firestore + Auth); there is no local server to run. Firebase config is hardcoded with fallbacks in `src/firebase.ts`, so the app talks to the live Firebase project out of the box.

### Run / build / lint (standard scripts in `package.json`)
- Dev server: `npm run dev` → http://localhost:3000 (Vite, binds `0.0.0.0`).
- Build: `npm run build` (Vite/esbuild — does NOT typecheck).
- Preview built app: `npm run preview`.
- Lint/typecheck: `npm run lint` (`tsc --noEmit`).

### Non-obvious caveats
- **`npm run lint` currently fails** with many pre-existing TypeScript errors across `src/`, `functions/`, and `salom/`. This is the repo's existing state, not an environment problem. `npm run build` still succeeds because Vite does not run `tsc`.
- **Standard register/login (`/auth`) does NOT work in this environment.** That flow sends an OTP via Firebase Cloud Functions (`sendOTPSMS` / `sendOTPEmail`), which are not deployed here, so OTP send fails with `FirebaseError: internal` and you cannot complete registration/login.
- **Use the Super Admin login for auth testing:** go to `/super-admin-login`. It uses Firebase Auth email/password directly (no Cloud Functions) and, on first login, creates the account + `super_admin` profile in Firestore. It requires these vars in a local `.env.local` (gitignored, so recreate it as needed):
  ```
  VITE_SUPER_ADMIN_PHONE="+998900707081"
  VITE_SUPER_ADMIN_PASSWORD="Hur_135642"
  VITE_SUPER_ADMIN_EMAIL="superadmin.devsetup@qulayish.uz"
  ```
  Then log in at `/super-admin-login` with the phone `+998900707081` and password `Hur_135642` (credentials also documented in `README.md`). The Firestore rules (`firestore.rules`) allow an authenticated user to create their own profile with any role, so this works client-side. Note: this writes a real account to the live Firebase project.
- **Optional local backend:** set `VITE_USE_EMULATOR=true` (only takes effect on `localhost`) to use the Firebase Emulator Suite (Auth :9099, Firestore :8080). This needs `firebase-tools` (not installed) and Java (installed). Not required for normal frontend dev.
- `functions/` and `salom/` are Firebase Cloud Functions packages (Node 24) and are not needed for frontend dev. `firebase.json` points the functions source at `functions`.
