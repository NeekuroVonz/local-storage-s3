import { Controller, Post, Body, HttpCode, HttpStatus, Req, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/auth.decorators';
import { JwtOnly } from '../../common/decorators/jwt-only.decorator';
import { User } from '../../common/decorators/user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DocumentedEndpoint } from '../../common/swagger/documented-endpoint.decorator';
import { AuthDocs } from '../../common/swagger/docs';
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  changePasswordSchema,
  LoginInput,
  RegisterInput,
  RefreshTokenInput,
  ChangePasswordInput,
} from '@storage/shared';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @DocumentedEndpoint(AuthDocs.register)
  register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput) {
    return this.authService.register(body);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @DocumentedEndpoint(AuthDocs.login)
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
  ) {
    return this.authService.login(body, req.ip, req.headers['user-agent']);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @DocumentedEndpoint(AuthDocs.refresh)
  refresh(@Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenInput) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @JwtOnly()
  @DocumentedEndpoint(AuthDocs.logout)
  async logout(
    @User() user: AuthenticatedUser,
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
  ) {
    await this.authService.logout(user.id, body.refreshToken, req.ip);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @JwtOnly()
  @DocumentedEndpoint(AuthDocs.changePassword)
  async changePassword(
    @User() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
  ) {
    await this.authService.changePassword(user.id, body.currentPassword, body.newPassword);
  }

  @Get('me')
  @ApiBearerAuth()
  @JwtOnly()
  @DocumentedEndpoint(AuthDocs.me)
  me(@User() user: AuthenticatedUser) {
    return { success: true, data: user };
  }
}
