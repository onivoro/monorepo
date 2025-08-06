import { readFileSync } from "fs";
import { resolve } from "path";

export function readSslCertificate(
    MACHINE_PATH_PREFIX: string,
    { PG_HOST }: { PG_HOST: string },
    CERTIFICATE_PATH = 'assets/us-east-2-bundle.pem',
): string | undefined {
    const isDnsResolvingToLocalhost =
        (PG_HOST === 'localhost') ||
        (PG_HOST === '127.0.0.1') ||
        (PG_HOST === '0000:0000:0000:0000:0000:0000:0000:0001') ||
        (PG_HOST === '::1');


    if (isDnsResolvingToLocalhost) {
        return undefined;
    }

    const isRunningInAws = process.env.NODE_ENV === 'production';

    const certificatePath = isRunningInAws
        ? CERTIFICATE_PATH
        : `${MACHINE_PATH_PREFIX}/${CERTIFICATE_PATH}`.replace('//', '/');

    const resolvedCertificatePath = resolve(process.cwd(), certificatePath);

    return readFileSync(resolvedCertificatePath, { encoding: 'utf-8' });
}