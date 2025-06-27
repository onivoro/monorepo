import { TJwtExpiresIn } from "../types/jwt-expires-in.type";

export class ServerAuthConfig {
    public JWT_SECRET: string;
    public expiresIn: TJwtExpiresIn = '3hr';
    public issuer: string
  }
