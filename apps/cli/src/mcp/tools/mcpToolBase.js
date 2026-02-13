"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSuccessResponse = createSuccessResponse;
exports.createErrorResponse = createErrorResponse;
exports.normalizePath = normalizePath;
exports.toPosixPath = toPosixPath;
var path_1 = require("@core/path");
/**
 * Create a success response
 */
function createSuccessResponse(data) {
    return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
    };
}
/**
 * Create an error response
 */
function createErrorResponse(message) {
    return {
        content: [{ type: "text", text: message }],
        isError: true,
    };
}
/**
 * Normalize a path to platform-specific format
 */
function normalizePath(path) {
    return path_1.Path.toPlatformPath(path);
}
/**
 * Convert a path to POSIX format for internal operations
 */
function toPosixPath(path) {
    return path_1.Path.posix(path);
}
