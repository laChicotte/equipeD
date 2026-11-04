import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../database/prisma.service.js';
import { Public } from '../../common/auth/decorators.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Vérifie que l'API répond et que PostgreSQL est joignable. */
  @Public()
  @SkipThrottle()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ code: 'DATABASE_UNAVAILABLE', message: 'Base de données injoignable.' });
    }
    return { status: 'ok', database: 'up', time: new Date().toISOString() };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
