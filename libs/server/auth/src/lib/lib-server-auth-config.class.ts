import { EnvironmentClass } from "@onivoro/server/common";

@EnvironmentClass()
export class LibServerAuthConfig {
  JWT_SECRET: string;
  SENDGRID_API_KEY: string;
  SENDGRID_FROM_ADDRESS: string;
  UI_URL: string;
}
