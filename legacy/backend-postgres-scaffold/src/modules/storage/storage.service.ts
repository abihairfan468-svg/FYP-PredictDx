import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, join, extname } from 'path';

/**
 * Object storage abstraction.
 * Development: local disk. Production: swap the body of these methods for MinIO / S3.
 * Rule of the project: images live here, the database stores only the key.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = config.get<string>('storage.localPath') ?? './storage';
  }

  async onModuleInit() {
    await fs.mkdir(this.root, { recursive: true });
  }

  /** Stores a buffer under a generated key and returns the key plus its checksum. */
  async put(buffer: Buffer, prefix: string, originalName: string) {
    const checksum = createHash('sha256').update(buffer).digest('hex');
    const key = `${prefix}/${randomUUID()}${extname(originalName).toLowerCase()}`;
    const target = join(this.root, key);

    await fs.mkdir(dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);

    return { key, checksum, sizeBytes: buffer.length };
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(join(this.root, key));
  }

  async remove(key: string) {
    await fs.rm(join(this.root, key), { force: true });
  }

  /**
   * Time-limited URL for the client. With S3 this becomes a presigned URL;
   * on local disk it is a route on this API guarded by the JWT.
   */
  signedUrl(key: string, ttlSeconds = 300) {
    const expires = Date.now() + ttlSeconds * 1000;
    return `/api/v1/files/${encodeURIComponent(key)}?expires=${expires}`;
  }
}
