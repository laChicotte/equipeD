import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailVerificationController, EmailVerificationService } from './email-verification.js';
import { PasswordResetController, PasswordResetService } from './password-reset.js';

@Module({
  controllers: [AuthController, PasswordResetController, EmailVerificationController],
  providers: [AuthService, PasswordResetService, EmailVerificationService],
})
export class AuthModule {}
