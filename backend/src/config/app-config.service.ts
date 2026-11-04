import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from './env.js';

/** Accès typé à la configuration validée. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  get<K extends keyof AppEnv>(key: K): AppEnv[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }
}
