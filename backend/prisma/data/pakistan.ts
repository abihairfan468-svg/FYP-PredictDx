/**
 * Reference data for PredictDx.
 *
 * FACILITIES are real hospitals, clinics and chest institutes in Islamabad, Rawalpindi,
 * Lahore and Karachi (public information; coordinates are approximate, for distance only).
 * DOCTORS are fictional: realistic names, qualifications, fees and OPD timings, but they
 * are not real people. Real doctors join through the doctor sign-up + licence verification
 * flow, with their consent.
 */

export interface FacilitySeed {
  name: string;
  type: 'HOSPITAL' | 'CLINIC' | 'DIAGNOSTIC_CENTRE';
  sector: 'PUBLIC' | 'PRIVATE';
  city: 'Islamabad' | 'Rawalpindi' | 'Lahore' | 'Karachi';
  area: string;
  address: string;
  lat: number;
  lng: number;
  services: string;
}

export const FACILITIES: FacilitySeed[] = [
  // ---------------- Islamabad
  { name: 'Pakistan Institute of Medical Sciences (PIMS)', type: 'HOSPITAL', sector: 'PUBLIC', city: 'Islamabad', area: 'G-8/3', address: 'Ibn-e-Sina Road, G-8/3, Islamabad', lat: 33.7005, lng: 73.0508, services: 'Pulmonology OPD, Radiology, Chest X-ray, CT' },
  { name: 'Shifa International Hospital', type: 'HOSPITAL', sector: 'PRIVATE', city: 'Islamabad', area: 'H-8/4', address: 'Pitras Bukhari Road, H-8/4, Islamabad', lat: 33.6766, lng: 73.0712, services: 'Pulmonology, Sleep lab, Radiology, Digital X-ray' },
  { name: 'Kulsum International Hospital', type: 'HOSPITAL', sector: 'PRIVATE', city: 'Islamabad', area: 'Blue Area', address: 'Jinnah Avenue, Blue Area, Islamabad', lat: 33.7125, lng: 73.065, services: 'Chest medicine, Radiology' },
  { name: 'Maroof International Hospital', type: 'HOSPITAL', sector: 'PRIVATE', city: 'Islamabad', area: 'F-10 Markaz', address: 'F-10 Markaz, Islamabad', lat: 33.6955, lng: 73.013, services: 'Internal medicine, Pulmonology, X-ray' },
  { name: 'Federal Government Polyclinic', type: 'HOSPITAL', sector: 'PUBLIC', city: 'Islamabad', area: 'G-6/2', address: 'Luqman Hakeem Road, G-6/2, Islamabad', lat: 33.7205, lng: 73.088, services: 'Medical OPD, TB DOTS centre, X-ray' },
  { name: 'Ali Medical Centre', type: 'CLINIC', sector: 'PRIVATE', city: 'Islamabad', area: 'F-8 Markaz', address: 'Kohistan Road, F-8 Markaz, Islamabad', lat: 33.709, lng: 73.038, services: 'Consultant clinics, Digital X-ray' },
  { name: 'Rawal Institute of Health Sciences', type: 'HOSPITAL', sector: 'PRIVATE', city: 'Islamabad', area: 'Lehtrar Road', address: 'Lehtrar Road, Khanna Dak, Islamabad', lat: 33.642, lng: 73.156, services: 'Medicine, Chest clinic, Radiology' },
  // ---------------- Rawalpindi
  { name: 'Holy Family Hospital', type: 'HOSPITAL', sector: 'PUBLIC', city: 'Rawalpindi', area: 'Satellite Town', address: 'Satellite Town, Rawalpindi', lat: 33.6395, lng: 73.071, services: 'Pulmonology unit, TB clinic, Radiology' },
  { name: 'Benazir Bhutto Hospital', type: 'HOSPITAL', sector: 'PUBLIC', city: 'Rawalpindi', area: 'Murree Road', address: 'Murree Road, Chandni Chowk, Rawalpindi', lat: 33.6254, lng: 73.0637, services: 'Chest medicine, Emergency, X-ray' },
  { name: 'Quaid-e-Azam International Hospital', type: 'HOSPITAL', sector: 'PRIVATE', city: 'Rawalpindi', area: 'GT Road', address: 'Near Golra Morr, GT Road, Rawalpindi', lat: 33.648, lng: 72.979, services: 'Pulmonology, Radiology, CT' },
  // ---------------- Lahore
  { name: 'Gulab Devi Chest Hospital', type: 'HOSPITAL', sector: 'PRIVATE', city: 'Lahore', area: 'Ferozepur Road', address: 'Ferozepur Road, Lahore', lat: 31.496, lng: 74.323, services: 'Chest & TB specialist hospital, Radiology' },
  { name: 'Mayo Hospital', type: 'HOSPITAL', sector: 'PUBLIC', city: 'Lahore', area: 'Anarkali', address: 'Hospital Road, Anarkali, Lahore', lat: 31.57, lng: 74.311, services: 'Pulmonology, Radiology, TB DOTS' },
  { name: 'Services Hospital', type: 'HOSPITAL', sector: 'PUBLIC', city: 'Lahore', area: 'Shadman', address: 'Jail Road, Shadman, Lahore', lat: 31.541, lng: 74.338, services: 'Chest medicine, Radiology' },
  { name: 'Jinnah Hospital', type: 'HOSPITAL', sector: 'PUBLIC', city: 'Lahore', area: 'Faisal Town', address: 'Usmani Road, Faisal Town, Lahore', lat: 31.485, lng: 74.297, services: 'Pulmonology, Radiology, CT' },
  { name: 'Doctors Hospital', type: 'HOSPITAL', sector: 'PRIVATE', city: 'Lahore', area: 'Johar Town', address: 'Canal Bank Road, Johar Town, Lahore', lat: 31.4755, lng: 74.289, services: 'Pulmonology, Imaging centre' },
  { name: 'Hameed Latif Hospital', type: 'HOSPITAL', sector: 'PRIVATE', city: 'Lahore', area: 'Garden Town', address: 'Abu Bakar Block, New Garden Town, Lahore', lat: 31.502, lng: 74.317, services: 'Medicine, Chest clinic, X-ray' },
  { name: 'Lahore General Hospital', type: 'HOSPITAL', sector: 'PUBLIC', city: 'Lahore', area: 'Ferozepur Road', address: 'Ferozepur Road, near Ghazi Chowk, Lahore', lat: 31.463, lng: 74.345, services: 'Medicine, Chest unit, Radiology' },
  // ---------------- Karachi
  { name: 'Aga Khan University Hospital', type: 'HOSPITAL', sector: 'PRIVATE', city: 'Karachi', area: 'Stadium Road', address: 'Stadium Road, Karachi', lat: 24.892, lng: 67.075, services: 'Pulmonology, Sleep medicine, Radiology, CT' },
  { name: 'Jinnah Postgraduate Medical Centre (JPMC)', type: 'HOSPITAL', sector: 'PUBLIC', city: 'Karachi', area: 'Saddar', address: 'Rafiqui Shaheed Road, Karachi', lat: 24.852, lng: 67.045, services: 'Chest medicine, Radiology, TB clinic' },
  { name: 'Ojha Institute of Chest Diseases', type: 'HOSPITAL', sector: 'PUBLIC', city: 'Karachi', area: 'Gulzar-e-Hijri', address: 'Dow University Ojha Campus, Gulzar-e-Hijri, Karachi', lat: 24.9395, lng: 67.14, services: 'Chest & TB institute, Radiology' },
  { name: 'Liaquat National Hospital', type: 'HOSPITAL', sector: 'PRIVATE', city: 'Karachi', area: 'Stadium Road', address: 'National Stadium Road, Karachi', lat: 24.893, lng: 67.069, services: 'Pulmonology, Radiology' },
  { name: 'The Indus Hospital', type: 'HOSPITAL', sector: 'PRIVATE', city: 'Karachi', area: 'Korangi', address: 'Korangi Crossing, Karachi', lat: 24.8365, lng: 67.135, services: 'TB programme, Chest clinic, X-ray' },
  { name: 'South City Hospital', type: 'HOSPITAL', sector: 'PRIVATE', city: 'Karachi', area: 'Clifton', address: 'Shahrah-e-Firdousi, Clifton, Karachi', lat: 24.815, lng: 67.03, services: 'Medicine, Pulmonology, Imaging' },
];

export interface DoctorSeed {
  name: string;
  email: string;
  spec: string;
  pmdc: string;
  qual: string;
  facility: string;
  fee: number;
  rating: number;
  reviews: number;
  exp: number;
  room: string;
  /** ISO weekdays, 1 = Monday */
  days: number[];
  /** OPD session, e.g. ['17:00', '20:00'] */
  from: string;
  to: string;
  every: number;
  languages?: string;
  bio: string;
}

const t = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));

/** "17:00"-"20:00" every 20 min -> ["17:00","17:20",...,"19:40"] */
export const slotsFor = (d: Pick<DoctorSeed, 'from' | 'to' | 'every'>) => {
  const out: string[] = [];
  for (let m = toMin(d.from); m + d.every <= toMin(d.to); m += d.every) out.push(t(m));
  return out;
};

export const DOCTORS: DoctorSeed[] = [
  // ---------------- Islamabad
  { name: 'Dr Omer Farooq', email: 'omer.farooq@predictdx.com', spec: 'Pulmonology', pmdc: '38214-P', qual: 'MBBS, FCPS (Pulmonology)', facility: 'Shifa International Hospital', fee: 4500, rating: 4.8, reviews: 412, exp: 16, room: 'Chest Clinic 3', days: [1, 3, 5], from: '16:00', to: '19:00', every: 20, bio: 'Asthma, COPD, TB and interstitial lung disease.' },
  { name: 'Dr Saima Rizvi', email: 'saima.rizvi@predictdx.com', spec: 'Pulmonology', pmdc: '44871-P', qual: 'MBBS, MRCP (UK), FCPS', facility: 'Kulsum International Hospital', fee: 3500, rating: 4.7, reviews: 238, exp: 12, room: 'OPD 7', days: [2, 4, 6], from: '17:00', to: '20:00', every: 20, bio: 'Respiratory infections, pneumonia and sleep apnoea.' },
  { name: 'Dr Faisal Mahmood', email: 'faisal.mahmood@predictdx.com', spec: 'Chest Specialist', pmdc: '29957-P', qual: 'MBBS, MCPS, FCPS (Medicine)', facility: 'Pakistan Institute of Medical Sciences (PIMS)', fee: 2000, rating: 4.6, reviews: 305, exp: 20, room: 'Pulmonology OPD', days: [1, 2, 3, 4, 5, 6], from: '09:00', to: '12:00', every: 15, bio: 'TB, pleural disease and chronic cough.' },
  { name: 'Dr Nadia Qureshi', email: 'nadia.qureshi@predictdx.com', spec: 'General Physician', pmdc: '51230-P', qual: 'MBBS, FCPS (Family Medicine)', facility: 'Ali Medical Centre', fee: 2500, rating: 4.7, reviews: 188, exp: 9, room: 'Clinic 2', days: [1, 2, 3, 4, 5, 6], from: '10:00', to: '13:00', every: 20, bio: 'Fever, cough and chest infections in adults.' },
  { name: 'Dr Usman Tahir', email: 'usman.tahir@predictdx.com', spec: 'Radiology', pmdc: '40365-P', qual: 'MBBS, FCPS (Radiology)', facility: 'Maroof International Hospital', fee: 3000, rating: 4.8, reviews: 97, exp: 11, room: 'Radiology Dept', days: [1, 2, 3, 4, 5], from: '11:00', to: '14:00', every: 30, bio: 'Chest X-ray and CT reporting.' },
  { name: 'Dr Ayesha Siddiqa', email: 'ayesha.siddiqa@predictdx.com', spec: 'Paediatric Pulmonology', pmdc: '47719-P', qual: 'MBBS, FCPS (Paediatrics)', facility: 'Shifa International Hospital', fee: 4000, rating: 4.9, reviews: 176, exp: 10, room: 'Children OPD 4', days: [2, 4], from: '15:00', to: '18:00', every: 20, bio: 'Childhood asthma, pneumonia and TB in children.' },
  { name: 'Dr Kamran Akhtar', email: 'kamran.akhtar@predictdx.com', spec: 'Internal Medicine', pmdc: '36108-P', qual: 'MBBS, FCPS (Medicine)', facility: 'Federal Government Polyclinic', fee: 1500, rating: 4.5, reviews: 264, exp: 18, room: 'Medical OPD 1', days: [1, 2, 3, 4, 5], from: '08:30', to: '11:30', every: 15, bio: 'General medicine and TB DOTS follow-up.' },
  // ---------------- Rawalpindi
  { name: 'Dr Asad Ullah Khan', email: 'asad.khan@predictdx.com', spec: 'Pulmonology', pmdc: '33842-P', qual: 'MBBS, FCPS (Pulmonology)', facility: 'Holy Family Hospital', fee: 2000, rating: 4.7, reviews: 351, exp: 17, room: 'Chest Unit OPD', days: [1, 3, 5], from: '09:00', to: '12:00', every: 15, bio: 'Tuberculosis, bronchiectasis and COPD.' },
  { name: 'Dr Rabia Anwar', email: 'rabia.anwar@predictdx.com', spec: 'Chest Specialist', pmdc: '48213-P', qual: 'MBBS, MCPS (Pulmonology)', facility: 'Benazir Bhutto Hospital', fee: 1800, rating: 4.6, reviews: 142, exp: 8, room: 'OPD 5', days: [2, 4, 6], from: '09:00', to: '12:00', every: 20, bio: 'Pneumonia, asthma and post-TB lung disease.' },
  { name: 'Dr Shahid Nawaz', email: 'shahid.nawaz@predictdx.com', spec: 'Pulmonology', pmdc: '31177-P', qual: 'MBBS, FCPS, FCCP', facility: 'Quaid-e-Azam International Hospital', fee: 3000, rating: 4.7, reviews: 219, exp: 22, room: 'Consultant Clinic 9', days: [1, 2, 4, 6], from: '17:00', to: '20:00', every: 20, bio: 'Complex chest infections and pleural procedures.' },
  // ---------------- Lahore
  { name: 'Dr Imran Aslam', email: 'imran.aslam@predictdx.com', spec: 'Chest Specialist', pmdc: '27745-P', qual: 'MBBS, FCPS (Pulmonology)', facility: 'Gulab Devi Chest Hospital', fee: 2500, rating: 4.8, reviews: 520, exp: 24, room: 'Chest OPD 1', days: [1, 2, 3, 4, 5, 6], from: '09:00', to: '13:00', every: 20, bio: 'Tuberculosis and drug-resistant TB.' },
  { name: 'Dr Mehwish Tariq', email: 'mehwish.tariq@predictdx.com', spec: 'Pulmonology', pmdc: '46690-P', qual: 'MBBS, FCPS (Pulmonology)', facility: 'Doctors Hospital', fee: 4000, rating: 4.8, reviews: 233, exp: 11, room: 'Clinic 12', days: [1, 3, 5], from: '17:00', to: '20:00', every: 20, bio: 'Asthma, COPD and lung function testing.' },
  { name: 'Dr Bilal Chaudhry', email: 'bilal.chaudhry@predictdx.com', spec: 'Internal Medicine', pmdc: '39981-P', qual: 'MBBS, MRCP (UK)', facility: 'Hameed Latif Hospital', fee: 3500, rating: 4.6, reviews: 158, exp: 14, room: 'OPD 3', days: [2, 4, 6], from: '16:00', to: '19:00', every: 20, bio: 'Fever, infections and diabetes with chest disease.' },
  { name: 'Dr Sadia Iqbal', email: 'sadia.iqbal@predictdx.com', spec: 'Radiology', pmdc: '42518-P', qual: 'MBBS, FCPS (Radiology)', facility: 'Jinnah Hospital', fee: 2000, rating: 4.7, reviews: 84, exp: 12, room: 'Radiology Reporting', days: [1, 2, 3, 4, 5], from: '09:00', to: '12:00', every: 30, bio: 'Chest radiographs and HRCT.' },
  { name: 'Dr Waqas Ahmed', email: 'waqas.ahmed@predictdx.com', spec: 'Chest Specialist', pmdc: '50342-P', qual: 'MBBS, FCPS (Medicine)', facility: 'Mayo Hospital', fee: 1500, rating: 4.5, reviews: 197, exp: 9, room: 'East Medical OPD', days: [1, 2, 3, 4, 5, 6], from: '08:30', to: '11:30', every: 15, bio: 'TB DOTS, pneumonia and COPD.' },
  { name: 'Dr Hina Javed', email: 'hina.javed@predictdx.com', spec: 'General Physician', pmdc: '53127-P', qual: 'MBBS, MCPS (Family Medicine)', facility: 'Services Hospital', fee: 1500, rating: 4.6, reviews: 121, exp: 7, room: 'Medical OPD 2', days: [1, 2, 3, 4, 5], from: '09:00', to: '12:00', every: 20, bio: 'Cough, fever and chest infections.' },
  // ---------------- Karachi
  { name: 'Dr Arif Memon', email: 'arif.memon@predictdx.com', spec: 'Pulmonology', pmdc: '25583-S', qual: 'MBBS, FCPS (Pulmonology), FCCP', facility: 'Aga Khan University Hospital', fee: 6000, rating: 4.9, reviews: 610, exp: 25, room: 'Pulmonary Clinic, Floor 2', days: [1, 3, 5], from: '14:00', to: '17:00', every: 20, bio: 'Interstitial lung disease, TB and critical care.' },
  { name: 'Dr Farah Shaikh', email: 'farah.shaikh@predictdx.com', spec: 'Chest Specialist', pmdc: '43109-S', qual: 'MBBS, FCPS (Pulmonology)', facility: 'Ojha Institute of Chest Diseases', fee: 1500, rating: 4.7, reviews: 288, exp: 13, room: 'Chest OPD 2', days: [1, 2, 3, 4, 5, 6], from: '09:00', to: '12:00', every: 15, bio: 'Tuberculosis and chronic lung disease.' },
  { name: 'Dr Junaid Baig', email: 'junaid.baig@predictdx.com', spec: 'Pulmonology', pmdc: '38846-S', qual: 'MBBS, MRCP (UK), FCPS', facility: 'Liaquat National Hospital', fee: 4500, rating: 4.8, reviews: 347, exp: 15, room: 'Consultant Clinic 21', days: [2, 4, 6], from: '17:00', to: '20:00', every: 20, bio: 'Asthma, pneumonia and pleural effusion.' },
  { name: 'Dr Sana Kazmi', email: 'sana.kazmi@predictdx.com', spec: 'Internal Medicine', pmdc: '49911-S', qual: 'MBBS, FCPS (Medicine)', facility: 'The Indus Hospital', fee: 0, rating: 4.8, reviews: 402, exp: 10, room: 'TB Clinic', days: [1, 2, 3, 4, 5], from: '09:00', to: '12:00', every: 15, bio: 'Free TB care programme and follow-up.' },
  { name: 'Dr Adnan Siddiqui', email: 'adnan.siddiqui@predictdx.com', spec: 'Radiology', pmdc: '36604-S', qual: 'MBBS, FCPS (Radiology)', facility: 'Jinnah Postgraduate Medical Centre (JPMC)', fee: 2000, rating: 4.6, reviews: 76, exp: 16, room: 'Radiology Ward 5', days: [1, 2, 3, 4, 5], from: '10:00', to: '13:00', every: 30, bio: 'Chest X-ray and CT interpretation.' },
  { name: 'Dr Maria Khalid', email: 'maria.khalid@predictdx.com', spec: 'General Physician', pmdc: '54220-S', qual: 'MBBS, MCPS (Family Medicine)', facility: 'South City Hospital', fee: 3000, rating: 4.7, reviews: 139, exp: 8, room: 'OPD 4', days: [1, 2, 3, 4, 5, 6], from: '18:00', to: '21:00', every: 20, bio: 'Adult chest infections and preventive care.' },
];
