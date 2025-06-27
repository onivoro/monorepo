import { Injectable } from "@nestjs/common";
import { LoginWithEmailAndPasswordDto } from "../dtos/login-with-email-and-password.dto";
import { LoginWithApiCredentialsDto } from "../dtos/login-with-api-credentials.dto";
import { sign } from 'jsonwebtoken';
import { TJwtExpiresIn } from "../types/jwt-expires-in.type";

@Injectable()
export class TokenBuilder<TAccessToken> {
    async byEmailAndPassword(creds: LoginWithEmailAndPasswordDto): Promise<TAccessToken> {
        return {} as TAccessToken;
    }
    async byApiCredentials(creds: LoginWithApiCredentialsDto): Promise<TAccessToken> {
        return {} as TAccessToken;
    }

    static sign(_: { jwtSecret: string, expiresIn: TJwtExpiresIn }, payload: any) {
        const { jwtSecret, expiresIn } = _;
        return sign(payload, jwtSecret, { expiresIn });
    }
}