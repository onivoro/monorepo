import { Response } from "express";

export function extractOrigin(res: Response<any, Record<string, any>>, originOverride?: string): string {
    let origin: string | undefined;
    if (originOverride) {
        return originOverride;
    } else {
        // Try to extract from res.headers['origin'] or res.req.headers['origin']
        origin = res.getHeader ? res.getHeader('origin') as string : undefined;
        if (!origin && res.req && res.req.headers) {
            origin = res.req.headers['origin'] as string;
        }
        // Fallback: try referer
        if (!origin && res.req && res.req.headers) {
            origin = res.req.headers['referer'] as string;
        }

        if (origin) {
            origin = origin.endsWith('/') ? origin.slice(0, origin.lastIndexOf('/')) : origin;
        }

        return removePathFromOriginIfPresent(origin || '');
    }
}

function removePathFromOriginIfPresent(origin: string) {
    try {
        const url = new URL(origin);
        // Reconstruct origin: protocol + '//' + host (includes port if present)
        return url.origin;
    } catch {
        // If not a valid URL, return as is
        return origin;
    }
}