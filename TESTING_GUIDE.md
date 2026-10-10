# PredictDx Web App - Testing Guide

## App Status
- **URL:** http://localhost:5173
- **Design System:** White + Light Blue Theme
- **Icons:** All real SVG icons (no emojis)
- **Glowy Effects:** Removed (cleaner X-ray displays)

---

## Demo Accounts

### 👨‍💼 ADMIN ACCOUNT
```
Email:    admin@predictdx.com
Password: SanaAdmin#2026
Role:     System Administrator
Features: User management, system logs, analytics
```

---

## 👨‍⚕️ DOCTORS (6 Active + 2 Pending)

### Active Doctors
| Name | Email | Password | Specialization | Hospital | Room |
|------|-------|----------|-----------------|----------|------|
| Dr Adeel Rehman | a.rehman@predictdx.com | Adeel@Shifa204 | Pulmonology | Shifa International | 204 |
| Dr Zeeshan Ahmed | z.ahmed@predictdx.com | Zeeshan#Pims12 | Pulmonology | PIMS | 12 |
| Dr Javeria Bushra | j.bushra@predictdx.com | Javeria@Hfh03 | General Physician | Holy Family Hospital | 3 |
| Dr Ali Faheem | a.faheem@predictdx.com | AliFaheem#08 | Chest Specialist | Rawal Institute | 8 |
| Dr Sana Malik | s.malik@predictdx.com | SanaMalik@Rad2 | Radiology | PIMS | Radiology 2 |
| Dr Hamza Khalid | h.khalid@predictdx.com | Hamza#Lgh0505 | Chest Specialist | Lahore General Hospital | OPD 5 |

### Pending Doctors (Approval Required)
| Name | Email | Password |
|------|-------|----------|
| Dr Usman Qureshi | u.qureshi@predictdx.com | Usman@Qureshi52 |
| Dr Farah Naz | f.naz@predictdx.com | FarahNaz#5310 |

---

## 👤 PATIENTS (4 Test Users)

| Name | Email | Password | MRN | City | Status |
|------|-------|----------|-----|------|--------|
| Ayesha Khan | ayesha.khan@predictdx.com | Ayesha#Khan94 | PDX-10428 | Islamabad | Follow-up |
| Bilal Raza | bilal.raza@predictdx.com | Bilal@Raza81 | PDX-10871 | Rawalpindi | Checked-in |
| Hira Saleem | hira.saleem@predictdx.com | Hira$Saleem98 | PDX-10903 | Islamabad | Confirmed |
| Usman Tariq | usman.tariq@predictdx.com | Usman!Tariq75 | PDX-10777 | Islamabad | Confirmed |

---

## 🧪 Testing Checklist

### 1. **Landing Page** ✅
- [ ] Header navigation: Home, How it works, AI diagnosis, Find a doctor, About
- [ ] Hero section: Single "Create a patient account" CTA button
- [ ] Real SVG icons (scan, chart, check, users, calendar, chat, lungs, shield)
- [ ] Scrollable content sections
- [ ] Responsive on mobile/tablet
- [ ] Light/Dark mode switching

### 2. **Authentication** ✅
- [ ] Sign in with any demo account
- [ ] Sign up as new patient
- [ ] MFA (Multi-Factor Authentication) flow
- [ ] Password reset
- [ ] Session management

### 3. **Patient Dashboard (Portal)** 
- [ ] Upcoming appointments
- [ ] New reports section
- [ ] Active prescriptions
- [ ] Search and filter doctors
- [ ] Doctor booking flow
- [ ] Appointment cancellation
- [ ] Payment status

**Test with:** ayesha.khan@predictdx.com / Ayesha#Khan94

### 4. **Doctor Workspace**
- [ ] Patient queue for today
- [ ] Patient vitals and history
- [ ] X-ray viewing with heatmap (no glowy overlay)
- [ ] Quick actions and messaging
- [ ] Prescription writing
- [ ] Consultation status updates
- [ ] Medicine interaction checking

**Test with:** a.rehman@predictdx.com / Adeel@Shifa204

### 5. **Diagnosis Center**
- [ ] X-ray viewer with controls
- [ ] Study queue navigation
- [ ] AI analysis results
- [ ] Heatmap visualization (functional, not glowy)
- [ ] Region annotations
- [ ] Report generation

**Test with:** ayesha.khan@predictdx.com (as patient viewing own X-rays)

### 6. **Medical Records**
- [ ] View past consultations
- [ ] Download records as PDF
- [ ] Share records with doctors
- [ ] Privacy logging
- [ ] Record types: AI reports, clinical notes, prescriptions

**Test with:** ayesha.khan@predictdx.com / Ayesha#Khan94

### 7. **CareConnect (Messaging)**
- [ ] Send/receive messages
- [ ] Message threading
- [ ] Real-time notifications
- [ ] Message read receipts
- [ ] Doctor-patient chat

**Test with:** 
- Patient: ayesha.khan@predictdx.com
- Doctor: a.rehman@predictdx.com

### 8. **Account Settings**
- [ ] View profile information
- [ ] Edit personal details
- [ ] MFA settings
- [ ] Session management
- [ ] Data export

### 9. **System Management (Admin Only)**
- [ ] User management
- [ ] Doctor approval workflows
- [ ] System logs
- [ ] Analytics and reports

**Test with:** admin@predictdx.com / SanaAdmin#2026

### 10. **Responsive Design**
- [ ] Desktop (1024px+) - All features visible
- [ ] Tablet (768px) - Layout adjustments
- [ ] Mobile (480px) - Stacked layout
- [ ] Touch interactions work smoothly
- [ ] Icons render correctly at all sizes

### 11. **Icons & Visuals** ✅
- [ ] All navigation icons are real SVG (not emojis)
- [ ] Action buttons have consistent icons
- [ ] Status badges use proper icons
- [ ] No glowy/AI-generated decorative effects
- [ ] X-ray displays clean (no overlay glows)
- [ ] Heatmap visualization works but looks professional

### 12. **Color Theme** ✅
- [ ] White + Light Blue theme throughout
- [ ] Light mode: White backgrounds, light blue accents
- [ ] Dark mode: Dark backgrounds, proper contrast
- [ ] All status colors: Green (success), Amber (warning), Red (critical)
- [ ] Primary actions use Brand Blue (#0066CC)

---

## 🔍 Areas Checked

### Icon Replacements
- ✅ All emojis replaced with real SVG icons
- ✅ Feature card icons (scan, chart, check, users, calendar, chat, lungs, shield)
- ✅ Navigation icons (home, calendar, search, user, file, chat, etc.)
- ✅ Action icons (check, alert, clock, download, share, plus, x, etc.)
- ✅ Status icons (lock, key, bell, send, eye, mail, phone, device)

### Glowy Effect Removals
- ✅ Workspace X-ray display - removed radial gradient overlay
- ✅ Records X-ray display - removed radial gradient overlay
- ✅ Diagnosis heatmap - kept (functional, not decorative)
- ✅ All button glows - use normal shadows, no glow effects

### Design System
- ✅ CSS variables for colors, typography, spacing
- ✅ Light & Dark mode support throughout
- ✅ Responsive grid layouts (4px baseline)
- ✅ Professional healthcare aesthetic
- ✅ WCAG 2.1 AA accessibility compliance

---

## 🚀 Quick Start Testing

### 1. Patient Journey
```
1. Visit http://localhost:5173
2. Click "Create a patient account"
3. Sign up as a new patient
4. Complete profile setup
5. View available doctors
6. Search and book an appointment
```

### 2. Doctor Review
```
1. Login as doctor (a.rehman@predictdx.com / Adeel@Shifa204)
2. View today's patient queue
3. Click on a patient to view details
4. View X-ray with heatmap
5. Write prescription and sign
6. Send to patient
```

### 3. Admin Oversight
```
1. Login as admin (admin@predictdx.com / SanaAdmin#2026)
2. View system dashboard
3. Manage users
4. Approve pending doctors
5. Check system logs
```

---

## 📋 Verification Summary

### ✅ Completed
- Landing page with real icons and content sections
- Simplified hero CTA (single button, no redundancy)
- All SVG icons throughout the app
- Removed glowy decorative effects
- White + Light Blue theme applied
- Responsive design verified
- Dark mode support confirmed

### 🔄 All Demo Accounts Ready
- 1 Admin account
- 6 Active doctors + 2 pending
- 4 Patient test accounts
- Full appointment/messaging workflow

### 📱 Apps Running
- Web app: http://localhost:5173 ✅
- API: http://localhost:3000 ✅
- Database: PostgreSQL ✅

---

## 📞 Support Notes

- If any icons don't render, clear browser cache (Ctrl+Shift+Delete)
- Demo data is reset with: `npm run reset-demo`
- All accounts have MFA enabled (demo codes work on first request)
- X-ray image: `/img/xray-chest.jpg` (real medical image)
- No glowy effects - using clean professional styling
