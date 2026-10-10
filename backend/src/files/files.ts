import { Controller, ForbiddenException, Get, Global, Injectable, Module, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { AuthUser, CurrentUser } from '../common/decorators';

export type FileKind = 'XRAY' | 'LICENCE' | 'ATTACHMENT' | 'HEATMAP' | 'PREVIEW';

/** Recognises the real type from the first bytes; the file extension is never trusted. */
export function sniff(buf: Buffer): { ext: 'png' | 'jpg' | 'webp' | 'bmp' | 'dcm' | 'pdf'; mime: string } | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  if (buf.length > 26 && buf[0] === 0x42 && buf[1] === 0x4d) return { ext: 'bmp', mime: 'image/bmp' };
  if (buf.length > 132 && buf.subarray(128, 132).toString() === 'DICM') return { ext: 'dcm', mime: 'application/dicom' };
  if (buf.subarray(0, 5).toString() === '%PDF-') return { ext: 'pdf', mime: 'application/pdf' };
  return null;
}

/**
 * Binary storage inside PostgreSQL (bytea). Keeping X-rays next to their metadata means
 * one backup covers everything and the training-set export is a single query.
 */
@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  async save(kind: FileKind, data: Buffer, fileName: string, mimeType: string, uploadedById?: string) {
    return this.prisma.storedFile.create({
      data: {
        kind,
        data: new Uint8Array(data),
        fileName: fileName.slice(0, 160),
        mimeType,
        sizeBytes: data.length,
        sha256: createHash('sha256').update(data).digest('hex'),
        uploadedById,
      },
      select: { id: true, sha256: true, sizeBytes: true, mimeType: true, fileName: true },
    });
  }

  async read(id: string) {
    const f = await this.prisma.storedFile.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('File not found');
    return f;
  }
}

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** X-rays: doctors and admins. Licences: admins and the doctor who uploaded it. */
  @Get(':id')
  async get(@CurrentUser() me: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const f = await this.files.read(id);
    const allowed =
      me.role === 'ADMIN' ||
      f.uploadedById === me.id ||
      (['XRAY', 'HEATMAP', 'PREVIEW'].includes(f.kind) && me.role === 'DOCTOR');
    if (!allowed) throw new ForbiddenException('You cannot open this file');
    await this.audit.log(me.id, 'file.read', { entity: 'StoredFile', entityId: id, detail: `${f.kind} ${f.fileName}` });
    res.setHeader('Content-Type', f.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${f.fileName.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.send(Buffer.from(f.data));
  }
}

@Global()
@Module({ providers: [FilesService], controllers: [FilesController], exports: [FilesService] })
export class FilesModule {}
