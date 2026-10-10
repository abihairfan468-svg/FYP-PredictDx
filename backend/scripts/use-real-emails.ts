/**
 * Puts real inboxes on the main demo accounts so sign-in codes arrive for real during the presentation.
 * Names, passwords (see LOGINS.md), appointments, records and chats stay as they are; only the e-mail changes.
 * Safe to run again (for example after `npm run reset-demo`).
 *   npm --prefix backend run accounts:real-emails
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** demo account -> real inbox */
export const REAL_EMAILS: [string, string, string][] = [
  ['ayesha.khan@predictdx.com', 'abihairfan454@gmail.com', 'Patient Ayesha Khan'],
  ['a.rehman@predictdx.com', 'abihairfan468@gmail.com', 'Doctor Dr Adeel Rehman'],
  ['admin@predictdx.com', '230897@students.au.edu.pk', 'Admin Sana Ahmed'],
];

async function main() {
  for (const [demo, real, who] of REAL_EMAILS) {
    const taken = await prisma.user.findUnique({ where: { email: real } });
    const current = await prisma.user.findUnique({ where: { email: demo } });
    if (taken && (!current || taken.id !== current.id)) {
      console.log(`${who}: ${real} is already used by another account (${taken.fullName}) - skipped`);
      continue;
    }
    if (!current) {
      console.log(`${who}: already on ${real}`);
      continue;
    }
    await prisma.user.update({ where: { id: current.id }, data: { email: real, emailVerified: true } });
    await prisma.otpCode.deleteMany({ where: { userId: current.id } });
    console.log(`${who}: ${demo} -> ${real}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
