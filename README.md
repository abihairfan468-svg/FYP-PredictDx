# PredictDx

**AI Multimodal System for Early Detection and Future Risk Prediction of Chest Diseases**
*Predict disease · save lives*

Final Year Project, Department of Computer Science, Air University Islamabad · Session 2023–2027
Rida Imran (231705) · Abiha Irfan (230897) · Khadija Faisal (230941) · Supervisor Dr Mehdi Hassan

> PredictDx is a decision-support tool. It does not replace a diagnosis by a qualified physician.

---

## Status for the first evaluation

| Module | Name | Status |
| --- | --- | --- |
| 7.1 | Smart Entry Portal | ✅ **Working** – register, e-mail OTP verification, two-step sign-in (e-mail code or authenticator app), role-based access, lockout, password reset, device sessions |
| 7.2 | My Health Portal | ✅ **Working** – doctor finder over 23 real hospitals in Islamabad, Rawalpindi, Lahore and Karachi, **Near me** (nearest first, distance in km, directions), realistic OPD timings, live slot availability, booking with a 10-minute slot hold, sandbox payment, cancel + refund, reschedule |
| 7.3 | Doctor Workspace | ✅ **Working** – live day queue, visit status flow, autosaved vitals & notes, prescriptions with interaction checks, sign & send |
| 7.4 | Smart Diagnosis Center | ✅ **Working** – DenseNet-121 trained on our dataset (94.8 % test accuracy, 1,858 unseen images), rejects images that are not chest X-rays, Normal / Subtle finding / Disease bands, activation heatmap, future-risk estimate from symptoms. See `ai-service/README.md` |
| 7.5 | Reports & Care Records | 🔵 Frontend ready (records list/detail already read live from the API) |
| 7.6 | CareConnect Hub | ✅ **Working** – real-time chat (Socket.IO), typing indicators, read receipts, presence, CareBot, live notifications |
| 7.7 | Health Journey Tracker | 🔵 Frontend ready |
| 7.8 | System Management Center | 🔵 Frontend ready (licence verification, blocking and audit log already live – they power 7.1) |
| 7.9 | Central Health Records | 🔵 Frontend ready |

**Automated tests:** 65 end-to-end + 7 unit tests (backend) and 3 unit tests (mobile app), all passing on PostgreSQL (`npm test`). See [TEST-CASES.md](TEST-CASES.md).

**Presentation script with every login and the complete flow:** [DEMO-SCRIPT.md](DEMO-SCRIPT.md).

---

## Run it (Windows)

Prerequisites: **Node.js 20+** (tested on Node 24). The database is **PostgreSQL 18**: the project ships the official PostgreSQL server (npm package `embedded-postgres`), so there is nothing to install – no Docker, no admin rights. `npm run dev` starts PostgreSQL (port 5433), the API (3000), the website (5173) and the AI service (8000, Python 3.12 + TensorFlow, see `ai-service/README.md`) together. Data is kept in `backend/.pgdata`. Browse the tables with `npm --prefix backend run db:studio`.

**Easiest:** double-click `start-predictdx.bat`. The first run installs everything and creates the demo database; then it opens http://localhost:5173.

Or from a terminal in this folder:

```bash
npm run setup
```

```bash
npm run dev
```

- Web app: http://localhost:5173
- API + interactive docs (Swagger): http://localhost:3000/api/docs
- Mobile app: see [Mobile app (Flutter)](#mobile-app-flutter) below

### Accounts

Every account has its own e-mail and password. They are listed in **[LOGINS.md](LOGINS.md)** (kept out of the app on purpose). The main ones: patient *Ayesha Khan*, doctor *Dr Adeel Rehman* (Shifa International, has today's queue), admin *Sana Ahmed*, a doctor waiting for licence approval and a blocked patient.

Sign-in always asks for a 6-digit code, which is **e-mailed to the account's inbox** (it is never shown on the sign-in screen). Fill in the `SMTP_*` values in `backend/.env` (a Gmail *App password* works) so codes are delivered for real; without SMTP they are only printed in the API terminal. `OTP_DEV_ECHO=true` shows the code on screen for offline testing only.

On presentation day run `npm --prefix backend run today` to move the sample clinic day (Dr Adeel Rehman's four patients) to today, without touching anything else. To restore all the sample data, stop the app and run `npm run reset-demo`. It **refuses to run once real X-rays have been uploaded** (they are training data); to add new hospitals or doctors without deleting anything use `npm --prefix backend run data:sync` instead.

---

## Presentation walk-through (≈10 minutes)

1. **Landing page** (`/`) – *AI-Powered X-ray Analysis…* → **Get Started**.
2. **7.1 Sign-in page** – show the Patient / Doctor / Admin tabs, **Create account** (password-strength rules, doctor PMDC fields), then sign in as the patient → the **two-step code** screen → dashboard.
3. **7.2 My Health Portal** – filter doctors (speciality, city, *available today*, sort) → **Book slot** → pick a day/time → hold → **Pay** (sandbox, 10-minute countdown) → the stat cards and *Upcoming appointments* update, and a live notification arrives.
4. **7.6 CareConnect** – ask CareBot *“When is my next appointment?”* (it answers from the real booking) and *“Can I stop my medicine early?”* (it refuses and forwards to the doctor).
5. Open a second browser (or an incognito window) and sign in as **Dr Adeel Rehman** → **7.3 Doctor Workspace**: the booking you just made is in the queue. **Check in → Call patient in** (the patient gets a live notification), type vitals (autosave), **Add medicine** Rifampicin + Clarithromycin to show the **major interaction warning**, then **Sign & send** → it appears in the patient's *Reports & Care Records* instantly.
6. Chat between the two windows: typing indicator, instant delivery, **Seen** receipts, online dots.
7. **7.4 Diagnosis Center** (doctor) – drop an X-ray → **Run AI analysis** → the pipeline streams step by step → heatmap, boxes, probabilities, risk band → **Generate diagnostic report** (filed into the patient record) and **Send to radiologist**.
8. Sign in as **admin** → **7.8** approve *Dr Usman Qureshi* → he can now sign in; block a user → their open session ends immediately.
9. **Account & Security** – authenticator-app setup with QR code, signed-in devices, security activity.

Tip: `npm --prefix backend run as-doctor -- "Hello from the doctor"` sends a chat message as Dr Adeel Rehman from a terminal if you only have one browser.

---

## Data and storage

- **Hospitals and doctors** – `backend/prisma/data/pakistan.ts` lists 23 real hospitals and clinics in Islamabad, Rawalpindi, Lahore and Karachi (PIMS, Shifa, Maroof, Holy Family, Benazir Bhutto, Mayo, Services, Jinnah, Hameed Latif, AKUH, JPMC, Ojha, Indus and more) with area, address and map coordinates, and the doctors with their OPD days and timings. The doctors are fictional people (we do not publish real doctors' details without their consent); the hospitals, areas and timing patterns are real. Edit the file and run `npm --prefix backend run data:sync` – it adds and updates without deleting any bookings.
- **Chest X-rays** – every uploaded image is stored **inside PostgreSQL** (`StoredFile` table: the bytes, SHA-256, type and uploader) and linked to its study. On each study the doctor confirms the real diagnosis (*Normal / Pneumonia / Tuberculosis / Other*); that is the training label.
- **Training export** – `npm --prefix backend run dataset:export` writes de-identified images into `backend/dataset-export/images/<LABEL>/` plus `labels.csv` (no names, no MRNs), ready for the model notebooks. Add `-- --all` to include studies nobody has confirmed yet.
- **Other files** – doctors' PMDC licence uploads (PDF/JPG/PNG) use the same table; the admin opens them from the verification queue. Every file read is written to the audit log.

---

## Mobile app (Flutter)

`mobile/` is the PredictDx phone app, built with **Flutter** (Dart). It has the same screens and dark navy design as the website and uses the same API:

- sign-in with an e-mail code or authenticator app;
- My Health Portal with **Near me** (the phone's GPS), Google Maps directions, booking and payment;
- live chat with typing indicators and read receipts, plus records;
- the doctor workspace (queue, vitals, notes, prescription);
- the Diagnosis Center (upload from the gallery or the **camera**, live analysis, heatmap);
- the admin console.

The refresh token is kept in the phone's encrypted secure storage.

Flutter is installed at `D:\flutter`. Keep its package cache on D: too, because the C: drive is nearly full. Run these in PowerShell inside `mobile`:

```powershell
$env:PUB_CACHE='D:\flutter_pub_cache'; $env:PATH="D:\flutter\bin;$env:PATH"
flutter pub get
flutter test
flutter build web
node scripts/serve-web.mjs
```

Then open http://localhost:5174. Use the browser's phone view (F12, then the device toolbar). `npm run dev` must be running for the API.

**On your phone:** see **[PHONE-SETUP.md](PHONE-SETUP.md)** – open it in the phone's browser over Wi-Fi today, or install the Android app.

**Android app (APK):**

1. Install Android Studio. It brings the Android SDK, which is not on this laptop yet.
2. Run `flutter build apk --dart-define=API_URL=http://<laptop-IP>:3000`.
3. Install `build/app/outputs/flutter-apk/app-release.apk` on the phone.

The phone and laptop must be on the same Wi-Fi. On the Android emulator, the default address `http://10.0.2.2:3000` already points at the laptop.

---

## Security built in (for the evaluators)

- **Passwords:** Argon2id hashing; policy of 8+ chars with upper, lower, digit and symbol; same error for unknown e-mail and wrong password (no account enumeration, equal timing).
- **Brute force:** 5 wrong passwords → 15-minute lock; per-route rate limits (login 10/min, codes 6/min, global 120/min).
- **Multi-factor:** e-mail OTP (6 digits, 5-minute expiry, 5 attempts, single use, stored only as a peppered hash) or TOTP authenticator app; mandatory for doctors and admins.
- **Tokens:** 15-minute JWT access token kept in memory only; refresh token in an **httpOnly, SameSite=Strict cookie**, rotated on every use with **reuse detection** (replaying an old token ends every session).
- **Sessions:** list and revoke devices; password change/reset signs out other devices; blocking a user kills their sessions and sockets at once.
- **Authorisation:** global JWT guard + role guard on every route; care-relationship checks (a doctor only sees patients who booked them; chat only between care partners).
- **Input:** strict DTO validation (unknown fields rejected), upload magic-byte checks, Helmet security headers, CORS allow-list.
- **Audit trail:** every sign-in, booking, payment, prescription and admin action is logged (visible in 7.8).
- **Double booking:** prevented by a UNIQUE database constraint, not just the UI.

---

## Architecture

```
React / Flutter   ──HTTPS + JWT──►  NestJS API  ──►  Prisma ──► PostgreSQL 18
      ▲                                │  ├── Socket.IO gateway (chat, notifications, live updates)
      └──────── WebSocket (JWT) ───────┘  ├── Mail (SMTP or console)
                                          ├── CareBot (rule-based assistant over the patient's own data)
                                          └── Diagnosis (preview model → FastAPI ai-service, next phase)
```

```
predictdx/
├── backend/        NestJS API (TypeScript) – src/<module>, prisma/schema.prisma, test/ (e2e)
├── web/            React web app – src/pages (landing, sign-in), src/modules (7.1–7.9), src/layout
├── mobile/         Flutter phone app – lib/core (API, auth, realtime), lib/screens, lib/ui
├── ai-service/     FastAPI + TensorFlow inference (Grad-CAM, risk) – being trained
├── legacy/         The original PostgreSQL/BullMQ scaffold, kept for reference
└── start-predictdx.bat, package.json (one-command setup / dev / test)
```

### Optional integrations

| Feature | How to enable (`backend/.env`) |
| --- | --- |
| Real e-mail (OTP, confirmations) | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (Gmail: smtp.gmail.com, port 465, App password) and `OTP_DEV_ECHO=false` |
| Another PostgreSQL (installed, Docker, Neon/Supabase) | Set `DATABASE_URL` to it and `USE_EMBEDDED_POSTGRES=false`, then `npm --prefix backend run db:push` and `db:seed` |

---

## Next phase (roadmap)

- **7.4** – replace `previewModel()` in `backend/src/diagnosis/diagnosis.ts` with a call to `ai-service` `/predict` once the DenseNet-121 model is trained; update `backend/ai-training-status.json` from the notebooks; radiologist sign-off and signed diagnostic reports.
- **7.5** – server-side consent grants, version history and access log (UI already built).
- **7.7** – LSTM risk head, adherence logging API, follow-up tracking (UI already built).
- **7.8 / 7.9** – platform metrics, system health probes, full-text search, encrypted object storage for attachments (UI already built).
- Payments – swap the sandbox in `AppointmentsService.pay()` for JazzCash / EasyPaisa / Stripe.
- Mobile – Android release build and Play Store listing (needs the Android SDK), push notifications.
