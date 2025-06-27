import { freemem, totalmem } from 'node:os';
import { HealthDto } from '../dtos/health.dto';

export function getMemoryStats(): HealthDto {
    const total = totalmem();
    const free = freemem();
    return { free, total, percentUtilization: (free / total) * 100 };
}