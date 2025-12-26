import path from 'node:path'
function compare(p: string) {
    const normalized = path.normalize(p);
    return normalized === p;
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