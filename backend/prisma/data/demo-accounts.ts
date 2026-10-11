/**
 * Extra demo patients and doctors with standard addresses (first.last@predictdx.com).
 * predictdx.com is not our domain, so MailService never e-mails these addresses: their sign-in
 * codes appear in the API terminal. Real-inbox accounts are set by scripts/use-real-emails.ts.
 *
 * People are fictional; hospitals are the real facilities from data/pakistan.ts.
 *   npm --prefix backend run accounts:add     (adds them to an existing database, deletes nothing)
 */
import type { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { slotsFor } from './pakistan';

export function demoEmail(local: string): string {
  return `${local.replace(/^dr\./, '')}@predictdx.com`;
}

export interface DemoPatient {
  name: string; local: string; password: string; mrn: string; dob: string; gender: 'MALE' | 'FEMALE';
  city: string; phone: string; bloodGroup: string; flags: string;
}

export const DEMO_PATIENTS: DemoPatient[] = [
  { name: 'Sara Ahmed', local: 'sara.ahmed', password: 'Sara@Ahmed26', mrn: 'PDX-11001', dob: '1996-05-14', gender: 'FEMALE', city: 'Islamabad', phone: '+92 300 5122041', bloodGroup: 'B+', flags: 'Asthma' },
  { name: 'Hamza Farooq', local: 'hamza.farooq', password: 'Hamza@Farooq26', mrn: 'PDX-11002', dob: '1988-11-02', gender: 'MALE', city: 'Rawalpindi', phone: '+92 321 5584417', bloodGroup: 'O+', flags: 'Smoker' },
  { name: 'Maryam Siddiqui', local: 'maryam.siddiqui', password: 'Maryam@Siddiqui26', mrn: 'PDX-11003', dob: '2001-02-23', gender: 'FEMALE', city: 'Lahore', phone: '+92 333 4219086', bloodGroup: 'A+', flags: '' },
  { name: 'Imran Malik', local: 'imran.malik', password: 'Imran@Malik26', mrn: 'PDX-11004', dob: '1969-08-30', gender: 'MALE', city: 'Karachi', phone: '+92 302 2147733', bloodGroup: 'B-', flags: 'Diabetic,Hypertension' },
  { name: 'Zainab Hussain', local: 'zainab.hussain', password: 'Zainab@Hussain26', mrn: 'PDX-11005', dob: '1992-12-08', gender: 'FEMALE', city: 'Islamabad', phone: '+92 345 5307712', bloodGroup: 'AB+', flags: 'TB contact' },
  { name: 'Ahmed Raza', local: 'ahmed.raza', password: 'Ahmed@Raza26', mrn: 'PDX-11006', dob: '1958-04-17', gender: 'MALE', city: 'Lahore', phone: '+92 300 4471925', bloodGroup: 'O-', flags: 'COPD,Ex-smoker' },
  { name: 'Fatima Noor', local: 'fatima.noor', password: 'Fatima@Noor26', mrn: 'PDX-11007', dob: '2014-09-03', gender: 'FEMALE', city: 'Rawalpindi', phone: '+92 312 5096648', bloodGroup: 'A-', flags: 'Child (guardian account)' },
  { name: 'Bilal Chaudhry', local: 'bilalchaudhry', password: 'Bilal@Chaudhry26', mrn: 'PDX-11008', dob: '1985-01-26', gender: 'MALE', city: 'Karachi', phone: '+92 331 2675510', bloodGroup: 'B+', flags: 'Penicillin allergy' },
  { name: 'Ayesha Tariq', local: 'ayesha.tariq', password: 'Ayesha@Tariq26', mrn: 'PDX-11009', dob: '1979-06-11', gender: 'FEMALE', city: 'Islamabad', phone: '+92 300 8542207', bloodGroup: 'O+', flags: 'Pregnant (2nd trimester)' },
  { name: 'Usama Sheikh', local: 'usama.sheikh', password: 'Usama@Sheikh26', mrn: 'PDX-11010', dob: '1999-10-19', gender: 'MALE', city: 'Lahore', phone: '+92 322 4380951', bloodGroup: 'A+', flags: 'Previous TB (treated 2022)' },
];

export interface DemoDoctor {
  name: string; local: string; password: string; spec: string; pmdc: string; qual: string; facility: string;
  fee: number; rating: number; reviews: number; exp: number; room: string; days: number[];
  from: string; to: string; every: number; bio: string; languages?: string;
}

export const DEMO_DOCTORS: DemoDoctor[] = [
  { name: 'Dr Nida Hassan', local: 'dr.nida.hassan', password: 'Nida@Hassan26', spec: 'Pulmonology', pmdc: '61204-P', qual: 'MBBS, FCPS (Pulmonology)', facility: 'Maroof International Hospital', fee: 3500, rating: 4.8, reviews: 154, exp: 10, room: 'Chest Clinic 2', days: [1, 3, 5], from: '17:00', to: '20:00', every: 20, bio: 'Asthma, pneumonia and post-COVID lung disease.' },
  { name: 'Dr Kashif Iqbal', local: 'dr.kashif.iqbal', password: 'Kashif@Iqbal26', spec: 'Chest Specialist', pmdc: '58831-P', qual: 'MBBS, MCPS, FCPS (Medicine)', facility: 'Benazir Bhutto Hospital', fee: 1500, rating: 4.6, reviews: 208, exp: 15, room: 'Chest OPD 3', days: [1, 2, 3, 4, 5, 6], from: '09:00', to: '12:00', every: 15, bio: 'Tuberculosis, bronchiectasis and chronic cough.' },
  { name: 'Dr Rubina Akhtar', local: 'dr.rubina.akhtar', password: 'Rubina@Akhtar26', spec: 'Paediatric Pulmonology', pmdc: '63390-P', qual: 'MBBS, FCPS (Paediatrics)', facility: 'Hameed Latif Hospital', fee: 3000, rating: 4.9, reviews: 132, exp: 12, room: 'Children OPD 1', days: [2, 4, 6], from: '16:00', to: '19:00', every: 20, bio: 'Childhood pneumonia, asthma and TB in children.' },
  { name: 'Dr Tariq Mehmood', local: 'dr.tariq.mehmood', password: 'Tariq@Mehmood26', spec: 'Radiology', pmdc: '49917-S', qual: 'MBBS, FCPS (Radiology)', facility: 'Liaquat National Hospital', fee: 2500, rating: 4.7, reviews: 88, exp: 18, room: 'Radiology Reporting 2', days: [1, 2, 3, 4, 5], from: '10:00', to: '13:00', every: 30, bio: 'Chest X-ray and CT reporting.' },
  { name: 'Dr Saadia Khan', local: 'dr.saadia.khan', password: 'Saadia@Khan26', spec: 'Internal Medicine', pmdc: '65042-S', qual: 'MBBS, MRCP (UK)', facility: 'South City Hospital', fee: 4000, rating: 4.8, reviews: 117, exp: 9, room: 'OPD 6', days: [1, 2, 4, 5], from: '18:00', to: '21:00', every: 20, bio: 'Fever, chest infections and diabetes with lung disease.' },
];

/** Creates any of the demo accounts that are missing. Existing accounts are left untouched. */
export async function upsertDemoAccounts(prisma: PrismaClient) {
  const hash = (pw: string) => argon2.hash(pw, { type: argon2.argon2id });
  let added = 0;
  for (const p of DEMO_PATIENTS) {
    const email = demoEmail(p.local);
    if (await prisma.user.findUnique({ where: { email } })) continue;
    await prisma.user.create({
      data: {
        email, passwordHash: await hash(p.password), emailVerified: true, mfaEnabled: true,
        fullName: p.name, role: 'PATIENT', phone: p.phone,
        patient: { create: { mrn: p.mrn, dateOfBirth: new Date(p.dob), gender: p.gender, city: p.city, bloodGroup: p.bloodGroup, flags: p.flags } },
      },
    });
    added++;
  }
  for (const d of DEMO_DOCTORS) {
    const email = demoEmail(d.local);
    if (await prisma.user.findUnique({ where: { email } })) continue;
    const f = await prisma.facility.findFirst({ where: { name: d.facility } });
    await prisma.user.create({
      data: {
        email, passwordHash: await hash(d.password), emailVerified: true, mfaEnabled: true, fullName: d.name, role: 'DOCTOR',
        doctor: {
          create: {
            specialization: d.spec, pmdcNumber: d.pmdc, qualification: d.qual, hospital: d.facility, city: f?.city ?? 'Islamabad',
            fee: d.fee, rating: d.rating, reviews: d.reviews, experienceYears: d.exp, room: d.room, verified: true, bio: d.bio,
            languages: d.languages ?? 'English, Urdu', slotTimes: JSON.stringify(slotsFor(d)), workDays: d.days.join(','),
            licenceFile: `licence-${d.pmdc}.pdf`, facilityId: f?.id,
          },
        },
      },
    });
    added++;
  }
  return added;
}
