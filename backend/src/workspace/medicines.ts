/**
 * Small formulary for chest medicine plus a rule-based interaction checker.
 * Decision support only: warnings are shown to the doctor, who decides.
 * Swap in a licensed drug-interaction API (e.g. DrugBank) behind checkInteractions().
 */
export interface Medicine {
  name: string;
  dose: string;
  frequency: string;
  group: string;
}

export const FORMULARY: Medicine[] = [
  { name: 'Isoniazid', dose: '300 mg', frequency: 'Once daily, morning · 8 weeks', group: 'Anti-TB' },
  { name: 'Rifampicin', dose: '600 mg', frequency: 'Once daily, empty stomach · 8 weeks', group: 'Anti-TB' },
  { name: 'Pyrazinamide', dose: '1,500 mg', frequency: 'Once daily with food · 8 weeks', group: 'Anti-TB' },
  { name: 'Ethambutol', dose: '800 mg', frequency: 'Once daily with food · 8 weeks', group: 'Anti-TB' },
  { name: 'Pyridoxine (B6)', dose: '25 mg', frequency: 'Once daily · with isoniazid', group: 'Supplement' },
  { name: 'Amoxicillin', dose: '500 mg', frequency: 'Three times daily · 7 days', group: 'Penicillin' },
  { name: 'Co-amoxiclav', dose: '625 mg', frequency: 'Twice daily · 7 days', group: 'Penicillin' },
  { name: 'Azithromycin', dose: '500 mg', frequency: 'Once daily · 3 days', group: 'Macrolide' },
  { name: 'Clarithromycin', dose: '500 mg', frequency: 'Twice daily · 7 days', group: 'Macrolide' },
  { name: 'Levofloxacin', dose: '750 mg', frequency: 'Once daily · 5 days', group: 'Fluoroquinolone' },
  { name: 'Moxifloxacin', dose: '400 mg', frequency: 'Once daily · 7 days', group: 'Fluoroquinolone' },
  { name: 'Ceftriaxone', dose: '1 g IV', frequency: 'Once daily · 5 days', group: 'Cephalosporin' },
  { name: 'Prednisolone', dose: '40 mg', frequency: 'Once daily, morning · 5 days', group: 'Steroid' },
  { name: 'Paracetamol', dose: '500 mg', frequency: 'As needed for fever · max 4 g/day', group: 'Analgesic' },
  { name: 'Salbutamol inhaler', dose: '100 mcg', frequency: '2 puffs when wheezy', group: 'Bronchodilator' },
];

type Severity = 'major' | 'moderate' | 'minor';
const PAIRS: [string, string, Severity, string][] = [
  ['Rifampicin', 'Clarithromycin', 'major', 'Rifampicin sharply lowers clarithromycin levels; clarithromycin raises rifampicin toxicity.'],
  ['Moxifloxacin', 'Azithromycin', 'major', 'Both prolong the QT interval - risk of dangerous arrhythmia.'],
  ['Moxifloxacin', 'Clarithromycin', 'major', 'Both prolong the QT interval - risk of dangerous arrhythmia.'],
  ['Levofloxacin', 'Azithromycin', 'moderate', 'Additive QT prolongation - consider an ECG.'],
  ['Levofloxacin', 'Prednisolone', 'moderate', 'Fluoroquinolone with a steroid raises the risk of tendon rupture.'],
  ['Moxifloxacin', 'Prednisolone', 'moderate', 'Fluoroquinolone with a steroid raises the risk of tendon rupture.'],
  ['Rifampicin', 'Prednisolone', 'moderate', 'Rifampicin speeds steroid breakdown - the dose may need doubling.'],
  ['Isoniazid', 'Paracetamol', 'minor', 'Both are processed by the liver - monitor liver function.'],
];

export interface Warning {
  severity: Severity;
  message: string;
}

export function checkInteractions(names: string[], patientFlags: string[] = []): Warning[] {
  const has = (n: string) => names.some((x) => x.toLowerCase() === n.toLowerCase());
  const out: Warning[] = [];
  for (const [a, b, severity, message] of PAIRS) {
    if (has(a) && has(b)) out.push({ severity, message: `${a} + ${b}: ${message}` });
  }
  const groups = names
    .map((n) => FORMULARY.find((f) => f.name.toLowerCase() === n.toLowerCase())?.group)
    .filter((g): g is string => !!g && g !== 'Anti-TB' && g !== 'Supplement');
  const dup = groups.find((g, i) => groups.indexOf(g) !== i);
  if (dup) out.push({ severity: 'moderate', message: `Two ${dup} drugs on the same prescription - check this is intended.` });

  const flags = patientFlags.map((f) => f.toLowerCase());
  if (flags.some((f) => f.includes('penicillin')) && names.some((n) => ['amoxicillin', 'co-amoxiclav'].includes(n.toLowerCase()))) {
    out.push({ severity: 'major', message: 'Patient has a recorded penicillin allergy.' });
  }
  if (has('Isoniazid') && !has('Pyridoxine (B6)')) {
    out.push({ severity: 'minor', message: 'Isoniazid without pyridoxine - consider B6 to prevent neuropathy.' });
  }
  const rank = { major: 0, moderate: 1, minor: 2 };
  return out.sort((x, y) => rank[x.severity] - rank[y.severity]);
}
