import { Body, Param, Post } from '@nestjs/common';
import { ApiBody, ApiParam, ApiResponse } from '@nestjs/swagger';
import { DefaultApiController, SuccessDto } from '@onivoro/server/common';
import { TotpService } from '../services/totp.service';
import { ServerAuthConfig } from '../classes/server-auth-config.class';
import { TotpGenerationDto } from '../dtos/totp-generation.dto';
import { TotpVerificationDto } from '../dtos/totp-verification.dto';

@DefaultApiController('totp')
export class TotpController {
   constructor(private totpSvc: TotpService, private config: ServerAuthConfig) { }

   @Post('generate/:label')
   @ApiParam({ type: 'string', name: 'label' })
   @ApiResponse({ type: TotpGenerationDto })
   async generate(@Param('label') label: string): Promise<TotpGenerationDto> {
      return await this.totpSvc.generateSecret(this.config.issuer, label);
   }

   @Post('verify')
   @ApiBody({ type: TotpVerificationDto })
   @ApiResponse({ type: SuccessDto })
   verify(@Body() body: TotpVerificationDto): SuccessDto {
      return { success: this.totpSvc.verifyToken(body) !== null };
   }
}