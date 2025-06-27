import { ApiPropertyOptional } from "@nestjs/swagger";
import { LoginWithEmailAndPasswordDto } from "./login-with-email-and-password.dto";

export class MfaLoginWithEmailAndPasswordDto extends LoginWithEmailAndPasswordDto {
    @ApiPropertyOptional({ type: 'string' }) token?: string;
    @ApiPropertyOptional({ type: 'boolean' }) totpEnabled?: boolean;
}
