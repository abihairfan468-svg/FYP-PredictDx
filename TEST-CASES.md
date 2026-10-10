# PredictDx – Test cases

Automated end-to-end tests start the real API, create a fresh PostgreSQL database for every run and open real Socket.IO connections.
Run them from the project root with `npm test`. Last run: **63 / 63 end-to-end tests passed**, plus 7 unit tests.

## 7.1 Smart Entry Portal

| ID | Test case | Result |
| --- | --- | --- |
| TC-01 | rejects a weak password with a clear message | ✅ Pass |
| TC-02 | rejects an invalid e-mail and unknown fields (strict validation) | ✅ Pass |
| TC-03 | refuses self-registration as an administrator | ✅ Pass |
| TC-04 | registers a patient and sends a verification code | ✅ Pass |
| TC-05 | refuses a duplicate e-mail | ✅ Pass |
| TC-06 | an unverified account is sent back to verification on login | ✅ Pass |
| TC-07 | a wrong code is rejected and counts attempts; the right code signs in | ✅ Pass |
| TC-08 | a used code cannot be replayed | ✅ Pass |
| TC-09 | correct password -> MFA challenge, not a session | ✅ Pass |
| TC-10 | wrong MFA code is refused, right one issues tokens | ✅ Pass |
| TC-11 | a forged MFA token is refused | ✅ Pass |
| TC-12 | picking the wrong role tab is refused | ✅ Pass |
| TC-13 | unknown e-mail and wrong password give the same message (no account enumeration) | ✅ Pass |
| TC-14 | five wrong passwords lock the account, even for the right password | ✅ Pass |
| TC-15 | a blocked account cannot sign in | ✅ Pass |
| TC-16 | protected routes need a token | ✅ Pass |
| TC-17 | RBAC: a patient cannot reach doctor or admin APIs | ✅ Pass |
| TC-18 | RBAC: a doctor cannot reach admin APIs or book as a patient | ✅ Pass |
| TC-19 | refresh rotates the token; replaying the old one ends every session | ✅ Pass |
| TC-20 | logout revokes the session immediately (access token stops working) | ✅ Pass |
| TC-21 | signed-in devices can be listed and revoked | ✅ Pass |
| TC-22 | forgot-password answers the same for unknown e-mails | ✅ Pass |
| TC-23 | reset with the e-mailed code, then sign in with the new password | ✅ Pass |
| TC-24 | change password needs the current one and signs out other devices | ✅ Pass |
| TC-25 | doctors cannot switch MFA off; patients can | ✅ Pass |
| TC-26 | authenticator app (TOTP): setup, confirm, then required at sign-in | ✅ Pass |
| TC-62 | a doctor uploads the PMDC licence at sign-up; the admin can open it, patients cannot | ✅ Pass |
| TC-27 | doctor registration requires PMDC details | ✅ Pass |
| TC-28 | verified e-mail -> pending approval -> cannot sign in yet | ✅ Pass |
| TC-29 | admin sees the licence, approves it, and the doctor can sign in and be found | ✅ Pass |
| TC-30 | blocking a user ends their live session at once | ✅ Pass |

## 7.2 My Health Portal

| ID | Test case | Result |
| --- | --- | --- |
| TC-31 | lists only verified doctors, with filters and sorting | ✅ Pass |
| TC-60 | near me: distance from the patient, nearest first, with the real hospital and OPD timings | ✅ Pass |
| TC-61 | hospital and clinic directory by city, nearest first | ✅ Pass |
| TC-32 | slot list only offers future, free slots | ✅ Pass |
| TC-33 | hold -> pay -> confirmed, with real-time notifications to both sides | ✅ Pass |
| TC-34 | the same slot cannot be booked twice (race-safe unique constraint) | ✅ Pass |
| TC-35 | rejects a time the doctor does not offer, and invalid payment methods | ✅ Pass |
| TC-36 | a patient cannot pay for, cancel or see someone else's appointment | ✅ Pass |
| TC-37 | cancel refunds a paid visit and frees the slot; reschedule moves it | ✅ Pass |
| TC-38 | portal summary and records only ever show the patient's own data | ✅ Pass |

## 7.3 Doctor Workspace

| ID | Test case | Result |
| --- | --- | --- |
| TC-39 | a paid booking appears in the doctor's queue for that day | ✅ Pass |
| TC-40 | unpaid holds are not shown in the queue | ✅ Pass |
| TC-41 | visit status only moves forward, and the patient is notified live | ✅ Pass |
| TC-42 | consultation note and vitals autosave and merge | ✅ Pass |
| TC-43 | interaction checker flags dangerous combinations and allergies | ✅ Pass |
| TC-44 | sign & send files records, notifies the patient in real time, and locks the prescription | ✅ Pass |
| TC-45 | a doctor cannot open another doctor's patient or appointment | ✅ Pass |
| TC-46 | formulary search | ✅ Pass |

## 7.4 Smart Diagnosis Center (in progress)

| ID | Test case | Result |
| --- | --- | --- |
| TC-55 | rejects files that are not really images (magic-byte check) | ✅ Pass |
| TC-56 | upload -> analyse streams pipeline steps over the socket and stores a preview result | ✅ Pass |
| TC-58 | a doctor files the AI report into the patient record (once) and the patient is notified | ✅ Pass |
| TC-59 | referring a study notifies the radiologists | ✅ Pass |
| TC-63 | X-rays are stored in PostgreSQL; the confirmed diagnosis becomes a training label | ✅ Pass |
| TC-57 | training status is readable by doctors, not by patients | ✅ Pass |

## 7.6 CareConnect Hub

| ID | Test case | Result |
| --- | --- | --- |
| TC-47 | sockets refuse to connect without a valid token | ✅ Pass |
| TC-48 | messaging needs a care relationship | ✅ Pass |
| TC-49 | messages arrive in real time with typing indicators and read receipts | ✅ Pass |
| TC-50 | outsiders cannot read or post in a thread, and empty messages are refused | ✅ Pass |
| TC-51 | offline recipients get a stored notification instead | ✅ Pass |
| TC-52 | CareBot answers from the patient's real data | ✅ Pass |
| TC-53 | CareBot never gives clinical advice - it forwards to the doctor | ✅ Pass |
| TC-54 | emergency phrases get emergency guidance immediately | ✅ Pass |

## Unit tests

| Area | Test case | Result |
| --- | --- | --- |
| Interaction checker | passes a standard ATT regimen with B6 | ✅ Pass |
| Interaction checker | flags QT-prolonging pairs as major and sorts them first | ✅ Pass |
| Interaction checker | flags duplicate drug classes | ✅ Pass |
| Interaction checker | uses patient allergy flags, case-insensitively | ✅ Pass |
| Slot scheduling | skips days the doctor does not work | ✅ Pass |
| Slot scheduling | only returns slots at least 15 minutes ahead, in order | ✅ Pass |
| Slot scheduling | isOffered accepts exact slot times only | ✅ Pass |

## Manual checks in the browser

| Flow | Result |
| --- | --- |
| Landing page (image 2 design); Get Started opens the sign-in page | ✅ Pass |
| Sign-in page (image 1 design): role tabs, sign in, create account, forgot password | ✅ Pass |
| Patient sign-in with the e-mail code (6-box input; paste and fast typing supported) | ✅ Pass |
| Book → hold (10-minute countdown) → pay → dashboard cards and upcoming list update live | ✅ Pass |
| CareBot answers from real data and forwards clinical questions to the doctor | ✅ Pass |
| Doctor ↔ patient chat: instant delivery both ways, typing indicator, Seen receipt, online presence | ✅ Pass |
| Doctor queue shows the patient's new booking; Check in → Call in → vitals autosave | ✅ Pass |
| Prescription: major interaction warning, B6 advisory, Sign & send files the record | ✅ Pass |
| Diagnosis Center: pipeline streams live, preview result, heatmap and box toggles | ✅ Pass |
| Admin: pending licences, users table, audit log; no sideways scrolling at phone width | ✅ Pass |
| Page reload keeps the user signed in (httpOnly refresh cookie) | ✅ Pass |
| Production build of the web app compiles | ✅ Pass |
