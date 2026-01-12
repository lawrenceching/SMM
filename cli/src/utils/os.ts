import shell from "shelljs";

export function openFile(pathInPlatformFormat: string) {
    const platform = process.platform;

    if (platform === "win32") {
        // Windows: "cmd.exe /c start "" "<path>"
        shell.exec(`cmd.exe /c start "" "${pathInPlatformFormat}"`);
    } else if (platform === "darwin") {
        // macOS: "open -R "<path>"
        shell.exec(`open -R "${pathInPlatformFormat}"`);
    } else if (platform === "linux") {
        // Linux: "xdg-open "<path>"
        shell.exec(`xdg-open "${pathInPlatformFormat}"`);
    } else {
        throw new Error(`Unsupported platform: ${platform}`);
    }
}
