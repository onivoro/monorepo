import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { MfaLoginWithEmailAndPasswordDto } from '../dtos/mfa-login-with-email-and-password.dto';
import { LoginService } from './login.service';
import { comparePassword } from '../functions/compare-password.function';
import { LoginWithEmailAndPasswordDto } from '../dtos/login-with-email-and-password.dto';
import { TotpService } from './totp.service';

const fail = () => { throw new BadRequestException('The credentials are incorrect or the account does not exist.'); };

@Injectable()
export class MfaLoginService<TAccessToken> {
  async postTotp(body: MfaLoginWithEmailAndPasswordDto): Promise<MfaLoginWithEmailAndPasswordDto> {
    const { email, password, token } = body || {};

    if (!email || !password || !token) {
      throw new BadRequestException(`Email, password, and token are required`);
    }

    const _ = await this.resolveCredentials(email);
    const response: MfaLoginWithEmailAndPasswordDto = { email, password, totpEnabled: _.totpEnabled };

    if (!_) {
      throw new BadRequestException(`It seems like you don't have an account`);
    }

    if (await comparePassword(password, _?.password)) {
      if (_.totpEnabled) {

        if (!_.secret) {
          throw new InternalServerErrorException(`User does not have a secret defined. MFA must be disabled by an admin and re-initialized for "${email}"`);
        }

        if (this.totpService.verifyToken({ token, secret: _.secret }) !== null) {
          response.token = await this.loginSvc.loginWithEmailAndPassword(body);
        } else {
          throw new BadRequestException('That code is invalid');
        }
      } else {
        throw new BadRequestException(`This account isn't configured for MFA`);
      }
    } else {
      throw new BadRequestException(`Either the password is incorrect or the account doesn't exist`);
    }

    return response;
  }

  async postPassword(body: LoginWithEmailAndPasswordDto): Promise<MfaLoginWithEmailAndPasswordDto> {
    const { email, password } = body || {};

    if (!email || !password) {
      throw new BadRequestException(`Email and password are required`);
    }

    const _ = await this.resolveCredentials(email);


    if (!_.password) {
      throw new BadRequestException(`It seems like you don't have an account`);
    }

    if (await comparePassword(password, _?.password)) {
      const response: MfaLoginWithEmailAndPasswordDto = {
        email,
        password,
        totpEnabled: _.totpEnabled
      };

      if (!_.totpEnabled) {
        response.token = await this.loginSvc.loginWithEmailAndPassword(body);
      }

      return response;
    } else {
      throw new BadRequestException(`Either the password is incorrect or the account doesn't exist`);
    }
  }

  async resolveCredentials(email: string): Promise<{ password: string, totpEnabled?: boolean, secret?: string }> {
    return {} as any;
  }

  constructor(
    private totpService: TotpService,
    private loginSvc: LoginService<TAccessToken>,
  ) { }
}
