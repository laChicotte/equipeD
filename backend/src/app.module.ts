import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module.js';
import { PrismaModule } from './database/prisma.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { SessionAuthGuard } from './common/auth/session-auth.guard.js';
import { RolesGuard } from './common/auth/roles.guard.js';
import { OriginCheckMiddleware } from './common/security/origin-check.middleware.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DomainsModule } from './modules/domains/domains.module.js';
import { ProfileModule } from './modules/profile/profile.module.js';
import { MentorsModule } from './modules/mentors/mentors.module.js';
import { MentorshipRequestsModule } from './modules/mentorship-requests/mentorship-requests.module.js';
import { MentorshipsModule } from './modules/mentorships/mentorships.module.js';
import { SchedulingModule } from './modules/scheduling/scheduling.module.js';
import { MessagesModule } from './modules/messages/messages.module.js';
import { GroupsModule } from './modules/groups/groups.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { CallsModule } from './modules/calls/calls.module.js';
import { GoalsModule } from './modules/goals/goals.module.js';
import { GuidedPathsModule } from './modules/guided-paths/guided-paths.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ResourcesModule } from './modules/resources/resources.module.js';
import { OpportunitiesModule } from './modules/opportunities/opportunities.module.js';
import { CertificatesModule } from './modules/certificates/certificates.module.js';
import { PlatformModule } from './modules/platform/platform.module.js';
import { VerificationModule } from './modules/verification/verification.module.js';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    // Limite globale par IP ; des limites plus strictes s'appliquent à l'auth et aux messages.
    // Désactivée en NODE_ENV=test pour que la suite e2e (nombreuses connexions) reste déterministe.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    HealthModule,
    AuthModule,
    DomainsModule,
    ProfileModule,
    MentorsModule,
    MentorshipRequestsModule,
    MentorshipsModule,
    SchedulingModule,
    MessagesModule,
    GroupsModule,
    RealtimeModule,
    CallsModule,
    GoalsModule,
    GuidedPathsModule,
    DashboardModule,
    AdminModule,
    NotificationsModule,
    ResourcesModule,
    OpportunitiesModule,
    CertificatesModule,
    PlatformModule,
    VerificationModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Ordre : limitation de débit → authentification → rôle.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(OriginCheckMiddleware).forRoutes('{*path}');
  }
}
