/**
 * One-off: copies X-rays uploaded before database storage (backend/storage/xrays/*) into
 * PostgreSQL. The files on disk are left untouched.   npm --prefix backend run xrays:to-db
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();

async function main() {
  const pending = await prisma.xrayStudy.findMany({ where: { fileId: null, filePath: { not: null } } });
  let moved = 0;
  for (const s of pending) {
    const path = resolve(__dirname, '..', 'storage', 'xrays', s.filePath!);
    if (!existsSync(path)) {
      console.log(`missing on disk: ${s.code}`);
      continue;
    }
    const data = readFileSync(path);
    const sha256 = createHash('sha256').update(data).digest('hex');
    const file = await prisma.storedFile.create({
      data: { kind: 'XRAY', fileName: s.originalName, mimeType: s.mimeType, sizeBytes: data.length, sha256, data: new Uint8Array(data), uploadedById: s.uploadedById },
    });
    await prisma.xrayStudy.update({ where: { id: s.id }, data: { fileId: file.id, sha256, sizeBytes: data.length } });
    moved++;
  }
  console.log(`${moved} of ${pending.length} X-rays moved into PostgreSQL.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
