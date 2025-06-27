import { BadRequestException, Injectable } from '@nestjs/common';

import { LoginWithApiCredentialsDto } from '../dtos/login-with-api-credentials.dto';
import { LoginWithEmailAndPasswordDto } from '../dtos/login-with-email-and-password.dto';
import { ServerAuthConfig } from '../classes/server-auth-config.class';
import { TokenBuilder } from '../classes/token-builder.class';

const fail = () => { throw new BadRequestException('The credentials are incorrect or the account does not exist.'); };

@Injectable()
export class LoginService<TAccessToken> {
  authCallback: (token: TAccessToken | null | undefined) => void;

  constructor(
    private tokenBuilder: TokenBuilder<TAccessToken>,
    private config: ServerAuthConfig,
  ) { }

  async loginWithApiCredentials(credentials: LoginWithApiCredentialsDto): Promise<string> {
    return await this.login(credentials, async creds => await this.tokenBuilder.byApiCredentials(creds));
  }

  async loginWithEmailAndPassword(credentials: LoginWithEmailAndPasswordDto): Promise<string> {
    return await this.login(credentials, async creds => await this.tokenBuilder.byEmailAndPassword(creds));
  }

  async login<TCredentials>(creds: TCredentials, resolver: (creds: TCredentials) => Promise<TAccessToken>): Promise<string> {
    try {
      const token = await resolver(creds);

      if (token) {

        if (this.authCallback) {
          this.authCallback(token);
        }

        return this.sign(token);
      }

      fail();

    } catch (error: any) {
      console.error(error);
      fail();
    }

    return '';
  }

  sign(payload: any) {
    return TokenBuilder.sign({ jwtSecret: this.config.JWT_SECRET, expiresIn: this.config.expiresIn }, payload);
  }
}
