export type FfmpegConvertErrorType =
  | "timeout"
  | "cancelled"
  | "error-rate-exceeded"
  | "encoder-not-found"
  | "decoder-not-found"
  | "muxer-not-found"
  | "demuxer-not-found"
  | "filter-not-found"
  | "invalid-data"
  | "file-not-found"
  | "permission-denied"
  | "disk-full"
  | "out-of-memory"
  | "generic"
  | "unknown";

export interface FfmpegConvertErrorResult {
  type: FfmpegConvertErrorType;
  /** i18n key under dialogs namespace, e.g. formatConverter.errors.encoderNotFound */
  i18nKey: string;
}

const I18N_KEYS: Record<FfmpegConvertErrorType, string> = {
  timeout: "formatConverter.errors.timeout",
  cancelled: "formatConverter.errors.cancelled",
  "error-rate-exceeded": "formatConverter.errors.errorRateExceeded",
  "encoder-not-found": "formatConverter.errors.encoderNotFound",
  "decoder-not-found": "formatConverter.errors.decoderNotFound",
  "muxer-not-found": "formatConverter.errors.muxerNotFound",
  "demuxer-not-found": "formatConverter.errors.demuxerNotFound",
  "filter-not-found": "formatConverter.errors.filterNotFound",
  "invalid-data": "formatConverter.errors.invalidData",
  "file-not-found": "formatConverter.errors.fileNotFound",
  "permission-denied": "formatConverter.errors.permissionDenied",
  "disk-full": "formatConverter.errors.diskFull",
  "out-of-memory": "formatConverter.errors.outOfMemory",
  generic: "formatConverter.errors.generic",
  unknown: "formatConverter.errors.unknown",
};

function result(type: FfmpegConvertErrorType): FfmpegConvertErrorResult {
  return { type, i18nKey: I18N_KEYS[type] };
}

export class FfmpegConvertError extends Error {
  readonly type: FfmpegConvertErrorType;
  readonly i18nKey: string;

  constructor(classified: FfmpegConvertErrorResult) {
    super(classified.i18nKey);
    this.name = "FfmpegConvertError";
    this.type = classified.type;
    this.i18nKey = classified.i18nKey;
  }
}

export function classifyFfmpegConvertError(input: {
  exitCode: number | null;
  stderr: string;
  systemMessage?: string;
}): FfmpegConvertErrorResult {
  const stderr = input.stderr ?? "";
  const systemMessage = input.systemMessage ?? "";

  if (/timed out/i.test(systemMessage)) {
    return result("timeout");
  }

  if (input.exitCode === 123) {
    return result("cancelled");
  }

  if (input.exitCode === 69) {
    return result("error-rate-exceeded");
  }

  const text = `${stderr}\n${systemMessage}`;

  if (/Unknown encoder/i.test(text)) {
    return result("encoder-not-found");
  }
  if (/Unknown decoder/i.test(text)) {
    return result("decoder-not-found");
  }
  if (/Unable to find a suitable output format/i.test(text)) {
    return result("muxer-not-found");
  }
  if (/Unable to find a suitable input format/i.test(text)) {
    return result("demuxer-not-found");
  }
  if (/Filter .+ not found/i.test(text) || /Filter not found/i.test(text)) {
    return result("filter-not-found");
  }
  if (/Invalid data found when processing input/i.test(text)) {
    return result("invalid-data");
  }
  if (/No such file or directory/i.test(text)) {
    return result("file-not-found");
  }
  if (/Permission denied/i.test(text)) {
    return result("permission-denied");
  }
  if (/No space left on device/i.test(text)) {
    return result("disk-full");
  }
  if (/Cannot allocate memory/i.test(text)) {
    return result("out-of-memory");
  }

  if (input.exitCode === 1) {
    logUnknownFfmpegConvertError(stderr, input.exitCode, systemMessage);
    return result("generic");
  }

  logUnknownFfmpegConvertError(stderr, input.exitCode, systemMessage);
  return result("unknown");
}

function logUnknownFfmpegConvertError(
  stderr: string,
  exitCode: number | null,
  systemMessage: string
): void {
  const trimmed = stderr.trim();
  if (!trimmed && !systemMessage) return;
  console.error("[ffmpeg-convert] conversion failed", {
    exitCode,
    systemMessage: systemMessage || undefined,
    stderr: trimmed || undefined,
  });
}
