/**
 * This script is used to build the SMM desktop application
 */

// @ts-ignore - Node.js built-in module
import path from "path";
// @ts-ignore - Node.js built-in module
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cliDistDirPath = path.resolve(__dirname, "./cli/dist");
console.log("cliDistDirPath (absolute):", cliDistDirPath);
