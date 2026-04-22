export type Transport = 'http' | 'stdio' | 'both';

export interface ScaffoldOptions {
  projectName: string;
  transport: Transport;
  auth: boolean;
  oauth: boolean;
}
