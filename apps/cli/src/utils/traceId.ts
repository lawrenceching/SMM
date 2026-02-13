let counter = 1;
export function nextTraceId(): string {
    return `${counter++}`;
}