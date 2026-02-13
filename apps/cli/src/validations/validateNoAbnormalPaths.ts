import { Path } from '@core/path';
import path from 'node:path';
import pino from 'pino';

const logger = pino();

function compare(p: string) {
    // Relative paths starting with '../' are excluded as they normalize to themselves
    // and are handled separately by the file system
    if (p.startsWith('../')) {
        return true;
    }

    // Check for parent/current directory traversal attempts in absolute paths
    if (p.includes('/..') || p.includes('/./') || p.endsWith('/.')) {
        return false;
    }

    const platform = Path.toPlatformPath(p);
    const normalized = path.normalize(platform);
    const ret = normalized === platform;

    if(!ret) {
        logger.warn({
            path: p,
            platform: platform,
            normalized: normalized,
        }, '[validateNoAbnormalPaths] Path is abnormal');
    }

    return ret;
}

/**
 * Validate there is NO abnormal paths that contains character like ".."
 * which is risky for path validation.
 * This validation method should be called before any other validation methods.
 * @param tasks 
 * @returns error messages
 */
export function validateNoAbnormalPaths(
    tasks: {
        from: string;
        to: string;
    }[],
): string[] {
    const errors: string[] = [];
    for (const task of tasks) {
        if (!task) continue;
        if (!compare(task.from)) {
            errors.push(`Source path "${task.from}" is abnormal`);
        }
        if (!compare(task.to)) {
            errors.push(`Destination path "${task.to}" is abnormal`);
        }
    }
    return errors;
}