import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AiClientService } from './ai-client.service';
import { ModelRegistryService } from '../model-registry/model-registry.service';

interface AnalyseJob {
  studyId: string;
}

/**
 * Runs the X-ray through the AI service off the request path.
 * Inference plus Grad-CAM takes seconds, which is too long to hold an HTTP connection open.
 */
@Processor('diagnosis')
export class DiagnosisProcessor extends WorkerHost {
  private readonly logger = new Logger(DiagnosisProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiClientService,
    private readonly models: ModelRegistryService,
  ) {
    super();
  }

  async process(job: Job<AnalyseJob>) {
    const { studyId } = job.data;

    await this.prisma.xrayStudy.update({
      where: { id: studyId },
      data: { status: 'PROCESSING' },
    });

    const study = await this.prisma.xrayStudy.findUniqueOrThrow({ where: { id: studyId } });
    const active = await this.models.getActive();
    const out = await this.ai.predict(study.storageKey, true);

    await this.prisma.$transaction([
      this.prisma.diagnosisResult.create({
        data: {
          studyId,
          modelVersionId: active.id,
          predictedLabel: out.label,
          confidence: out.confidence,
          probNormal: out.probabilities.NORMAL,
          probPneumonia: out.probabilities.PNEUMONIA,
          probTb: out.probabilities.TUBERCULOSIS,
          gradcamKey: out.gradcamKey,
          inferenceMs: out.inferenceMs,
        },
      }),
      this.prisma.xrayStudy.update({
        where: { id: studyId },
        data: { status: 'COMPLETED' },
      }),
    ]);

    this.logger.log(`Study ${studyId} -> ${out.label} (${out.confidence})`);
    return { label: out.label };
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<AnalyseJob>, err: Error) {
    this.logger.error(`Study ${job.data.studyId} attempt ${job.attemptsMade} failed: ${err.message}`);
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      await this.prisma.xrayStudy.update({
        where: { id: job.data.studyId },
        data: { status: 'FAILED', failureReason: err.message.slice(0, 500) },
      });
    }
  }
}
