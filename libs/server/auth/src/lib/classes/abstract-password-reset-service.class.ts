import { BadRequestException } from '@nestjs/common';
import bcrypt from 'bcryptjs';

export type TPasswordResetBase = { createdAt?: number | Date | string, hash: string };

export abstract class AbstractPasswordResetService<TPasswordReset extends TPasswordResetBase> {
    protected abstract _deletePasswordResetByHash(hash: string): Promise<void>;
    protected abstract _getEmailByHash(hash: string): Promise<string | null | undefined>;
    protected abstract _getPasswordResetByEmail(email: string): Promise<TPasswordReset>;
    protected abstract _getPasswordResetByHash(hash: string): Promise<TPasswordReset>;
    protected abstract _onEmailVerified(verification: { email: string, hash: string, password: string, confirm: string }): Promise<boolean>;
    protected abstract _sendResetEmail(email: string, uriEncodedHash: string): Promise<void>;
    protected abstract _createPasswordReset(email: string, hash: string): Promise<TPasswordReset>;

    constructor(public expirationInMilliseconds: number, private saltRounds = 12) { }

    async getPasswordResetByHash(hash: string) {
        const passwordReset = await this._getPasswordResetByHash(hash);

        if (!passwordReset) {
            throw new BadRequestException(`That isn't a valid reset link.`);
        }

        if(passwordReset.createdAt && this.expirationInMilliseconds) {
            if ((Date.now() - +(new Date(passwordReset.createdAt))) > this.expirationInMilliseconds) {
                await this._deletePasswordResetByHash(hash);
                throw new BadRequestException(`That link has expired. Please initiate a new reset.`)
            }
        }

        return passwordReset;
    }

    async startReset(email: string): Promise<TPasswordReset> {
        const existingEntity = await this._getPasswordResetByEmail(email);

        if (existingEntity) {
            await this.sendResetEmail(email, existingEntity.hash);
            return existingEntity;
        }

        const hash = await this.hashEmail(email);
        const record = await this._createPasswordReset(email, hash);

        if (record) {
            await this.sendResetEmail(email, hash);
        }

        return record satisfies TPasswordReset;
    }

    async completeReset(hash: string, password: string, confirm: string) {
        if (confirm !== password) {
            throw new BadRequestException('Passwords must match');
        }

        const existingEntity = await this._getPasswordResetByHash(hash);

        if (!existingEntity) {
            throw new BadRequestException('Reset is not available');
        }

        const email = await this._getEmailByHash(hash);

        if (!email) {
            throw new BadRequestException('No account found');
        } else {
            const result = await this._onEmailVerified({
                hash, email, password, confirm
            });

            if (result) {
                await this._deletePasswordResetByHash(hash);
            }

            return result;
        }
    }

    private async hashEmail(email: string) {
        return await bcrypt.hash(email, this.saltRounds);
    }

    private async sendResetEmail(email: string, hash: string) {
        await this._sendResetEmail(email, encodeURIComponent(hash));
    }
}
