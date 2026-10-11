/**
 * Replaces plus-addressed demo e-mails (name+person@...) with standard addresses.
 * Two showcase people move to real team inboxes; everyone else becomes first.last@predictdx.com
 * (never e-mailed; codes appear in the API terminal). Data linked to the accounts is untouched.
 *   npm --prefix backend run accounts:standard-emails
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SPECIAL: Record<string, string> = {
  'abihairfan721+dr.hina.javed@gmail.com': 'abihairfan721@gmail.com',
  '230897+nimra.shah@students.au.edu.pk': '230941@students.au.edu.pk',
  'abihairfan454+panel@gmail.com': 'panel.test@predictdx.com',
};

async function main() {
  const users = await prisma.user.findMany({ where: { email: { contains: '+' } }, orderBy: { createdAt: 'asc' } });
  for (const u of users) {
    const local = u.email.split('@')[0].split('+')[1] ?? '';
    const target = SPECIAL[u.email] ?? `${local.replace(/^dr\./, '')}@predictdx.com`;
    const taken = await prisma.user.findUnique({ where: { email: target } });
    if (taken) {
      console.log(`skipped ${u.email}: ${target} already belongs to ${taken.fullName}`);
      continue;
    }
    await prisma.user.update({ where: { id: u.id }, data: { email: target, emailVerified: true } });
    await prisma.otpCode.deleteMany({ where: { userId: u.id } });
    console.log(`${u.fullName.padEnd(18)} ${u.email.padEnd(46)} -> ${target}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
