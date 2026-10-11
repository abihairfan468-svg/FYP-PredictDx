import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Logger,
  Module,
  NotFoundException,
  OnModuleInit,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import type { Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { memoryStorage } from 'multer';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { NotificationsService } from '../notifications/notifications';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuthUser, CurrentUser, Roles } from '../common/decorators';
import { parseJson, shortCode } from '../common/util';
import { FilesService, sniff } from '../files/files';

const STORAGE = resolve(process.cwd(), 'storage', 'xrays');
const MAX_BYTES = 20 * 1024 * 1024;
const AI_URL = () => process.env.AI_SERVICE_URL ?? 'http://localhost:8000';
const AI_TIMEOUT_MS = 90_000;

export const PIPELINE = [
  'Preparing the image',
  'Checking it is a chest X-ray',
  'Checking for pneumonia and tuberculosis',
  'Locating affected regions',
  'Estimating future risk',
];

class ReportDto {
  @IsOptional() @IsInt() @Min(0) @Max(50) acceptedFindings?: number;
}

/** Symptoms and history the doctor can add; they feed the future-risk estimate. */
class ClinicalDto {
  @IsOptional() @IsInt() @Min(0) @Max(120) age?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) coughDays?: number;
  @IsOptional() @IsInt() @Min(50) @Max(100) spo2?: number;
  @IsOptional() @IsBoolean() fever?: boolean;
  @IsOptional() @IsBoolean() weightLoss?: boolean;
  @IsOptional() @IsBoolean() nightSweats?: boolean;
  @IsOptional() @IsBoolean() breathlessness?: boolean;
  @IsOptional() @IsBoolean() smoker?: boolean;
  @IsOptional() @IsBoolean() diabetes?: boolean;
  @IsOptional() @IsBoolean() hivPositive?: boolean;
  @IsOptional() @IsBoolean() tbContact?: boolean;
  @IsOptional() @IsBoolean() priorTb?: boolean;
}

class AnalyseDto {
  @IsOptional() @ValidateNested() @Type(() => ClinicalDto) clinical?: ClinicalDto;
}

class AiUnavailable extends Error {}

class LabelDto {
  @IsIn(['NORMAL', 'PNEUMONIA', 'TUBERCULOSIS', 'OTHER']) label!: string;
}

class UploadDto {
  @IsUUID() patientId!: string;
  @IsOptional() @IsIn(['PA', 'AP', 'LATERAL']) view?: string;
}


/**
 * 7.4 Smart Diagnosis Center.
 * Upload and storage live here; the analysis itself runs in the Python AI service
 * (ai-service/, DenseNet-121 trained on our chest X-ray dataset) which this controller calls.
 */
@ApiTags('7.4 Smart Diagnosis Center')
@ApiBearerAuth()
@Roles('DOCTOR', 'ADMIN')
@Controller('diagnosis')
export class DiagnosisController implements OnModuleInit {
  private readonly log = new Logger('Diagnosis');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rt: RealtimeGateway,
    private readonly notifications: NotificationsService,
    private readonly files: FilesService,
  ) {}

  /** Analyses run inside this process, so any study still marked ANALYSING at start-up was cut off by a restart. */
  async onModuleInit() {
    const stuck = await this.prisma.xrayStudy.updateMany({ where: { status: 'ANALYSING' }, data: { status: 'UPLOADED' } });
    if (stuck.count) this.log.warn(`Reset ${stuck.count} study(ies) left in ANALYSING by a restart`);
  }

  @Get('training')
  training() {
    const file = resolve(process.cwd(), 'ai-training-status.json');
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { status: 'not started' };
  }

  @Get('studies')
  async studies() {
    const rows = await this.prisma.xrayStudy.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { patient: { include: { user: { select: { fullName: true } } } } },
    });
    return rows.map((s) => ({
      id: s.id,
      code: s.code,
      patient: { id: s.patientId, name: s.patient.user.fullName, mrn: s.patient.mrn },
      view: s.view,
      status: s.status,
      originalName: s.originalName,
      sizeBytes: s.sizeBytes,
      createdAt: s.createdAt,
      modelVersion: s.modelVersion,
      verifiedLabel: s.verifiedLabel,
      result: parseJson(s.result, null),
    }));
  }

  @Post('studies')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_BYTES } }))
  async upload(@CurrentUser() me: AuthUser, @UploadedFile() file: Express.Multer.File | undefined, @Body() dto: UploadDto) {
    if (!file) throw new BadRequestException('Choose a chest X-ray to upload');
    const kind = sniff(file.buffer);
    if (!kind || kind.ext === 'pdf') throw new BadRequestException('Only PNG, JPG, WEBP, BMP or DICOM chest X-rays are accepted');
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    const stored = await this.files.save('XRAY', file.buffer, file.originalname || `xray.${kind.ext}`, kind.mime, me.id);
    const study = await this.prisma.xrayStudy.create({
      data: {
        code: `${patient.mrn}-${shortCode('S').slice(2)}`,
        patientId: patient.id,
        uploadedById: me.id,
        fileId: stored.id,
        sha256: stored.sha256,
        originalName: file.originalname.slice(0, 120),
        mimeType: kind.mime,
        sizeBytes: file.size,
        view: dto.view ?? 'PA',
      },
    });
    await this.audit.log(me.id, 'diagnosis.uploaded', { entity: 'XrayStudy', entityId: study.id, detail: study.code });
    return { id: study.id, code: study.code, status: study.status };
  }

  @Get('studies/:id/image')
  async image(@Param('id') id: string, @Res() res: Response) {
    const s = await this.prisma.xrayStudy.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Study not found');
    if (s.mimeType === 'application/dicom') {
      // browsers cannot show DICOM; serve the PNG copy the AI service made during analysis
      const previewId = parseJson<any>(s.result, null)?.previewFileId;
      if (!previewId) throw new NotFoundException('Run the analysis to see a preview of this DICOM file');
      return this.sendFile(res, previewId);
    }
    res.setHeader('Content-Type', s.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.send(await this.bytes(s));
  }

  /** Transparent PNG of the model's activation map, the same shape as the X-ray. */
  @Get('studies/:id/heatmap')
  async heatmap(@Param('id') id: string, @Res() res: Response) {
    const s = await this.prisma.xrayStudy.findUnique({ where: { id } });
    const fileId = parseJson<any>(s?.result, null)?.heatmapFileId;
    if (!fileId) throw new NotFoundException('No heatmap for this study');
    return this.sendFile(res, fileId);
  }

  private async sendFile(res: Response, fileId: string) {
    const f = await this.files.read(fileId);
    res.setHeader('Content-Type', f.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=600');
    res.send(Buffer.from(f.data));
  }

  /**
   * Sends the X-ray (and any symptoms) to the AI service and streams the pipeline steps to the
   * doctor over Socket.IO while it runs. Images that are not chest X-rays are REJECTED, not diagnosed.
   */
  @HttpCode(202)
  @Post('studies/:id/analyse')
  async analyse(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: AnalyseDto) {
    const s = await this.prisma.xrayStudy.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Study not found');
    if (s.status === 'ANALYSING') throw new ConflictException('Analysis already running');
    await this.prisma.xrayStudy.update({ where: { id }, data: { status: 'ANALYSING' } });

    void (async () => {
      let finished = false;
      // settle into a value straight away: a rejection left waiting during the animation below
      // would be an unhandled rejection and take the whole API process down
      const call = this.callAi(s, dto.clinical).then(
        (r) => ({ ok: true as const, r }),
        (e: unknown) => ({ ok: false as const, e }),
      ).finally(() => (finished = true));
      // show the steps while the model runs; never finish the animation before the answer is in
      for (let step = 0; step < PIPELINE.length - 1; step++) {
        this.rt.toUser(me.id, 'study:progress', { id, step, steps: PIPELINE });
        await new Promise((r) => setTimeout(r, finished ? 250 : 600));
      }
      this.rt.toUser(me.id, 'study:progress', { id, step: PIPELINE.length - 1, steps: PIPELINE });
      const outcome = await call;
      if (!outcome.ok) throw outcome.e;
      const ai = outcome.r;

      if (!ai.isChestXray) {
        const result = {
          isChestXray: false, reason: ai.reason, notCxrProbability: ai.notCxrProbability,
          gateSimilarity: ai.gateSimilarity, inferenceMs: ai.inferenceMs, model: ai.model,
        };
        await this.prisma.xrayStudy.update({ where: { id }, data: { status: 'REJECTED', result: JSON.stringify(result), modelVersion: ai.model.version } });
        await this.audit.log(me.id, 'diagnosis.rejected_not_cxr', { entity: 'XrayStudy', entityId: id, detail: s.code });
        this.rt.toUser(me.id, 'study:rejected', { id, reason: ai.reason });
        return;
      }

      const heat = await this.files.save('HEATMAP', Buffer.from(ai.heatmapPng, 'base64'), `${s.code}-heatmap.png`, 'image/png', me.id);
      const preview = ai.previewPng
        ? await this.files.save('PREVIEW', Buffer.from(ai.previewPng, 'base64'), `${s.code}-preview.png`, 'image/png', me.id)
        : null;
      const r = ai.risk;
      const result = {
        isChestXray: true,
        label: ai.label,
        labelKey: ai.labelKey,
        confidence: ai.confidence,
        probabilities: ai.probabilities,
        gatePassed: ai.gatePassed,
        assessment: ai.assessment,
        regions: ai.regions,
        risk: {
          score: Math.round(r.riskScore * 100),
          band: ({ LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' } as Record<string, string>)[r.riskBand],
          condition: r.condition === 'TUBERCULOSIS' ? 'Tuberculosis' : 'Pneumonia',
          horizonMonths: r.horizonMonths,
          followUp: r.followUp,
          topFactors: r.topFactors,
          clinicalProvided: r.clinicalProvided,
          method: r.method,
        },
        clinical: dto.clinical ?? null,
        heatmapFileId: heat.id,
        previewFileId: preview?.id ?? null,
        imageSize: ai.imageSize,
        notCxrProbability: ai.notCxrProbability,
        gateSimilarity: ai.gateSimilarity,
        inferenceMs: ai.inferenceMs,
        model: ai.model,
      };
      await this.prisma.xrayStudy.update({ where: { id }, data: { status: 'ANALYSED', result: JSON.stringify(result), modelVersion: ai.model.version } });
      await this.audit.log(me.id, 'diagnosis.analysed', { entity: 'XrayStudy', entityId: id, detail: `${result.label} ${result.confidence}% · ${result.assessment.band}` });
      this.rt.toUser(me.id, 'study:done', { id, result, modelVersion: ai.model.version });
    })().catch(async (e) => {
      this.log.error(e instanceof Error ? e.message : e);
      await this.prisma.xrayStudy.update({ where: { id }, data: { status: s.result ? s.status : 'FAILED' } });
      const message = e instanceof AiUnavailable ? e.message : 'The analysis failed. Try again.';
      this.rt.toUser(me.id, 'study:failed', { id, message });
    });
    return { id, status: 'ANALYSING', steps: PIPELINE };
  }

  /** POST the image to the Python AI service (ai-service/app/main.py /analyse). */
  private async callAi(s: { fileId: string | null; filePath: string | null; mimeType: string; originalName: string }, clinical?: ClinicalDto) {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(await this.bytes(s))], { type: s.mimeType }), s.originalName || 'xray');
    if (clinical) form.append('clinical', JSON.stringify(clinical));
    let res: globalThis.Response;
    try {
      res = await fetch(`${AI_URL()}/analyse`, {
        method: 'POST',
        headers: { 'X-Internal-Key': process.env.AI_INTERNAL_KEY ?? '' },
        body: form,
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      });
    } catch {
      throw new AiUnavailable(process.env.NODE_ENV === 'production'
        ? 'The AI service is not reachable right now. Please try again in a minute.'
        : 'The AI service is not running. Start it with npm run dev (it takes about 20 seconds to load the model).');
    }
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new AiUnavailable(detail?.detail ? `AI service: ${detail.detail}` : `AI service error (${res.status})`);
    }
    return (await res.json()) as any;
  }

  private async bytes(s: { fileId: string | null; filePath: string | null }) {
    if (s.fileId) return Buffer.from((await this.files.read(s.fileId)).data);
    if (s.filePath && existsSync(join(STORAGE, s.filePath))) return readFileSync(join(STORAGE, s.filePath));
    throw new NotFoundException('The image for this study is missing');
  }

  /** The doctor's confirmed diagnosis - the ground-truth label used to train the AI model. */
  @Patch('studies/:id/label')
  async label(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: LabelDto) {
    const s = await this.prisma.xrayStudy.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Study not found');
    const u = await this.prisma.xrayStudy.update({
      where: { id },
      data: { verifiedLabel: dto.label, verifiedById: me.id, verifiedAt: new Date() },
    });
    await this.audit.log(me.id, 'diagnosis.labelled', { entity: 'XrayStudy', entityId: id, detail: `${s.code} ${dto.label}` });
    return { id: u.id, verifiedLabel: u.verifiedLabel, verifiedAt: u.verifiedAt };
  }

  /** How many confirmed X-rays of each class are ready for model training. */
  @Get('dataset')
  async dataset() {
    const groups = await this.prisma.xrayStudy.groupBy({ by: ['verifiedLabel'], _count: true, where: { trainingUse: true } });
    const counts = Object.fromEntries(groups.map((g) => [g.verifiedLabel ?? 'UNLABELLED', g._count]));
    return { counts, total: groups.reduce((a, g) => a + g._count, 0) };
  }

  private async analysed(id: string) {
    const s = await this.prisma.xrayStudy.findUnique({ where: { id }, include: { patient: { include: { user: true } } } });
    if (!s) throw new NotFoundException('Study not found');
    const result = parseJson<any>(s.result, null);
    if (s.status !== 'ANALYSED' || !result) throw new ConflictException('Run the AI analysis first');
    return { s, result };
  }

  /** Files a signed AI diagnostic report into the patient's Reports & Care Records and tells the patient. */
  @HttpCode(200)
  @Post('studies/:id/report')
  async report(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() body: ReportDto) {
    const { s, result } = await this.analysed(id);
    const existing = await this.prisma.record.findFirst({ where: { refId: s.id, kind: 'AI report' } });
    if (existing) throw new ConflictException('A report for this study is already in the patient record');
    const probs = Object.entries(result.probabilities as Record<string, number>).sort((a, b) => b[1] - a[1]);
    const taken = s.createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const risk = result.risk;
    const lines = [
      `Study ${s.code} · ${s.view} view · ${taken}`,
      `AI assessment: ${({ NORMAL: 'Normal', SUSPICIOUS: 'Subtle finding - follow-up advised', DISEASE: 'Disease pattern detected' } as Record<string, string>)[result.assessment?.band] ?? result.label}`,
      `Primary finding: ${result.label} (${result.confidence}% confidence)`,
      `Class probabilities: ${probs.map(([k, v]) => `${k} ${v}%`).join(', ')}`,
      ...(result.regions as { label: string; score: number }[]).map((r) => `Region: ${r.label} (score ${r.score})`),
      `Future risk (${risk.condition}, ${risk.horizonMonths} months): ${risk.band} (${risk.score}/100)${risk.clinicalProvided ? '' : ' - X-ray only, no symptoms entered'}`,
      ...(risk.topFactors?.length ? [`Main factors: ${risk.topFactors.map((f: { factor: string }) => f.factor).join(', ')}`] : []),
      `Recommended follow-up: ${risk.followUp}`,
      ...(body.acceptedFindings ? [`Findings confirmed by the doctor: ${body.acceptedFindings}`] : []),
      result.gatePassed ? 'Above the 70% confidence threshold.' : 'Below the 70% confidence threshold - radiologist review recommended.',
      `Model: ${s.modelVersion ?? 'unknown'} (DenseNet-121). AI results support, and never replace, a physician's judgement.`,
      `Reviewed and signed by ${me.fullName}`,
    ];
    await this.prisma.record.create({
      data: {
        patientId: s.patientId,
        kind: 'AI report',
        title: `AI chest X-ray analysis · ${s.code}`,
        source: 'Smart Diagnosis Center',
        body: lines.join('\n'),
        refId: s.id,
      },
    });
    await this.audit.log(me.id, 'diagnosis.report_filed', { entity: 'XrayStudy', entityId: s.id, detail: s.code });
    await this.notifications.notify(s.patient.userId, 'report.ready', 'Report ready', `AI chest X-ray analysis ${s.code} · signed by ${me.fullName}`, '/app/records');
    return { message: `Report filed in ${s.patient.user.fullName}'s records` };
  }

  /** Refers the study to the radiologists for a second read. */
  @HttpCode(200)
  @Post('studies/:id/refer')
  async refer(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    const { s, result } = await this.analysed(id);
    const radiologists = await this.prisma.doctor.findMany({ where: { specialization: 'Radiology', verified: true, user: { status: 'ACTIVE' } }, include: { user: true } });
    if (!radiologists.length) throw new NotFoundException('No radiologist is available right now');
    for (const r of radiologists) {
      await this.notifications.notify(
        r.userId,
        'study.referred',
        'X-ray referred for review',
        `${me.fullName} referred ${s.code} (${s.patient.user.fullName}) · AI: ${result.label} ${result.confidence}%`,
        '/app/diagnosis',
      );
    }
    await this.audit.log(me.id, 'diagnosis.referred', { entity: 'XrayStudy', entityId: s.id, detail: s.code });
    return { message: `Sent to ${radiologists.map((r) => r.user.fullName).join(', ')} for review` };
  }
}

@Module({ controllers: [DiagnosisController] })
export class DiagnosisModule {}
