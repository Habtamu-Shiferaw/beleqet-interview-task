// escrow.controller.ts
import { Controller, Post, Body, Param, UseGuards, HttpCode, HttpStatus, Req, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { EscrowService } from './escrow.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Request } from 'express';

@ApiTags('escrow')
@Controller('escrow')
export class EscrowController {
  constructor(
    private readonly svc: EscrowService,
    private readonly config: ConfigService,
  ) {}

  @Post('initiate/:gigId')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  initiate(@Param('gigId') gigId: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.initiate(u.userId, gigId);
  }

  /** Webhook endpoint — verified via Chapa signature header */
  @Post('callback')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Body() payload: Record<string, unknown>,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('chapa-signature') chapaSignature?: string,
    @Headers('x-chapa-signature') xChapaSignature?: string,
  ) {
    const signature = chapaSignature || xChapaSignature;
    const secret = this.config.get<string>('CHAPA_WEBHOOK_SECRET');
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    if (isProduction && (!secret || !req.rawBody || !signature)) {
      throw new UnauthorizedException('Webhook signature verification failed: missing required components');
    }

    if (secret && req.rawBody && signature) {
      const hash = crypto.createHmac('sha256', secret)
        .update(req.rawBody)
        .digest('hex');

      const hashBuf = Buffer.from(hash, 'utf8');
      const signatureBuf = Buffer.from(signature, 'utf8');
      const signatureValid = hashBuf.length === signatureBuf.length && crypto.timingSafeEqual(hashBuf, signatureBuf);
      if (!signatureValid) {
        throw new UnauthorizedException('Invalid Webhook Signature');
      }
    }

    return this.svc.handleWebhook(payload as never);
  }

  @Post('milestones/:id/release')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  release(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.releaseMilestone(id, u.userId);
  }
}
