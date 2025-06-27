import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiResponse } from '@nestjs/swagger';

import { MfaLoginWithEmailAndPasswordDto } from '../dtos/mfa-login-with-email-and-password.dto';
import { MfaLoginService } from '../services/mfa-login.service';
import { LoginWithEmailAndPasswordDto } from '../dtos/login-with-email-and-password.dto';
import { DefaultApiController } from '@onivoro/server/common';

@DefaultApiController('mfa-login')
export class MfaLoginController<TAccessToken> {
   constructor(
      private loginSvc: MfaLoginService<TAccessToken>,
   ) { }

   @Post('password')
   @ApiBody({ type: LoginWithEmailAndPasswordDto })
   @ApiResponse({ type: MfaLoginWithEmailAndPasswordDto })
   async postPassword(@Body() body: LoginWithEmailAndPasswordDto): Promise<MfaLoginWithEmailAndPasswordDto> {
      return await this.loginSvc.postPassword(body);
   }

   @Post('totp')
   @ApiBody({ type: MfaLoginWithEmailAndPasswordDto })
   @ApiResponse({ type: MfaLoginWithEmailAndPasswordDto })
   async postTotp(@Body() body: MfaLoginWithEmailAndPasswordDto): Promise<MfaLoginWithEmailAndPasswordDto> {
      return await this.loginSvc.postTotp(body);
   }
}