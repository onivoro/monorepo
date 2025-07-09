import { readFileSync } from "fs";
import { resolve } from "path";

export function readSslCertificate(
    MACHINE_PATH_PREFIX: string,
    { PG_HOST }: { PG_HOST: string },
    CERTIFICATE_PATH = 'assets/us-east-2-bundle.pem',
): string | undefined {
    const isDnsResolvingToLocalhost = PG_HOST === 'localhost';

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