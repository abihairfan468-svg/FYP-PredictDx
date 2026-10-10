/**
 * Moves the sample clinic day (Dr Adeel Rehman's four patients) to TODAY, so the doctor's queue
 * and Ayesha's "Next visit" are current on the day you present. Nothing is deleted, uploaded
 * X-rays and everything else stay as they are.
 *   npm --prefix backend run today
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DOCTOR = 'a.rehman@predictdx.com';
const VISITS = [
  { email: 'ayesha.khan@predictdx.com', reason: 'Follow-up', time: '16:30', status: 'CONFIRMED' },
  { email: 'bilal.raza@predictdx.com', reason: 'New patient', time: '17:10', status: 'CHECKED_IN' },
  { email: 'hira.saleem@predictdx.com', reason: 'Report review', time: '17:50', status: 'CONFIRMED' },
  { email: 'usman.tariq@predictdx.com', reason: 'TB follow-up', time: '18:30', status: 'CONFIRMED' },
];

async function main() {
  const doctor = await prisma.doctor.findFirst({ where: { user: { email: DOCTOR } } });
  if (!doctor) throw new Error(`${DOCTOR} not found - run "npm --prefix backend run accounts:update" first`);
  const now = new Date();
  let moved = 0;
  for (const v of VISITS) {
    const [h, m] = v.time.split(':').map(Number);
    const startAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
    const slotKey = `${doctor.id}|${startAt.toISOString()}`;
    const appt = await prisma.appointment.findFirst({
      where: { doctorId: doctor.id, reason: v.reason, patient: { user: { email: v.email } } },
      orderBy: { startAt: 'desc' },
    });
    if (!appt) continue;
    const taken = await prisma.appointment.findUnique({ where: { slotKey } });
    if (taken && taken.id !== appt.id) {
      console.log(`${v.time} is already booked by someone else - left ${v.email} as it is`);
      continue;
    }
    await prisma.appointment.update({ where: { id: appt.id }, data: { startAt, slotKey, status: v.status } });
    moved++;
  }
  console.log(`${moved} sample visits are now today (${now.toDateString()}) with Dr Adeel Rehman`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
