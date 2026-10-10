/**
 * Adds the extra demo patients and doctors (prisma/data/demo-accounts.ts) to an EXISTING database.
 * Nothing is deleted; accounts that already exist are skipped.
 *   npm --prefix backend run accounts:add
 * Set DEMO_GMAIL=yourname@gmail.com in backend/.env first so their sign-in codes reach your Gmail.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { DEMO_DOCTORS, DEMO_PATIENTS, demoEmail, upsertDemoAccounts } from '../prisma/data/demo-accounts';

const prisma = new PrismaClient();

async function main() {
  if (!process.env.DEMO_GMAIL) {
    console.log('DEMO_GMAIL is not set in backend/.env - using @predictdx.com addresses (codes only in the API console).');
  }
  const added = await upsertDemoAccounts(prisma);
  console.log(`Added ${added} new account(s).\n`);
  console.log('Role     | Name                 | E-mail                                        | Password');
  for (const p of DEMO_PATIENTS) console.log(`Patient  | ${p.name.padEnd(20)} | ${demoEmail(p.local).padEnd(45)} | ${p.password}`);
  for (const d of DEMO_DOCTORS) console.log(`Doctor   | ${d.name.padEnd(20)} | ${demoEmail(d.local).padEnd(45)} | ${d.password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
