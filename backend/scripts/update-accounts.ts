/**
 * One-time update for an EXISTING database (nothing is deleted, X-rays are kept):
 *  0. moves every seeded account from @predictdx.pk to @predictdx.com;
 *  1. renames the old sample doctor "Dr Mehdi Hassan" to "Dr Adeel Rehman" (a.rehman@predictdx.com)
 *     everywhere - account, records, messages, notifications, audit details;
 *  2. gives every seeded account its own password (prisma/data/accounts.ts / LOGINS.md),
 *     but only where the old shared sample password is still in use.
 *   npm --prefix backend run accounts:update
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { passwordFor, PASSWORDS } from '../prisma/data/accounts';
import { DOCTORS } from '../prisma/data/pakistan';

const prisma = new PrismaClient();
const OLD_SHARED_PASSWORD = 'Predictdx@2026';
const TEXT_COLUMNS: [string, string][] = [
  ['Record', 'title'], ['Record', 'source'], ['Record', 'body'],
  ['Message', 'body'], ['Notification', 'title'], ['Notification', 'body'],
  ['AuditLog', 'detail'], ['Doctor', 'bio'], ['Consultation', 'notes'],
];
const REPLACE: [string, string][] = [
  ['m.hassan@predictdx.com', 'a.rehman@predictdx.com'],
  ['Mehdi Hassan', 'Adeel Rehman'],
  ['Dr Hassan', 'Dr Rehman'],
];

async function main() {
  // 0. the demo domain moved from predictdx.pk to predictdx.com
  const moved = await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "email" = replace("email", '@predictdx.pk', '@predictdx.com') WHERE "email" LIKE '%@predictdx.pk'`,
  );
  for (const [table, column] of TEXT_COLUMNS) {
    await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET "${column}" = replace("${column}", 'predictdx.pk', 'predictdx.com') WHERE "${column}" LIKE '%predictdx.pk%'`,
    );
  }
  console.log(`Moved ${moved} accounts from @predictdx.pk to @predictdx.com`);

  const old =await prisma.user.findUnique({ where: { email: 'm.hassan@predictdx.com' } });
  if (old) {
    await prisma.user.update({ where: { id: old.id }, data: { email: 'a.rehman@predictdx.com', fullName: 'Dr Adeel Rehman' } });
    await prisma.otpCode.deleteMany({ where: { userId: old.id } }).catch(() => null);
    console.log('Renamed Dr Mehdi Hassan -> Dr Adeel Rehman (a.rehman@predictdx.com)');
  }
  let rows = 0;
  for (const [table, column] of TEXT_COLUMNS) {
    for (const [from, to] of REPLACE) {
      rows += await prisma.$executeRawUnsafe(
        `UPDATE "${table}" SET "${column}" = replace("${column}", $1, $2) WHERE "${column}" LIKE '%' || $1 || '%'`,
        from, to,
      );
    }
  }
  console.log(`Updated the name in ${rows} records, messages and notes`);

  const emails = [...Object.keys(PASSWORDS), ...DOCTORS.map((d) => d.email)];
  let changed = 0;
  for (const email of emails) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (!u || !(await argon2.verify(u.passwordHash, OLD_SHARED_PASSWORD).catch(() => false))) continue;
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await argon2.hash(passwordFor(email), { type: argon2.argon2id }) } });
    changed++;
  }
  console.log(`Gave ${changed} accounts their own password (see LOGINS.md)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
