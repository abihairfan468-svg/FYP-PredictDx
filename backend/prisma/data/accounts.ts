/**
 * Sign-in passwords for the seeded accounts. Each account has its own password,
 * like real users. The list for the team is in LOGINS.md (never shown in the app).
 */
export const PASSWORDS: Record<string, string> = {
  // admin
  'admin@predictdx.com': 'SanaAdmin#2026',
  // doctors
  'a.rehman@predictdx.com': 'Adeel@Shifa204',
  'z.ahmed@predictdx.com': 'Zeeshan#Pims12',
  'j.bushra@predictdx.com': 'Javeria@Hfh03',
  'a.faheem@predictdx.com': 'AliFaheem#08',
  's.malik@predictdx.com': 'SanaMalik@Rad2',
  'h.khalid@predictdx.com': 'Hamza#Lgh0505',
  'u.qureshi@predictdx.com': 'Usman@Qureshi52',
  'f.naz@predictdx.com': 'FarahNaz#5310',
  // patients
  'ayesha.khan@predictdx.com': 'Ayesha#Khan94',
  'bilal.raza@predictdx.com': 'Bilal@Raza81',
  'hira.saleem@predictdx.com': 'Hira$Saleem98',
  'usman.tariq@predictdx.com': 'Usman!Tariq75',
  'kamran.shah@predictdx.com': 'Kamran#Shah90',
};

/** Password for a seeded account; the directory doctors follow First@Last26 (e.g. Omer@Farooq26). */
export function passwordFor(email: string): string {
  if (PASSWORDS[email]) return PASSWORDS[email];
  const [first, last] = email.split('@')[0].split('.');
  const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);
  return `${cap(first)}@${cap(last)}26`;
}
