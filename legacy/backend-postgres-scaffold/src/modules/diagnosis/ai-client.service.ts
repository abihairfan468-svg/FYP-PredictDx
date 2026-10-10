import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface PredictResponse {
  label: 'NORMAL' | 'PNEUMONIA' | 'TUBERCULOSIS';
  confidence: number;
  probabilities: { NORMAL: number; PNEUMONIA: number; TUBERCULOSIS: number };
  gradcamKey: string | null;
  inferenceMs: number;
  model: { name: string; version: string };
}

export interface RiskResponse {
  riskScore: number;
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
  horizonMonths: number;
  topFactors: { factor: string; weight: number }[];
}

/**
 * The only component that talks to the Python AI service.
 * The AI service is private: it never receives patient identity, only an image key.
 */
@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get headers() {
    return { 'X-Internal-Key': this.config.get<string>('ai.internalKey') };
  }

  async predict(imageKey: string, withGradcam = true): Promise<PredictResponse> {
    const url = `${this.config.get('ai.url')}/predict`;
    try {
      const { data } = await firstValueFrom(
        this.http.post<PredictResponse>(
          url,
          { imageKey, withGradcam },
          { headers: this.headers, timeout: 60_000 },
        ),
      );
      return data;
    } catch (err) {
      this.logger.error(`AI service /predict failed: ${err.message}`);
      throw new ServiceUnavailableException('AI service unavailable');
    }
  }

  async risk(payload: Record<string, unknown>): Promise<RiskResponse> {
    const url = `${this.config.get('ai.url')}/risk`;
    try {
      const { data } = await firstValueFrom(
        this.http.post<RiskResponse>(url, payload, { headers: this.headers, timeout: 30_000 }),
      );
      return data;
    } catch (err) {
      this.logger.error(`AI service /risk failed: ${err.message}`);
      throw new ServiceUnavailableException('AI service unavailable');
    }
  }

  async health() {
    const { data } = await firstValueFrom(
      this.http.get(`${this.config.get('ai.url')}/health`, { timeout: 5_000 }),
    );
    return data;
  }
}
