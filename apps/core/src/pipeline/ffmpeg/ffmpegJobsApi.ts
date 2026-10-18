import type {
  FfmpegCompressOptions,
  FfmpegConvertFormat,
  FfmpegConvertImageOptions,
  FfmpegConvertPreset,
} from "../../whitelistedCmd/constants";
import { isFfmpegCompressFormat } from "../../whitelistedCmd/constants";

export interface FfmpegConvertRequest {
  folder: string;
  inputPath: string;
  outputPath: string;
  outputFormat: FfmpegConvertFormat;
  preset: FfmpegConvertPreset;
  title?: string;
  imageOptions?: FfmpegConvertImageOptions;
}

export interface FfmpegCompressRequest {
  folder: string;
  inputPath: string;
  outputPath: string;
  compressOptions: FfmpegCompressOptions;
  title?: string;
}

export interface FfmpegJobHandle {
  id: string;
}

export function assertFfmpegConvertRequest(req: FfmpegConvertRequest): {
  folder: string;
  inputPath: string;
  outputPath: string;
} {
  const folder = req.folder.trim();
  const inputPath = req.inputPath.trim();
  const outputPath = req.outputPath.trim();
  if (!folder) throw new Error("folder is required");
  if (!inputPath) throw new Error("inputPath is required");
  if (!outputPath) throw new Error("outputPath is required");
  if (isFfmpegCompressFormat(req.outputFormat)) {
    throw new Error(
      "compress-* outputFormat is not allowed; use ffmpegCompress instead",
    );
  }
  return { folder, inputPath, outputPath };
}

export function assertFfmpegCompressRequest(req: FfmpegCompressRequest): {
  folder: string;
  inputPath: string;
  outputPath: string;
} {
  const folder = req.folder.trim();
  const inputPath = req.inputPath.trim();
  const outputPath = req.outputPath.trim();
  if (!folder) throw new Error("folder is required");
  if (!inputPath) throw new Error("inputPath is required");
  if (!outputPath) throw new Error("outputPath is required");
  if (typeof req.compressOptions !== "object" || req.compressOptions === null) {
    throw new Error("compressOptions is required");
  }
  if (!req.compressOptions.container) {
    throw new Error("compressOptions.container is required");
  }
  if (!req.compressOptions.videoEncoder) {
    throw new Error("compressOptions.videoEncoder is required");
  }
  return { folder, inputPath, outputPath };
}
