import shell from "shelljs";

/**
 * Check if the process is running in a desktop environment
 * - Windows and macOS are always considered desktop environments
 * - Linux: checks for DISPLAY environment variable (X11/Wayland)
 * @returns true if running in a desktop environment, false otherwise
 */
export function isDesktopEnv(): boolean {
    const platform = process.platform;
    
    // Windows and macOS are always desktop environments
    if (platform === 'win32' || platform === 'darwin') {
        return true;
    }
    
    // Linux: check for DISPLAY environment variable
    if (platform === 'linux') {
        return !!process.env.DISPLAY;
    }
    
    // Other platforms: assume not desktop
    return false;
}

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
