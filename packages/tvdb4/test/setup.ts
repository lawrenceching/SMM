import pino from "pino";

export const TVDB_API_KEY = process.env.TVDB_API_KEY;

export const hasApiKey = (): boolean => {
  return typeof TVDB_API_KEY === "string" && TVDB_API_KEY.length > 0;
};

export const testLogger = pino({
  level: "trace",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "HH:MM:ss.l",
      ignore: "pid,hostname",
    },
  },
});
