export declare function hello(): string;
export declare function startHttpServer(port: number): boolean;
export declare function stopHttpServer(): void;
export declare function registerSelectFileHandler(handler: () => void): void;
export declare function completeSelectFile(result: string): void;
