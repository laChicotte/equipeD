import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service.js';
import { Public } from '../../common/auth/decorators.js';

@Injectable()
export class DomainsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Domaines actifs, avec le nombre de mentors publiés (donnée réelle, issue de la base). */
  async list() {
    const domains = await this.prisma.expertiseDomain.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        icon: true,
        topics: true,
        _count: {
          select: {
            mentors: {
              where: { mentorProfile: { isPublished: true, user: { status: 'ACTIVE' } } },
            },
          },
        },
      },
    });
    return domains.map(({ _count, ...d }) => ({ ...d, mentorCount: _count.mentors }));
  }
}

@ApiTags('domains')
@Controller('domains')
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  /** Catalogue public des domaines d'accompagnement (TDR, section 5). */
  @Public()
  @Get()
  list() {
    return this.domains.list();
  }
}

@Module({
  controllers: [DomainsController],
  providers: [DomainsService],
  exports: [DomainsService],
})
export class DomainsModule {}
