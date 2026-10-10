# PredictDx – Presentation Script & Logins

*First evaluation · Working modules: 7.1, 7.2, 7.3, 7.6 · In progress: 7.4 · Frontend ready: 7.5, 7.7, 7.8, 7.9*
*Stack (as in the proposal): React.js web app · NestJS (Node.js/TypeScript) API · PostgreSQL 18 database*

---

## 1. Before the presentation (5 minutes)

1. Open the folder **Documents → FYP → PredictDX**.
2. Double-click **`start-predictdx.bat`**.
   - The first time, it installs everything and creates the database (a few minutes).
   - A terminal window opens and shows three coloured parts: **[db]** PostgreSQL, **[api]** NestJS, **[web]** website.
   - Wait for `[db] PostgreSQL ready…` and `[api] PredictDx API ready…`.
3. The browser opens **http://localhost:5173**. (Swagger API docs, if an examiner asks: **http://localhost:3000/api/docs**)
4. **Make the sample clinic day today:** open a second terminal in the PredictDX folder and run `npm --prefix backend run today`. Dr Adeel Rehman's four patients (Ayesha 4:30 pm, Bilal, Hira, Usman) move to today; nothing else changes and uploaded X-rays are kept.
5. Open a **second browser window in Incognito / Private mode** (Ctrl + Shift + N in Chrome/Edge). Use the normal window for the **patient** and the incognito window for the **doctor**, so you can show both sides live at the same time.

> Keep the terminal window open during the whole presentation. Closing it stops the website.

---

## 2. Login accounts

**Each account has its own password — all of them are in [LOGINS.md](LOGINS.md).** Keep that file open on your phone or printed during the presentation.

| Role | E-mail | Choose this tab | What this account shows |
| --- | --- | --- | --- |
| Patient | `ayesha.khan@predictdx.com` | Patient | Full history, records, a chat with Dr Rehman, appointment today at 4:30 pm |
| Patient | `bilal.raza@predictdx.com` | Patient | Checked-in patient in the doctor's queue |
| Patient | `hira.saleem@predictdx.com` | Patient | Has a *penicillin allergy* (triggers the allergy warning) |
| Patient | `usman.tariq@predictdx.com` | Patient | TB follow-up patient |
| Doctor | `a.rehman@predictdx.com` | Doctor | Dr Adeel Rehman – today's queue, Doctor Workspace, Diagnosis Center |
| Doctor | `z.ahmed@predictdx.com` | Doctor | Dr Zeeshan Ahmed |
| Doctor | `j.bushra@predictdx.com` | Doctor | Dr Javeria Bushra |
| Doctor | `a.faheem@predictdx.com` | Doctor | Dr Ali Faheem |
| Doctor | `s.malik@predictdx.com` | Doctor | Dr Sana Malik (Radiology) |
| Doctor | `h.khalid@predictdx.com` | Doctor | Dr Hamza Khalid (Lahore) |
| Admin | `admin@predictdx.com` | Admin | Sana Ahmed – System Management, Central Records |
| Doctor (not yet approved) | `u.qureshi@predictdx.com` | Doctor | Cannot sign in until the admin approves the licence |
| Doctor (not yet approved) | `f.naz@predictdx.com` | Doctor | Second pending licence |
| Patient (blocked) | `kamran.shah@predictdx.com` | Patient | Shows the "account blocked" message |

**The 6-digit code:** every sign-in asks for a code after the password (two-step verification). The code appears in a small **"Verification code: 123456"** box at the bottom-right of the screen, and is also printed in the terminal. Type it into the six boxes (or paste it). It expires in 5 minutes. To have codes arrive by real e-mail instead (and not on screen), see the README ("Optional integrations").

Type the e-mail and password from the table above. Nothing is pre-filled in the app.

---

## 3. The complete flow (about 12 minutes)

Each step says **what to click** and **what to say**.

### Step 1 – Landing page
- Open **http://localhost:5173**.
- *Say:* "This is PredictDx, an AI multimodal system for early detection and future-risk prediction of chest diseases."
- Scroll down: *Predict disease save lives* cards, *Smart diagnostic center*, *Timeline overview*, *Common conditions*, *Everything in one platform* (the services), *Next steps*, *Contact us*.
- Click **Get Started**.

### Step 2 – Module 7.1 Smart Entry Portal (sign-up, OTP, MFA)
1. Click **Create account**. Show the **Patient / Doctor / Admin** tabs. (Admin is disabled: *"Created by the hospital"*.)
2. Fill in a new patient, e.g. **Name:** `Sara Ahmed` · **E-mail:** `sara.ahmed@predictdx.com` · **Password:** `Sara@2026pdx`.
   - First type a weak password such as `weakpass`, then click **Create patient account** → show the rules turning red/green and *"Passwords do not match"*.
   - Then use `Sara@2026pdx` in both boxes, tick the consent box and click **Create patient account**.
3. The **Verify your e-mail** screen appears. Type a wrong code (e.g. `111111`) → *"That code is not right. 4 attempts left."* Then type the real code from the "Verification code" box → Sara is signed in to **My Health Portal**, with her own patient number (MRN).
4. *Say:* "Passwords are hashed with Argon2id. After 5 wrong passwords the account locks for 15 minutes. Every sign-in needs a second factor, either an e-mail code or an authenticator app, and it's mandatory for doctors and admins."

### Step 3 – Module 7.2 My Health Portal (book & pay)
1. In **Find a chest specialist**, show the filters: speciality chips, city chips, **Available today**, and the **sort** menu (soonest, lowest fee, highest rated). Click **Near me** (allow location) → the list switches to **Nearest first** and every card shows the hospital, area, OPD timings and distance in km. *Say:* "These are real hospitals in Islamabad, Rawalpindi, Lahore and Karachi with their real locations." Then type `adeel` in the search box.
2. Click **Book slot** on **Dr Adeel Rehman**. Show the days and times. *Say:* "These are real free slots from the database. Already-booked times don't appear."
3. Pick a time, type a reason (e.g. *Fever and dry cough*), and click **Hold slot and pay Rs 2,500**.
4. The payment window shows a **10-minute countdown** and an **invoice number**. Choose **JazzCash / EasyPaisa / Card** and click **Confirm and pay**.
   - *Say:* "Payments run through a test gateway for now, so no real money moves. A unique database constraint makes double booking impossible."
5. A live notification pops up (*Appointment confirmed*). The cards update: **Next appointment**, **Outstanding payment Rs 0**, **Upcoming appointments → Confirmed**.
6. Optional: click **Reschedule** → pick another time → **Move my appointment**. Or book a second doctor and click **Cancel** → *"refund issued"*, and it moves to **Past visits · Cancelled · refunded**.

### Step 4 – Module 7.6 CareConnect (patient side + CareBot)
1. In **Upcoming appointments**, click **Message** on Dr Adeel Rehman → CareConnect opens with that conversation.
2. Type: *Assalam o alaikum doctor, I booked for today* → **Send**.
3. Click **CareBot assistant** in the list. Click the suggestion chips:
   - **When is my next appointment?** → answers from Sara's real booking.
   - **Do I have anything to pay?** → "nothing outstanding".
   - **Can I stop my medicine early?** → *"Changing or stopping a medicine needs your doctor…"*, and the question is **forwarded to the doctor** automatically.
4. *Say:* "CareBot only answers admin questions from the patient's own data. It never diagnoses or changes treatment; it forwards clinical questions to the doctor."

### Step 5 – Module 7.3 Doctor Workspace (use the incognito window)
1. In the **incognito** window, open **http://localhost:5173/auth**, choose the **Doctor** tab and sign in as `a.rehman@predictdx.com` (password in LOGINS.md) → enter the code.
2. The **queue** on the left shows **Sara Ahmed** with her time and reason. *Say:* "The booking the patient just paid for appeared here automatically."
3. With Sara selected, click **Check in**, then **Call patient in**.
   - Switch to the **patient window**: a notification *"Dr Adeel Rehman is ready for you – Please go to Room 204"* has arrived.
4. Type the **vitals** (e.g. `130 / 85`, `95%`, `38.4 °C`, `52 kg`) → the chip shows **Auto-saved**. Click the **Notes** tab and type a short note.
5. **Digital prescription → Add medicine:**
   - Add **Rifampicin** and then **Clarithromycin** → a red **MAJOR** interaction warning appears and the button changes to *"Sign despite warning"*. Remove Clarithromycin with the **×**.
   - *(Optional: click **Hira Saleem** in the queue and add **Amoxicillin** → a **penicillin allergy** warning appears, because Hira's record has that allergy. Then click Sara again.)*
   - Add **Amoxicillin** and **Paracetamol** → *"Interaction check passed"*.
6. Fill **Diagnostic test** (e.g. *Chest X-ray PA + CBC*) and a **Follow-up** date.
7. Click **Sign & send to patient** → *"RX-xxxxxx signed — sent to Sara Ahmed and filed in Reports & Care Records"*. Then click **Complete visit** → the queue shows **Done**.
8. Switch to the **patient window** → a *New prescription* notification has arrived. Open **Reports & Records** → the signed prescription with medicines, test, follow-up date and **PMDC signature** is there. Click **Download PDF** to show the printable copy.

### Step 6 – Module 7.6 CareConnect live chat (both windows side by side)
1. Doctor window: **CareConnect** → open **Sara Ahmed** (the forwarded CareBot question is there).
2. Put both windows side by side. When the doctor starts typing, the patient sees **"Dr Adeel Rehman is typing…"**. Send → the message appears **instantly** on the other side.
3. When the patient reads it, the doctor's last message shows **Seen**. The green dot shows who is **online**.
4. *Say:* "This is real-time over an authenticated WebSocket (Socket.IO). If the other person is offline, they get a stored notification instead."

### Step 7 – Module 7.4 Smart Diagnosis Center (in progress)
1. Doctor window → **Diagnosis Center**. Choose the patient, then drag a chest X-ray image (PNG/JPG) onto **Drop a chest X-ray** (or **Browse files**). A sample image is in `PredictDX\web\public\img\xray-chest.jpg`.
2. Click **Run AI analysis** → the 5-step pipeline runs live → heatmap, lesion box, class probabilities, 12-month risk band.
3. Toggle **Heatmap / Lesion boxes / Measurements grid / Invert** and move the **Heat** slider. Click **Accept** or **Dismiss** on a detected region.
4. Click **Generate diagnostic report** → *"Report filed in … records"*; the patient gets a *Report ready* notification and finds it in **Reports & Records**. (Pressing it again is refused: one report per study.)
5. Click **Send to radiologist** → *"Sent to Dr Sana Malik for review"*; she receives a notification.
6. *Say (the app itself doesn't mention this, you do):* "Upload, storage, the analysis pipeline, reports and referrals are finished. The classifier you see is a placeholder while our DenseNet-121 model finishes training on TBX11K and the Kermany pneumonia dataset — that's our in-progress part of 7.4. Below 70% confidence nothing is released without a radiologist."

### Step 8 – Admin: Modules 7.8 / 7.9
1. Sign out of the doctor window (bottom-left icon). Choose the **Admin** tab and sign in as `admin@predictdx.com` (password in LOGINS.md) → code.
2. **System Management:** **Doctor verification queue** shows *Dr Usman Qureshi* and *Dr Farah Naz*.
   - First show that `u.qureshi@predictdx.com` **cannot** sign in (message: *"Your PMDC licence is still being verified"*).
   - Click **Approve** on Dr Usman Qureshi → he can now sign in, and patients can find and book him.
3. **Users** table: filter **Patients / Doctors / Blocked**. Click **Block** on a patient who is signed in somewhere → that person is **signed out immediately**. Click **Unblock** to undo.
4. **Audit log** (live): every sign-in, booking, payment, prescription and admin action is recorded.
5. **Central Records** (7.9): search `sara` → her prescription and consultation summary are found.
6. Try opening **http://localhost:5173/app/portal** as admin → *"You don't have access to this page"*. *Say:* "Role-based access: the server refuses these requests too, not just the screen."

### Step 9 – Account & Security (7.1)
- Any account → **Account & Security**: edit profile, change password (signs out other devices), **Two-step sign-in** settings, **Authenticator app → Set up** (shows a QR code for Google/Microsoft Authenticator), **Signed-in devices** with **Revoke**, and **Security activity**.

### Step 10 – Remaining pages (1 minute)
- **Health Journey (7.7):** risk trend chart (hover the points, switch 6 months / 12 months / All time), timeline filters, **Log dose**.
- *(Architecture and data-flow diagrams are not inside the app — show them from your slides: `PredictDX CANVA MOCKUP.pdf` and the `predictdx-design.zip` flow images.)*
- **Theme button** (sun/moon, top-right): light and dark versions.

### Step 11 – Show the tests (optional, 1 minute)
- In a terminal in the PredictDX folder run **`npm test`**: 7 unit tests plus **63 end-to-end tests** run against a fresh PostgreSQL database and pass. The list of all test cases is in **TEST-CASES.md**.

### Step 12 – The mobile app (2 minutes)
1. Before the presentation, build and start it once (PowerShell, inside `PredictDX\mobile`):
   `$env:PUB_CACHE='D:\flutter_pub_cache'; $env:PATH="D:\flutter\bin;$env:PATH"; flutter build web; node scripts/serve-web.mjs`
2. **Best: show it on your own phone** – follow **PHONE-SETUP.md** (same Wi-Fi, open `http://<laptop-IP>:5174` in the phone's Chrome). Or, on the laptop, open **http://localhost:5174** in Chrome, press **F12**, then click the phone icon (device toolbar) and choose a phone such as *Pixel 7*. Reload the page.
3. The cover with the lungs appears: **PREDICT DISEASE SAVE LIVES** → **I already have an account · Sign in** → sign in as `ayesha.khan@predictdx.com` → enter the code.
4. Show the bottom tabs **Home / Records / Chat / Account**. On Home tap **Near me** (allow location) → doctors are sorted **nearest first** with the distance in km. Tap **Book** → the sheet shows the hospital address, OPD timings and **Directions** (opens Google Maps).
5. Open **Chat** → Dr Adeel Rehman. Send a message from the phone while the doctor's website is open: it appears there instantly, and the doctor's reply appears on the phone.
6. *Say:* "The phone app is Flutter, as in our proposal. It uses the same API, the same security (two-step sign-in, tokens in the phone's encrypted storage) and the same real-time channel as the website. The doctor and admin sides are in the app too."

---

## 4. If something goes wrong

| Problem | Fix |
| --- | --- |
| Page says it cannot reach the server | The terminal window was closed. Double-click `start-predictdx.bat` again. |
| "Port 5173/3000/5433 already in use" | An old copy is still running. Close all PredictDx terminal windows (or restart the laptop) and start again. |
| The code box disappeared | Look in the terminal for `e-mail to … code …`, or click **Resend code** (after 30 seconds). |
| "Too many failed attempts… locked" | Wait 15 minutes, or run `npm run reset-demo` to restore all demo accounts. |
| Both windows show the same person | Use an **Incognito/Private** window for the second role (normal tabs share one sign-in). |
| Want clean data again | Run `npm run reset-demo` (in the PredictDX folder). |

---

## 5. What to say about the next phase

- **7.4:** plug the trained DenseNet-121/ResNet-50 model (Python FastAPI `ai-service`) into the Diagnosis Center in place of the placeholder classifier, and add the radiologist's review screen.
- **7.5, 7.7, 7.8, 7.9:** the screens are finished; next we connect consent sharing, version history, adherence tracking, platform monitoring and full-text search to the API.
- **Payments:** replace the sandbox with JazzCash / EasyPaisa.
- **Mobile:** the Flutter app already works on the same API. Next: an Android build installed on phones, and push notifications.
- **AI training data:** every uploaded X-ray is stored in PostgreSQL with the doctor's confirmed diagnosis, and `npm --prefix backend run dataset:export` produces a de-identified, labelled dataset for training.
