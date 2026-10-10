/**
 * Exports the chest X-rays stored in PostgreSQL as a training dataset.
 *
 *   npm --prefix backend run dataset:export                 doctor-confirmed images only
 *   npm --prefix backend run dataset:export -- --all        also AI-only (unconfirmed) images
 *
 * Output: backend/dataset-export/<date-time>/
 *   images/NORMAL/…, images/PNEUMONIA/…, images/TUBERCULOSIS/…, images/OTHER/…
 *   (with --all: images/unconfirmed/<AI label>/…)
 *   labels.csv   file,label,label_source,ai_label,ai_confidence,view,sex,age_years,taken_at
 *
 * De-identified: file names are a hash of the study id; no names, MRNs or e-mails are written.
 * Only studies with trainingUse = true are exported. Zip the folder and upload it to Drive/Kaggle.
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const prisma = new PrismaClient();
const all = process.argv.includes('--all');
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/dicom': 'dcm' };

async function main() {
  const studies = await prisma.xrayStudy.findMany({
    where: { trainingUse: true, ...(all ? {} : { verifiedLabel: { not: null } }) },
    include: { patient: true, file: true },
    orderBy: { createdAt: 'asc' },
  });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const root = resolve(__dirname, '..', 'dataset-export', stamp);
  const rows = ['file,label,label_source,ai_label,ai_confidence,view,sex,age_years,taken_at'];
  const counts: Record<string, number> = {};
  let skipped = 0;

  for (const s of studies) {
    const data = s.file ? Buffer.from(s.file.data) : s.filePath && existsSync(resolve(__dirname, '..', 'storage', 'xrays', s.filePath)) ? readFileSync(resolve(__dirname, '..', 'storage', 'xrays', s.filePath)) : null;
    if (!data) {
      skipped++;
      continue;
    }
    const ai = s.result ? JSON.parse(s.result) : null;
    const aiLabel = ai?.label ? String(ai.label).toUpperCase() : '';
    const label = s.verifiedLabel ?? aiLabel ?? 'UNKNOWN';
    const folder = s.verifiedLabel ? join('images', s.verifiedLabel) : join('images', 'unconfirmed', aiLabel || 'UNKNOWN');
    const name = `${createHash('sha256').update(s.id).digest('hex').slice(0, 16)}.${EXT[s.mimeType] ?? 'bin'}`;
    mkdirSync(join(root, folder), { recursive: true });
    writeFileSync(join(root, folder, name), data);
    const age = s.patient.dateOfBirth ? Math.floor((s.createdAt.getTime() - s.patient.dateOfBirth.getTime()) / (365.25 * 86_400_000)) : '';
    rows.push([
      `${folder.replace(/\\/g, '/')}/${name}`, label, s.verifiedLabel ? 'doctor' : 'ai', aiLabel, ai?.confidence ?? '', s.view,
      s.patient.gender ?? '', age, s.createdAt.toISOString().slice(0, 10),
    ].join(','));
    counts[folder] = (counts[folder] ?? 0) + 1;
  }

  if (rows.length === 1) {
    console.log(all ? 'No X-ray studies to export yet.' : 'No doctor-confirmed X-rays yet. Confirm diagnoses in the Diagnosis Center, or use --all.');
    return;
  }
  writeFileSync(join(root, 'labels.csv'), rows.join('\n') + '\n');
  console.log(`Exported ${rows.length - 1} X-rays to ${root}`);
  console.table(counts);
  if (skipped) console.log(`${skipped} studies skipped (image missing).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
