import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordResetController, PasswordResetService } from './password-reset.js';

@Module({
  controllers: [AuthController, PasswordResetController],
  providers: [AuthService, PasswordResetService],
})
export class AuthModule {}
