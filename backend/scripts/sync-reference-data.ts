/**
 * Adds the hospital/clinic directory and the doctors in prisma/data/pakistan.ts to an
 * EXISTING database without deleting anything (safe to run any number of times).
 *   npm --prefix backend run data:sync
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { passwordFor } from '../prisma/data/accounts';
import { DOCTORS, FACILITIES, slotsFor } from '../prisma/data/pakistan';

const prisma = new PrismaClient();

/** Older demo hospital names -> the real facility they now belong to. */
const RENAMED: Record<string, string> = {
  'Air University Teaching Hospital': 'Shifa International Hospital',
  'PIMS Islamabad': 'Pakistan Institute of Medical Sciences (PIMS)',
  'PIMS Radiology': 'Pakistan Institute of Medical Sciences (PIMS)',
  'Family Medical Hospital': 'Holy Family Hospital',
};

async function main() {
  const ids: Record<string, string> = {};
  for (const f of FACILITIES) {
    const row = await prisma.facility.upsert({ where: { name: f.name }, update: f, create: f });
    ids[f.name] = row.id;
  }

  // Link every existing doctor to a real facility.
  let linked = 0;
  for (const d of await prisma.doctor.findMany()) {
    const name = RENAMED[d.hospital] ?? d.hospital;
    if (ids[name] && (d.facilityId !== ids[name] || d.hospital !== name)) {
      await prisma.doctor.update({ where: { id: d.id }, data: { facilityId: ids[name], hospital: name } });
      linked++;
    }
  }

  const SESSIONS: Record<string, [string[], string]> = {
    'Dr Adeel Rehman': [['09:30', '10:10', '10:50', '11:30', '16:30', '17:10', '17:50', '18:30'], '1,2,3,4,5,6'],
    'Dr Zeeshan Ahmed': [['10:00', '10:20', '10:40', '11:00', '11:20', '11:40', '12:00', '12:20', '12:40'], '1,2,3,4,5,6'],
    'Dr Javeria Bushra': [['10:00', '10:20', '10:40', '11:00', '11:20', '11:40', '12:00', '12:20', '12:40'], '1,2,3,4,5,6'],
    'Dr Ali Faheem': [['17:00', '17:20', '17:40', '18:00', '18:20', '18:40', '19:00', '19:20', '19:40'], '1,2,3,4,5,6'],
    'Dr Sana Malik': [['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'], '1,2,3,4,5'],
    'Dr Hamza Khalid': [['15:00', '15:20', '15:40', '16:00', '16:20', '16:40', '17:00', '17:20', '17:40'], '1,2,3,4,5,6'],
  };
  for (const [name, [slots, days]] of Object.entries(SESSIONS)) {
    await prisma.doctor.updateMany({ where: { user: { fullName: name } }, data: { slotTimes: JSON.stringify(slots), workDays: days } });
  }

  let added = 0;
  for (const d of DOCTORS) {
    if (await prisma.user.findUnique({ where: { email: d.email } })) continue;
    const f = FACILITIES.find((x) => x.name === d.facility)!;
    const passwordHash = await argon2.hash(passwordFor(d.email), { type: argon2.argon2id });
    await prisma.user.create({
      data: {
        email: d.email, fullName: d.name, role: 'DOCTOR', passwordHash, emailVerified: true, mfaEnabled: true,
        doctor: {
          create: {
            specialization: d.spec, pmdcNumber: d.pmdc, qualification: d.qual, hospital: d.facility, city: f.city, fee: d.fee,
            rating: d.rating, reviews: d.reviews, experienceYears: d.exp, room: d.room, verified: true, bio: d.bio,
            languages: d.languages ?? 'English, Urdu', slotTimes: JSON.stringify(slotsFor(d)), workDays: d.days.join(','),
            licenceFile: `licence-${d.pmdc}.pdf`, facilityId: ids[d.facility],
          },
        },
      },
    });
    added++;
  }
  console.log(`${FACILITIES.length} hospitals/clinics in the directory · ${linked} existing doctors linked · ${added} doctors added`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
