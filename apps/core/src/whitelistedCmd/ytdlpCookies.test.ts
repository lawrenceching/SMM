import { describe, expect, it } from "vitest";
import {
  buildYtdlpCookiesFilePath,
  isManagedYtdlpCookiesPath,
  parseYtdlpCookiesFileArg,
} from "./ytdlpCookies";

describe("parseYtdlpCookiesFileArg", () => {
  it("returns path after --cookies", () => {
    expect(
      parseYtdlpCookiesFileArg(["-J", "--cookies", "/data/temp/ytdlp-cookies-a.txt", "https://x"]),
    ).toBe("/data/temp/ytdlp-cookies-a.txt");
  });

  it("returns undefined when --cookies is absent", () => {
    expect(parseYtdlpCookiesFileArg(["-J", "https://x"])).toBeUndefined();
  });
});

describe("isManagedYtdlpCookiesPath", () => {
  const userData = "C:/Users/me/AppData/SMM";

  it("accepts managed path under userData/temp", () => {
    expect(
      isManagedYtdlpCookiesPath(
        "C:/Users/me/AppData/SMM/temp/ytdlp-cookies-job-1.txt",
        userData,
      ),
    ).toBe(true);
  });

  it("rejects path outside temp", () => {
    expect(
      isManagedYtdlpCookiesPath("C:/Users/me/AppData/SMM/other/ytdlp-cookies-x.txt", userData),
    ).toBe(false);
  });

  it("rejects non-managed basename", () => {
    expect(
      isManagedYtdlpCookiesPath("C:/Users/me/AppData/SMM/temp/random.txt", userData),
    ).toBe(false);
  });
});

describe("buildYtdlpCookiesFilePath", () => {
  it("places file under userData/temp", () => {
    expect(buildYtdlpCookiesFilePath("/data/user", "job-123")).toBe(
      "/data/user/temp/ytdlp-cookies-job-123.txt",
    );
  });
});
