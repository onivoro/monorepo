import { Injectable } from '@nestjs/common';
import { Secret, TOTP } from 'otpauth';
import { toDataURL } from 'qrcode';
import { TotpGenerationDto } from '../dtos/totp-generation.dto';
import { TotpVerificationDto } from '../dtos/totp-verification.dto';

@Injectable()
export class TotpService {
    period = 30;
    digits = 6;
    algorithm = 'SHA1';
    window = 2;

    async generateSecret(issuer: string, label: string): Promise<TotpGenerationDto> {
        const secret = new Secret({ size: 20 });

        const totp = new TOTP({
            issuer,
            label,
            algorithm: this.algorithm,
            digits: this.digits,
            period: this.period,
            secret
        });

        // otpauth://totp/ACME:AzureDiamond?issuer=ACME&secret=NB2W45DFOIZA&algorithm=SHA1&digits=6&period=30
        const url = totp.toString();

        return { url, secret: secret.base32, qr: await this.generateQrCode(url) };
    }

    verifyToken(params: TotpVerificationDto): number | null {
        const { secret, token } = (params || {});
        const totp = new TOTP({
            secret: Secret.fromBase32(secret),
            algorithm: this.algorithm,
            digits: this.digits,
            period: this.period,
        });

        return totp.validate({ token, window: this.window });
    }

    private async generateQrCode(otpAuthUrl: string) {
        return await toDataURL(otpAuthUrl);
    }
}