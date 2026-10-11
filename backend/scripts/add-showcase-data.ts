/**
 * Showcase data for the presentation: 5 more doctors, 8 more patients, and realistic visits
 * (symptoms, vitals, doctor's notes, signed prescriptions, records) plus upcoming bookings for
 * every extra demo patient. Nothing is deleted; running it twice adds nothing new.
 *   npm --prefix backend run showcase:add
 * People are fictional; hospitals are the real facilities from prisma/data/pakistan.ts.
 * Addresses are first.last@predictdx.com (codes in the API terminal); Dr Hina Javed and Nimra Shah
 * use real team inboxes. Passwords follow First@Last26.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { slotsFor } from '../prisma/data/pakistan';
/** Standard addresses; two showcase people use real team inboxes so their codes really arrive. */
const REAL_INBOX: Record<string, string> = { 'dr.hina.javed': 'abihairfan721@gmail.com', 'nimra.shah': '230941@students.au.edu.pk' };
const inbox = (local: string) => REAL_INBOX[local] ?? `${local.replace(/^dr\./, '')}@predictdx.com`;
import { FORMULARY } from '../src/workspace/medicines';

const prisma = new PrismaClient();
const hex = (n: number) => randomBytes(n).toString('hex').toUpperCase();

const NEW_DOCTORS = [
  { name: 'Dr Hina Javed', local: 'dr.hina.javed', password: 'Hina@Javed26', spec: 'Pulmonology', pmdc: '70112-P', qual: 'MBBS, FCPS (Pulmonology)', facility: 'Kulsum International Hospital', fee: 3500, rating: 4.8, reviews: 96, exp: 11, room: 'Chest Clinic 1', days: [1, 3, 5], from: '16:00', to: '19:00', every: 20, bio: 'Pneumonia, asthma and long-COVID breathlessness.' },
  { name: 'Dr Waqar Ahmed', local: 'dr.waqar.ahmed', password: 'Waqar@Ahmed26', spec: 'Chest Specialist', pmdc: '70241-P', qual: 'MBBS, MCPS (Pulmonology)', facility: 'Holy Family Hospital', fee: 1500, rating: 4.6, reviews: 187, exp: 14, room: 'TB Clinic 2', days: [1, 2, 3, 4, 5, 6], from: '09:00', to: '12:00', every: 15, bio: 'Tuberculosis, DOTS follow-up and chronic cough.' },
  { name: 'Dr Sobia Malik', local: 'dr.sobia.malik', password: 'Sobia@Malik26', spec: 'Paediatric Pulmonology', pmdc: '70388-P', qual: 'MBBS, FCPS (Paediatrics)', facility: 'Quaid-e-Azam International Hospital', fee: 3000, rating: 4.9, reviews: 74, exp: 9, room: 'Children OPD 2', days: [2, 4, 6], from: '15:00', to: '18:00', every: 20, bio: 'Childhood pneumonia, wheezing and TB in children.' },
  { name: 'Dr Junaid Aslam', local: 'dr.junaid.aslam', password: 'Junaid@Aslam26', spec: 'Internal Medicine', pmdc: '70415-P', qual: 'MBBS, FCPS (Medicine)', facility: 'Rawal Institute of Health Sciences', fee: 2500, rating: 4.7, reviews: 131, exp: 13, room: 'Medical OPD 4', days: [1, 2, 3, 4, 5], from: '10:00', to: '13:00', every: 20, bio: 'Fever, chest infections, diabetes and COPD.' },
  { name: 'Dr Mehwish Raza', local: 'dr.mehwish.raza', password: 'Mehwish@Raza26', spec: 'Radiology', pmdc: '70526-S', qual: 'MBBS, FCPS (Radiology)', facility: 'Federal Government Polyclinic', fee: 2000, rating: 4.7, reviews: 58, exp: 8, room: 'Radiology Reporting 1', days: [1, 2, 3, 4, 5], from: '11:00', to: '14:00', every: 30, bio: 'Chest X-ray and CT chest reporting.' },
];

const NEW_PATIENTS = [
  { name: 'Nimra Shah', local: 'nimra.shah', mrn: 'PDX-11101', dob: '1994-03-18', gender: 'FEMALE', city: 'Islamabad', phone: '+92 300 5216604', blood: 'A+', flags: '' },
  { name: 'Talha Iqbal', local: 'talha.iqbal', mrn: 'PDX-11102', dob: '1987-07-09', gender: 'MALE', city: 'Rawalpindi', phone: '+92 321 5530218', blood: 'B+', flags: 'Smoker' },
  { name: 'Rukhsana Bibi', local: 'rukhsana.bibi', mrn: 'PDX-11103', dob: '1961-01-27', gender: 'FEMALE', city: 'Rawalpindi', phone: '+92 333 5172290', blood: 'O+', flags: 'Diabetic' },
  { name: 'Hassan Ali', local: 'hassan.ali', mrn: 'PDX-11104', dob: '2017-10-02', gender: 'MALE', city: 'Islamabad', phone: '+92 345 5048871', blood: 'B-', flags: 'Child (guardian account)' },
  { name: 'Sana Yousaf', local: 'sana.yousaf', mrn: 'PDX-11105', dob: '1990-05-21', gender: 'FEMALE', city: 'Islamabad', phone: '+92 312 5367745', blood: 'AB+', flags: 'Asthma' },
  { name: 'Waleed Khan', local: 'waleed.khan', mrn: 'PDX-11106', dob: '1975-12-13', gender: 'MALE', city: 'Rawalpindi', phone: '+92 301 5418863', blood: 'O-', flags: 'TB contact' },
  { name: 'Mahnoor Fatima', local: 'mahnoor.fatima', mrn: 'PDX-11107', dob: '1999-08-30', gender: 'FEMALE', city: 'Islamabad', phone: '+92 322 5299017', blood: 'A-', flags: '' },
  { name: 'Ghulam Abbas', local: 'ghulam.abbas', mrn: 'PDX-11108', dob: '1952-04-04', gender: 'MALE', city: 'Rawalpindi', phone: '+92 302 5643382', blood: 'B+', flags: 'COPD,Ex-smoker' },
];

/** A completed visit: symptoms (reason), vitals, notes, tests and the signed prescription. */
interface Visit { reason: string; notes: string; test?: string; vitals: Record<string, string>; rx: string[]; next?: string }
const V = {
  pneumonia: { reason: 'Fever, productive cough and chest pain for 5 days', notes: 'Fever 38.9 °C, productive cough with yellow sputum, right-sided pleuritic pain. Crackles at the right base. Clinical community-acquired pneumonia, CURB-65 = 0, treat at home.', test: 'Chest X-ray PA, CBC, CRP', vitals: { bp: '118 / 76', spo2: '95%', temp: '38.9 °C', weight: '64 kg' }, rx: ['Co-amoxiclav', 'Azithromycin', 'Paracetamol'], next: 'Follow-up after pneumonia, repeat chest X-ray' },
  tbSuspect: { reason: 'Cough for 3 weeks, night sweats and weight loss', notes: 'Cough for 3 weeks with evening fever, night sweats and 4 kg weight loss. Household contact with a TB patient. Presumptive pulmonary TB: sputum GeneXpert and chest X-ray ordered.', test: 'Sputum GeneXpert MTB/RIF × 1, chest X-ray PA', vitals: { bp: '112 / 72', spo2: '96%', temp: '37.9 °C', weight: '58 kg' }, rx: ['Paracetamol'], next: 'GeneXpert result and chest X-ray review' },
  tbFollowUp: { reason: 'TB treatment review, month 2', notes: 'On first-line ATT (HRZE) since 8 weeks. Cough much better, gained 2 kg, no jaundice or visual complaints. Continue intensive phase, sputum smear at end of month 2.', test: 'Sputum smear, LFTs', vitals: { bp: '120 / 78', spo2: '98%', temp: '36.9 °C', weight: '60 kg' }, rx: ['Isoniazid', 'Rifampicin', 'Pyrazinamide', 'Ethambutol', 'Pyridoxine (B6)'], next: 'End of intensive phase, sputum result' },
  asthma: { reason: 'Wheezing and breathlessness at night', notes: 'Known asthmatic, wheeze and night-time cough for 4 days after a cold. Bilateral expiratory wheeze, no distress. Short course of oral steroid, reliever inhaler technique checked.', vitals: { bp: '116 / 74', spo2: '95%', temp: '37.1 °C', weight: '62 kg' }, rx: ['Salbutamol inhaler', 'Prednisolone'], next: 'Asthma review and inhaler plan' },
  copd: { reason: 'Increased breathlessness and sputum (COPD)', notes: 'COPD exacerbation: more breathless for 1 week, increased purulent sputum. Reduced air entry, scattered wheeze. Antibiotic and steroid course, advised to keep vaccinations up to date.', test: 'Chest X-ray PA, spirometry when stable', vitals: { bp: '136 / 84', spo2: '92%', temp: '37.6 °C', weight: '71 kg' }, rx: ['Salbutamol inhaler', 'Prednisolone', 'Co-amoxiclav'], next: 'COPD follow-up after exacerbation' },
  childPneumonia: { reason: 'Child with fever and fast breathing', notes: 'Fever for 3 days, fast breathing (RR 44), mild chest indrawing, feeding well. Non-severe pneumonia in a child; oral amoxicillin, return immediately if unable to drink or breathing worsens.', test: 'Chest X-ray AP', vitals: { bp: '-', spo2: '95%', temp: '38.6 °C', weight: '21 kg' }, rx: ['Amoxicillin', 'Paracetamol'], next: 'Child pneumonia review' },
  bronchitis: { reason: 'Dry cough and sore throat for 1 week', notes: 'Dry cough and sore throat after a viral illness, chest clear on examination. Acute bronchitis, no antibiotics needed. Fluids, rest and paracetamol; return if fever or breathlessness.', vitals: { bp: '114 / 70', spo2: '98%', temp: '37.4 °C', weight: '55 kg' }, rx: ['Paracetamol'] },
  pleuritic: { reason: 'Sharp chest pain on breathing and fever', notes: 'Left pleuritic chest pain and fever for 2 days, crackles at the left base. Lower lobe pneumonia; penicillin allergy noted so a fluoroquinolone was chosen.', test: 'Chest X-ray PA, CBC', vitals: { bp: '124 / 80', spo2: '94%', temp: '38.4 °C', weight: '78 kg' }, rx: ['Levofloxacin', 'Paracetamol'], next: 'Pneumonia follow-up' },
  smokerCough: { reason: 'Chronic morning cough (smoker)', notes: '20 pack-year smoker with morning cough and mild breathlessness on stairs. No haemoptysis or weight loss. Smoking cessation counselling given, chest X-ray and spirometry ordered.', test: 'Chest X-ray PA, spirometry', vitals: { bp: '132 / 86', spo2: '96%', temp: '36.8 °C', weight: '82 kg' }, rx: ['Salbutamol inhaler'], next: 'Spirometry and X-ray results' },
} satisfies Record<string, Visit>;

/** patient -> [doctor of the completed visit, scenario, days ago, doctor of the next visit (or null)] */
const PLAN: [string, string, keyof typeof V, number, string | null][] = [
  ['Nimra Shah', 'Dr Hina Javed', 'pneumonia', 9, 'Dr Hina Javed'],
  ['Talha Iqbal', 'Dr Junaid Aslam', 'smokerCough', 14, 'Dr Adeel Rehman'],
  ['Rukhsana Bibi', 'Dr Junaid Aslam', 'pneumonia', 20, 'Dr Junaid Aslam'],
  ['Hassan Ali', 'Dr Sobia Malik', 'childPneumonia', 6, 'Dr Sobia Malik'],
  ['Sana Yousaf', 'Dr Hina Javed', 'asthma', 11, 'Dr Hina Javed'],
  ['Waleed Khan', 'Dr Waqar Ahmed', 'tbSuspect', 5, 'Dr Waqar Ahmed'],
  ['Mahnoor Fatima', 'Dr Junaid Aslam', 'bronchitis', 4, null],
  ['Ghulam Abbas', 'Dr Hina Javed', 'copd', 16, 'Dr Adeel Rehman'],
  ['Sara Ahmed', 'Dr Nida Hassan', 'asthma', 13, 'Dr Nida Hassan'],
  ['Hamza Farooq', 'Dr Kashif Iqbal', 'smokerCough', 18, 'Dr Kashif Iqbal'],
  ['Maryam Siddiqui', 'Dr Saadia Khan', 'bronchitis', 7, null],
  ['Imran Malik', 'Dr Saadia Khan', 'pneumonia', 12, 'Dr Saadia Khan'],
  ['Zainab Hussain', 'Dr Kashif Iqbal', 'tbSuspect', 8, 'Dr Adeel Rehman'],
  ['Ahmed Raza', 'Dr Nida Hassan', 'copd', 21, 'Dr Nida Hassan'],
  ['Fatima Noor', 'Dr Rubina Akhtar', 'childPneumonia', 10, 'Dr Rubina Akhtar'],
  ['Bilal Chaudhry', 'Dr Saadia Khan', 'pleuritic', 15, 'Dr Saadia Khan'],
  ['Ayesha Tariq', 'Dr Nida Hassan', 'bronchitis', 5, null],
  ['Usama Sheikh', 'Dr Waqar Ahmed', 'tbFollowUp', 24, 'Dr Adeel Rehman'],
];

const at = (daysFromToday: number, hhmm: string) => {
  const d = new Date();
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + daysFromToday, h, m);
};

/** Next slot the doctor really offers, from tomorrow on, that nobody has booked. */
async function nextFreeSlot(doctor: { id: string; slotTimes: string; workDays: string }, fromDay: number) {
  const times: string[] = JSON.parse(doctor.slotTimes || '[]');
  const days = doctor.workDays.split(',').map(Number);
  for (let d = fromDay; d < fromDay + 14; d++) {
    const date = at(d, '00:00');
    const iso = date.getDay() === 0 ? 7 : date.getDay();
    if (!days.includes(iso)) continue;
    for (const t of times) {
      const startAt = at(d, t);
      const slotKey = `${doctor.id}|${startAt.toISOString()}`;
      if (!(await prisma.appointment.findUnique({ where: { slotKey } }))) return { startAt, slotKey };
    }
  }
  return null;
}

async function main() {
  const hash = (pw: string) => argon2.hash(pw, { type: argon2.argon2id });
  const created: string[] = [];

  for (const d of NEW_DOCTORS) {
    const email = inbox(d.local);
    if (await prisma.user.findUnique({ where: { email } })) continue;
    const f = await prisma.facility.findFirst({ where: { name: d.facility } });
    await prisma.user.create({
      data: {
        email, passwordHash: await hash(d.password), emailVerified: true, mfaEnabled: true, fullName: d.name, role: 'DOCTOR',
        doctor: { create: {
          specialization: d.spec, pmdcNumber: d.pmdc, qualification: d.qual, hospital: d.facility, city: f?.city ?? 'Islamabad',
          fee: d.fee, rating: d.rating, reviews: d.reviews, experienceYears: d.exp, room: d.room, verified: true, bio: d.bio,
          slotTimes: JSON.stringify(slotsFor(d)), workDays: d.days.join(','), licenceFile: `licence-${d.pmdc}.pdf`, facilityId: f?.id,
        } },
      },
    });
    created.push(`Doctor   | ${d.name.padEnd(17)} | ${email.padEnd(44)} | ${d.password}`);
  }
  for (const p of NEW_PATIENTS) {
    const email = inbox(p.local);
    if (await prisma.user.findUnique({ where: { email } })) continue;
    const [first, last] = p.name.split(' ');
    const password = `${first}@${last}26`;
    await prisma.user.create({
      data: {
        email, passwordHash: await hash(password), emailVerified: true, mfaEnabled: true, fullName: p.name, role: 'PATIENT', phone: p.phone,
        patient: { create: { mrn: p.mrn, dateOfBirth: new Date(p.dob), gender: p.gender, city: p.city, bloodGroup: p.blood, flags: p.flags } },
      },
    });
    created.push(`Patient  | ${p.name.padEnd(17)} | ${email.padEnd(44)} | ${password}`);
  }

  const doctorByName = async (name: string) =>
    prisma.doctor.findFirstOrThrow({ where: { user: { fullName: name } }, include: { user: true } });
  let visits = 0, upcoming = 0;
  for (const [patientName, doctorName, key, daysAgo, nextDoctor] of PLAN) {
    const patient = await prisma.patient.findFirst({ where: { user: { fullName: patientName } } });
    if (!patient) continue;
    if (await prisma.appointment.count({ where: { patientId: patient.id } })) continue; // already has history
    const v: Visit = V[key];
    const doc = await doctorByName(doctorName);
    const times: string[] = JSON.parse(doc.slotTimes || '["10:00"]');
    const startAt = at(-daysAgo, times[Math.min(2, times.length - 1)]);
    const rxItems = v.rx.map((name) => {
      const m = FORMULARY.find((x) => x.name === name)!;
      return { name: m.name, dose: m.dose, frequency: m.frequency };
    });
    const appt = await prisma.appointment.create({
      data: {
        patientId: patient.id, doctorId: doc.id, startAt, status: 'COMPLETED', reason: v.reason,
        payment: { create: { amount: doc.fee, status: 'PAID', method: ['JAZZCASH', 'EASYPAISA', 'CARD'][visits % 3], invoiceNo: `INV-S${hex(3)}`, txRef: `TXN-${hex(3)}`, paidAt: startAt } },
        consultation: { create: { doctorId: doc.id, patientId: patient.id, vitals: JSON.stringify(v.vitals), notes: v.notes, testOrder: v.test, followUpAt: v.next ? at(-daysAgo + 14, '10:00') : null } },
      },
    });
    const code = `RX-${hex(3)}`;
    await prisma.prescription.create({
      data: { code, patientId: patient.id, doctorId: doc.id, appointmentId: appt.id, status: 'SIGNED', signedAt: startAt, items: JSON.stringify(rxItems), createdAt: startAt },
    });
    await prisma.record.createMany({ data: [
      { patientId: patient.id, kind: 'Prescription', title: `Prescription · ${code}`, source: doc.user.fullName, createdAt: startAt,
        body: `${rxItems.map((i) => `• ${i.name} ${i.dose} - ${i.frequency}`).join('\n')}\nSigned by ${doc.user.fullName} · PMDC ${doc.pmdcNumber}` },
      { patientId: patient.id, kind: 'Note', title: 'Consultation summary', source: doc.user.fullName, body: v.notes, createdAt: startAt },
    ] });
    visits++;

    if (nextDoctor && v.next) {
      const nd = await doctorByName(nextDoctor);
      const slot = await nextFreeSlot(nd, 1 + (upcoming % 5));
      if (slot) {
        await prisma.appointment.create({
          data: {
            patientId: patient.id, doctorId: nd.id, startAt: slot.startAt, status: 'CONFIRMED', reason: v.next, slotKey: slot.slotKey,
            payment: { create: { amount: nd.fee, status: 'PAID', method: ['CARD', 'JAZZCASH', 'EASYPAISA'][upcoming % 3], invoiceNo: `INV-S${hex(3)}`, txRef: `TXN-${hex(3)}`, paidAt: new Date() } },
          },
        });
        upcoming++;
      }
    }
  }

  console.log(`New accounts: ${created.length} · completed visits with prescriptions: ${visits} · upcoming bookings: ${upcoming}\n`);
  if (created.length) {
    console.log('Role     | Name              | E-mail (login)                               | Password');
    created.forEach((c) => console.log(c));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
