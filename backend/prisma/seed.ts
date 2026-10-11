/**
 * Demo data for PredictDx. Safe to re-run: it wipes and recreates everything.
 *   npm run db:reset
 * Each account has its own password (prisma/data/accounts.ts, listed for the team in LOGINS.md).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { passwordFor } from './data/accounts';
import { upsertDemoAccounts } from './data/demo-accounts';
import { DOCTORS as MORE_DOCTORS, FACILITIES, slotsFor } from './data/pakistan';

const prisma = new PrismaClient();

const today = new Date();
const at = (dayOffset: number, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset, h, m);
};

const DOCTORS = [
  { name: 'Dr Adeel Rehman', email: 'a.rehman@predictdx.com', spec: 'Pulmonology', pmdc: '44192', qual: 'MBBS, FCPS', hosp: 'Shifa International Hospital', city: 'Islamabad', fee: 2500, rating: 4.9, reviews: 312, exp: 14, room: 'Room 204', slots: ['09:30', '10:10', '10:50', '11:30', '16:30', '17:10', '17:50', '18:30'], days: '1,2,3,4,5,6' },
  { name: 'Dr Zeeshan Ahmed', email: 'z.ahmed@predictdx.com', spec: 'Pulmonology', pmdc: '51820', qual: 'MBBS, MD', hosp: 'Pakistan Institute of Medical Sciences (PIMS)', city: 'Islamabad', fee: 2000, rating: 4.7, reviews: 180, exp: 9, room: 'Room 12', slots: ['10:00', '10:20', '10:40', '11:00', '11:20', '11:40', '12:00', '12:20', '12:40'], days: '1,2,3,4,5,6' },
  { name: 'Dr Javeria Bushra', email: 'j.bushra@predictdx.com', spec: 'General Physician', pmdc: '47311', qual: 'FCPS', hosp: 'Holy Family Hospital', city: 'Rawalpindi', fee: 1800, rating: 4.8, reviews: 241, exp: 11, room: 'Room 3', slots: ['10:00', '10:20', '10:40', '11:00', '11:20', '11:40', '12:00', '12:20', '12:40'], days: '1,2,3,4,5,6' },
  { name: 'Dr Ali Faheem', email: 'a.faheem@predictdx.com', spec: 'Chest Specialist', pmdc: '39604', qual: 'MBBS', hosp: 'Rawal Institute of Health Sciences', city: 'Islamabad', fee: 1500, rating: 4.6, reviews: 129, exp: 7, room: 'Room 8', slots: ['17:00', '17:20', '17:40', '18:00', '18:20', '18:40', '19:00', '19:20', '19:40'], days: '1,2,3,4,5,6' },
  { name: 'Dr Sana Malik', email: 's.malik@predictdx.com', spec: 'Radiology', pmdc: '40077', qual: 'FCPS', hosp: 'Pakistan Institute of Medical Sciences (PIMS)', city: 'Islamabad', fee: 3000, rating: 4.9, reviews: 96, exp: 12, room: 'Radiology 2', slots: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'], days: '1,2,3,4,5' },
  { name: 'Dr Hamza Khalid', email: 'h.khalid@predictdx.com', spec: 'Chest Specialist', pmdc: '46210', qual: 'MBBS, MCPS', hosp: 'Lahore General Hospital', city: 'Lahore', fee: 1600, rating: 4.5, reviews: 204, exp: 8, room: 'OPD 5', slots: ['15:00', '15:20', '15:40', '16:00', '16:20', '16:40', '17:00', '17:20', '17:40'], days: '1,2,3,4,5,6' },
];

const PENDING = [
  { name: 'Dr Usman Qureshi', email: 'u.qureshi@predictdx.com', spec: 'Pulmonology', pmdc: '52944', qual: 'MBBS, FCPS', hosp: 'Holy Family Hospital', city: 'Rawalpindi', fee: 2200 },
  { name: 'Dr Farah Naz', email: 'f.naz@predictdx.com', spec: 'Chest Specialist', pmdc: '53107', qual: 'MBBS, MCPS', hosp: 'Services Hospital', city: 'Lahore', fee: 1700 },
];

const PATIENTS = [
  { name: 'Ayesha Khan', email: 'ayesha.khan@predictdx.com', mrn: 'PDX-10428', dob: '1994-03-12', gender: 'FEMALE', city: 'Islamabad', flags: 'Smoker,TB contact',
    vitals: { bp: '128 / 84', spo2: '94%', temp: '38.1 °C', weight: '58 kg' }, reason: 'Follow-up', time: '16:30', status: 'CONFIRMED',
    note: 'Three weeks of productive cough with evening fever and 3 kg weight loss. Household TB contact confirmed. AI flags a right upper lobe opacity, consistent with auscultation.' },
  { name: 'Bilal Raza', email: 'bilal.raza@predictdx.com', mrn: 'PDX-10871', dob: '1981-07-02', gender: 'MALE', city: 'Rawalpindi', flags: 'Ex-smoker',
    vitals: { bp: '134 / 88', spo2: '97%', temp: '37.2 °C', weight: '74 kg' }, reason: 'New patient', time: '17:10', status: 'CHECKED_IN',
    note: 'Five days of fever with right-sided chest pain. Crackles at the right base.' },
  { name: 'Hira Saleem', email: 'hira.saleem@predictdx.com', mrn: 'PDX-10903', dob: '1998-01-20', gender: 'FEMALE', city: 'Islamabad', flags: 'Penicillin allergy',
    vitals: { bp: '118 / 76', spo2: '98%', temp: '36.8 °C', weight: '54 kg' }, reason: 'Report review', time: '17:50', status: 'CONFIRMED',
    note: 'Routine screening after workplace TB exposure.' },
  { name: 'Usman Tariq', email: 'usman.tariq@predictdx.com', mrn: 'PDX-10777', dob: '1975-11-05', gender: 'MALE', city: 'Islamabad', flags: 'On ATT,Diabetic',
    vitals: { bp: '142 / 90', spo2: '93%', temp: '37.6 °C', weight: '61 kg' }, reason: 'TB follow-up', time: '18:30', status: 'CONFIRMED',
    note: 'Month two of ATT category I. Cough improving, weight stable.' },
];

async function main() {
  // Uploaded X-rays are training data: never wipe them silently.
  const uploaded = await prisma.xrayStudy.count({ where: { NOT: { code: 'PDX-10428-A3' } } });
  if (uploaded > 0 && process.env.WIPE_XRAYS !== 'yes') {
    console.error(`\nStopped: the database holds ${uploaded} uploaded X-ray studies.`);
    console.error('Export them first:   npm --prefix backend run dataset:export');
    console.error('Then reset with:     set WIPE_XRAYS=yes&& npm run reset-demo   (Windows cmd)\n');
    process.exit(1);
  }
  // Wipe in dependency order.
  for (const table of ['message', 'threadMember', 'thread', 'notification', 'record', 'prescription', 'consultation', 'payment', 'appointment', 'xrayStudy', 'storedFile', 'otpCode', 'session', 'auditLog', 'doctor', 'facility', 'patient', 'user'] as const) {
    await (prisma[table] as any).deleteMany();
  }
  const hashes = new Map<string, string>();
  const account = async (email: string) => {
    if (!hashes.has(email)) hashes.set(email, await argon2.hash(passwordFor(email), { type: argon2.argon2id }));
    return { email, passwordHash: hashes.get(email)!, emailVerified: true, mfaEnabled: true };
  };

  const admin = await prisma.user.create({
    data: { ...(await account('admin@predictdx.com')), fullName: 'Sana Ahmed', role: 'ADMIN', phone: '+92 300 5550101' },
  });

  const facilityId: Record<string, string> = {};
  for (const f of FACILITIES) facilityId[f.name] = (await prisma.facility.create({ data: f })).id;

  const doctors: Record<string, { id: string; userId: string }> = {};
  for (const d of DOCTORS) {
    const u = await prisma.user.create({
      data: {
        ...(await account(d.email)),
        fullName: d.name,
        role: 'DOCTOR',
        doctor: {
          create: {
            specialization: d.spec, pmdcNumber: d.pmdc, qualification: d.qual, hospital: d.hosp, city: d.city, fee: d.fee,
            rating: d.rating, reviews: d.reviews, experienceYears: d.exp, room: d.room, verified: true,
            slotTimes: JSON.stringify(d.slots), workDays: d.days, licenceFile: `licence-${d.pmdc}.pdf`,
            facilityId: facilityId[d.hosp],
          },
        },
      },
      include: { doctor: true },
    });
    doctors[d.name] = { id: u.doctor!.id, userId: u.id };
  }
  // Doctors at real hospitals and clinics across Pakistan (fictional people, realistic OPD timings).
  for (const d of MORE_DOCTORS) {
    const f = FACILITIES.find((x) => x.name === d.facility)!;
    await prisma.user.create({
      data: {
        ...(await account(d.email)),
        fullName: d.name,
        role: 'DOCTOR',
        doctor: {
          create: {
            specialization: d.spec, pmdcNumber: d.pmdc, qualification: d.qual, hospital: d.facility, city: f.city, fee: d.fee,
            rating: d.rating, reviews: d.reviews, experienceYears: d.exp, room: d.room, verified: true, bio: d.bio,
            languages: d.languages ?? 'English, Urdu', slotTimes: JSON.stringify(slotsFor(d)), workDays: d.days.join(','),
            licenceFile: `licence-${d.pmdc}.pdf`, facilityId: facilityId[d.facility],
          },
        },
      },
    });
  }
  for (const d of PENDING) {
    await prisma.user.create({
      data: {
        ...(await account(d.email)), fullName: d.name, role: 'DOCTOR', status: 'PENDING',
        doctor: { create: { specialization: d.spec, pmdcNumber: d.pmdc, qualification: d.qual, hospital: d.hosp, city: d.city, fee: d.fee, licenceFile: `licence-${d.pmdc}.pdf`, facilityId: facilityId[d.hosp] } },
      },
    });
  }

  const rehman = doctors['Dr Adeel Rehman'];
  const patients: Record<string, { id: string; userId: string }> = {};
  let n = 0;
  for (const p of PATIENTS) {
    const u = await prisma.user.create({
      data: {
        ...(await account(p.email)), fullName: p.name, role: 'PATIENT', phone: '+92 301 55501' + String(10 + n),
        patient: { create: { mrn: p.mrn, dateOfBirth: new Date(p.dob), gender: p.gender, city: p.city, flags: p.flags } },
      },
      include: { patient: true },
    });
    patients[p.name] = { id: u.patient!.id, userId: u.id };
    // Today's queue for Dr Adeel Rehman.
    const startAt = at(0, p.time);
    await prisma.appointment.create({
      data: {
        patientId: u.patient!.id, doctorId: rehman.id, startAt, status: p.status, reason: p.reason,
        slotKey: `${rehman.id}|${startAt.toISOString()}`,
        payment: { create: { amount: 2500, status: 'PAID', method: 'JAZZCASH', invoiceNo: `INV-${2291 + n}`, txRef: `TXN-${88010 + n}`, paidAt: new Date() } },
        consultation: { create: { doctorId: rehman.id, patientId: u.patient!.id, vitals: JSON.stringify(p.vitals), notes: p.note } },
      },
    });
    n++;
  }
  await prisma.user.create({
    data: { ...(await account('kamran.shah@predictdx.com')), fullName: 'Kamran Shah', role: 'PATIENT', status: 'BLOCKED', patient: { create: { mrn: 'PDX-10999', city: 'Karachi' } } },
  });
  // Extra demo patients and doctors (first.last@predictdx.com; codes appear in the API terminal)
  await upsertDemoAccounts(prisma);

  // Ayesha's history: a completed visit and signed records.
  const ayesha = patients['Ayesha Khan'];
  const past = at(-22, '16:30');
  const pastAppt = await prisma.appointment.create({
    data: {
      patientId: ayesha.id, doctorId: rehman.id, startAt: past, status: 'COMPLETED', reason: 'Cough and fever',
      payment: { create: { amount: 2500, status: 'PAID', method: 'CARD', invoiceNo: 'INV-2101', txRef: 'TXN-87001', paidAt: past } },
      consultation: { create: { doctorId: rehman.id, patientId: ayesha.id, notes: 'Productive cough for 10 days, low-grade evening fever. Sputum smear ordered, chest X-ray requested.', testOrder: 'Sputum smear × 2', vitals: JSON.stringify({ bp: '124 / 80', spo2: '96%', temp: '37.8 °C', weight: '61 kg' }) } },
    },
  });
  await prisma.prescription.create({
    data: {
      code: 'RX-8841', patientId: ayesha.id, doctorId: rehman.id, appointmentId: pastAppt.id, status: 'SIGNED', signedAt: past,
      items: JSON.stringify([
        { name: 'Paracetamol', dose: '500 mg', frequency: 'As needed for fever · max 4 g/day' },
        { name: 'Azithromycin', dose: '500 mg', frequency: 'Once daily · 3 days' },
      ]),
    },
  });
  const rec = (kind: string, title: string, source: string, body: string, daysAgo: number, version = 1) =>
    prisma.record.create({ data: { patientId: ayesha.id, kind, title, source, body, version, createdAt: at(-daysAgo, '12:00') } });
  await rec('AI report', 'AI chest X-ray analysis', 'Smart Diagnosis Center', 'Tuberculosis pattern at 86% confidence (preview model). Right upper lobe opacity with apical cavitation. Confirmed by Dr Sana Malik.', 1, 2);
  await rec('Radiology', 'Radiology report · PA view', 'Dr Sana Malik', 'Heterogeneous opacity in the right upper zone with a 1.8 cm thick-walled cavity. Appearance suspicious for active pulmonary tuberculosis. Clinical correlation and sputum studies advised.', 1);
  await rec('Prescription', 'Prescription · RX-8841', 'Dr Adeel Rehman', '• Paracetamol 500 mg - As needed for fever\n• Azithromycin 500 mg - Once daily · 3 days\nSigned by Dr Adeel Rehman · PMDC 44192', 22);
  await rec('Lab', 'Sputum smear result', 'Excel Labs', 'Ziehl–Neelsen sputum smear × 2. No acid-fast bacilli seen in either sample. Culture pending at 6 weeks.', 20);
  await rec('Note', 'Consultation summary', 'Dr Adeel Rehman', 'Productive cough for 10 days, low-grade evening fever. Sputum smear ordered, chest X-ray requested.', 22, 3);
  await rec('Imaging', 'Chest X-ray · baseline', 'PIMS Radiology', 'Baseline PA chest radiograph within normal limits.', 100);

  // A sample study for the Smart Diagnosis Center preview.
  const src = resolve(__dirname, 'demo-xray.jpg');
  if (existsSync(src)) {
    const data = readFileSync(src);
    const sha256 = createHash('sha256').update(data).digest('hex');
    const file = await prisma.storedFile.create({
      data: { kind: 'XRAY', fileName: 'ayesha-khan-pa.jpg', mimeType: 'image/jpeg', sizeBytes: data.length, sha256, data: new Uint8Array(data), uploadedById: rehman.userId },
    });
    await prisma.xrayStudy.create({
      data: {
        code: 'PDX-10428-A3', patientId: ayesha.id, uploadedById: rehman.userId, fileId: file.id, sha256, originalName: 'ayesha-khan-pa.jpg',
        mimeType: 'image/jpeg', sizeBytes: data.length, view: 'PA', status: 'UPLOADED',
      },
    });
  }

  // CareConnect: an existing conversation between Ayesha and Dr Rehman.
  const thread = await prisma.thread.create({
    data: { kind: 'DIRECT', members: { create: [{ userId: ayesha.userId, lastReadAt: at(-1, '16:00') }, { userId: rehman.userId }] } },
  });
  const msgs: [string, string, string][] = [
    [rehman.userId, 'Assalam o alaikum Ayesha. I have reviewed your new chest film myself.', '16:30'],
    [ayesha.userId, 'Walaikum assalam doctor. I saw a new report in my records - should I be worried?', '16:34'],
    [rehman.userId, 'The AI flagged a possible TB pattern and my own reading agrees. We will discuss treatment at your appointment today.', '16:36'],
  ];
  for (const [senderId, body, t] of msgs) {
    await prisma.message.create({ data: { threadId: thread.id, senderId, body, createdAt: at(-1, t) } });
  }
  await prisma.thread.update({ where: { id: thread.id }, data: { lastMessageAt: at(-1, '16:36') } });

  await prisma.notification.createMany({
    data: [
      { userId: ayesha.userId, type: 'report.ready', title: 'Report ready', body: 'AI chest X-ray analysis · signed by Dr Sana Malik', link: '/app/records', createdAt: at(-1, '12:05') },
      { userId: ayesha.userId, type: 'appointment.reminder', title: 'Appointment reminder', body: 'Today at 4:30 pm with Dr Adeel Rehman', link: '/app/portal' },
      { userId: admin.id, type: 'doctor.pending', title: '2 doctors awaiting verification', body: 'Review PMDC licences in System Management', link: '/app/admin' },
    ],
  });
  await prisma.auditLog.createMany({
    data: [
      { actorId: admin.id, action: 'admin.user_blocked', entity: 'User', detail: 'kamran.shah@predictdx.com', createdAt: at(-1, '20:00') },
      { actorId: rehman.userId, action: 'prescription.signed', entity: 'Prescription', detail: 'RX-8841', createdAt: past },
    ],
  });

  console.log('PredictDx data ready. Sign-in details for every account are in LOGINS.md.');
  console.table([
    { role: 'ADMIN', email: 'admin@predictdx.com' },
    { role: 'DOCTOR', email: 'a.rehman@predictdx.com' },
    { role: 'PATIENT', email: 'ayesha.khan@predictdx.com' },
    { role: 'DOCTOR (pending)', email: 'u.qureshi@predictdx.com' },
    { role: 'PATIENT (blocked)', email: 'kamran.shah@predictdx.com' },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
