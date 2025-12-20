export function isError(error: string, message: string) {
    return error.startsWith(`${message}:`)

}

export const ExistedFileError = 'File Already Existed';
export function existedFileError(path: string): string {
    return `${ExistedFileError}: ${path}`;
}
