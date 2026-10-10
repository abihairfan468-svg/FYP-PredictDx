import { checkInteractions } from './medicines';

describe('checkInteractions', () => {
  it('passes a standard ATT regimen with B6', () => {
    expect(checkInteractions(['Isoniazid', 'Rifampicin', 'Pyrazinamide', 'Ethambutol', 'Pyridoxine (B6)'])).toEqual([]);
  });
  it('flags QT-prolonging pairs as major and sorts them first', () => {
    const w = checkInteractions(['Isoniazid', 'Moxifloxacin', 'Azithromycin']);
    expect(w[0]).toMatchObject({ severity: 'major' });
    expect(w.map((x) => x.severity)).toEqual(['major', 'minor']);
  });
  it('flags duplicate drug classes', () => {
    expect(checkInteractions(['Levofloxacin', 'Moxifloxacin']).some((w) => /Two Fluoroquinolone/.test(w.message))).toBe(true);
  });
  it('uses patient allergy flags, case-insensitively', () => {
    expect(checkInteractions(['amoxicillin'], ['Penicillin allergy'])).toEqual([{ severity: 'major', message: 'Patient has a recorded penicillin allergy.' }]);
  });
});
