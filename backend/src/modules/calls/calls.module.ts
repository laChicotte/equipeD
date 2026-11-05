import { Controller, Get, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CallsService } from './calls.service.js';

@ApiTags('calls')
@Controller('calls')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  /**
   * Configuration WebRTC : serveurs STUN/TURN (identifiants TURN temporaires) et durée de sonnerie.
   * La signalisation passe ensuite par le WebSocket /api/v1/ws (événements call:*).
   */
  @Get('config')
  config(@CurrentUser() user: AuthUser) {
    return this.calls.iceServers(user);
  }
}

@Module({ controllers: [CallsController], providers: [CallsService] })
export class CallsModule {}
