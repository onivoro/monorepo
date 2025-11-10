export class AppServerBucketvoreConfig {
    AWS_REGION: string = process.env['AWS_REGION'] || 'us-east-1';
    AWS_PROFILE?: string = process.env['AWS_PROFILE'];
}
