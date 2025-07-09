import { TS3Params } from "../services/s3.service";

export function resolveUrl(region: string, {Bucket, Key}: TS3Params) {
    return Bucket?.includes?.('.')
        ? `https://s3.${region}.amazonaws.com/${Bucket}/${Key}`
        : `https://${Bucket}.s3.${region}.amazonaws.com/${Key}`;
};