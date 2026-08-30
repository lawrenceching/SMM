/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaDatabaseSettings } from "./useMediaDatabaseSettings";
import type { UserConfig } from "@smm/types";

const defaultUserConfig: UserConfig = {
  tmdb: {},
  tvdb: {},
  folders: [],
  renameRules: [],
  dryRun: false,
  selectedRenameRule: "",
};

const mockUseConfig = vi.fn();
const mockMutateAsync = vi.fn();
const mockUseSaveUserConfigMutation = vi.fn();

vi.mock("@/hooks/userConfig", () => ({
  useConfig: () => mockUseConfig(),
  useSaveUserConfigMutation: () => mockUseSaveUserConfigMutation(),
}));

vi.mock("@/lib/utils", () => ({
  nextTraceId: () => "test-trace-id",
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function setupMocks(overrides?: {
  userConfig?: Partial<UserConfig>;
  isLoading?: boolean;
  isPending?: boolean;
  mutationError?: Error | null;
}) {
  const {
    userConfig = {},
    isLoading = false,
    isPending = false,
    mutationError = null,
  } = overrides ?? {};

  mockMutateAsync.mockResolvedValue(undefined);
  mockUseSaveUserConfigMutation.mockReturnValue({
    isPending,
    error: mutationError,
    mutateAsync: mockMutateAsync,
  });
  mockUseConfig.mockReturnValue({
    userConfig: { ...defaultUserConfig, ...userConfig },
    isLoading,
  });
}

describe("useMediaDatabaseSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization from userConfig", () => {
    it("returns empty strings when config fields are undefined", () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());

      expect(result.current.form.tmdbHost).toBe("");
      expect(result.current.form.tmdbApiKey).toBe("");
      expect(result.current.form.tmdbProxy).toBe("");
      expect(result.current.form.tvdbHost).toBe("");
      expect(result.current.form.tvdbApiKey).toBe("");
      expect(result.current.form.tvdbProxy).toBe("");
    });

    it("defaults primaryDatabase to TMDB", () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());
      expect(result.current.form.primaryDatabase).toBe("TMDB");
    });

    it("reads values from userConfig", () => {
      setupMocks({
        userConfig: {
          tmdb: { host: "https://tmdb.example.com", apiKey: "tmdb-key", httpProxy: "http://tmdb-proxy:8080" },
          tvdb: { host: "https://tvdb.example.com", apiKey: "tvdb-key", httpProxy: "http://tvdb-proxy:3128" },
          primaryDatabase: "TVDB",
        },
      });
      const { result } = renderHook(() => useMediaDatabaseSettings());

      expect(result.current.form.tmdbHost).toBe("https://tmdb.example.com");
      expect(result.current.form.tmdbApiKey).toBe("tmdb-key");
      expect(result.current.form.tmdbProxy).toBe("http://tmdb-proxy:8080");
      expect(result.current.form.tvdbHost).toBe("https://tvdb.example.com");
      expect(result.current.form.tvdbApiKey).toBe("tvdb-key");
      expect(result.current.form.tvdbProxy).toBe("http://tvdb-proxy:3128");
      expect(result.current.form.primaryDatabase).toBe("TVDB");
    });

    it("uses primaryDatabase from config", () => {
      setupMocks({ userConfig: { primaryDatabase: "TVDB" } });
      const { result } = renderHook(() => useMediaDatabaseSettings());
      expect(result.current.form.primaryDatabase).toBe("TVDB");
    });
  });

  describe("isLoading", () => {
    it("reflects useConfig isLoading", () => {
      setupMocks({ isLoading: true });
      const { result } = renderHook(() => useMediaDatabaseSettings());
      expect(result.current.isLoading).toBe(true);
    });

    it("is false when config is loaded", () => {
      setupMocks({ isLoading: false });
      const { result } = renderHook(() => useMediaDatabaseSettings());
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("isSaving", () => {
    it("reflects saveMutation isPending", () => {
      setupMocks({ isPending: true });
      const { result } = renderHook(() => useMediaDatabaseSettings());
      expect(result.current.isSaving).toBe(true);
    });

    it("is false when not saving", () => {
      setupMocks({ isPending: false });
      const { result } = renderHook(() => useMediaDatabaseSettings());
      expect(result.current.isSaving).toBe(false);
    });
  });

  describe("saveError", () => {
    it("returns null when there is no error", () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());
      expect(result.current.saveError).toBeNull();
    });

    it("returns mutation error", () => {
      const error = new Error("Network failure");
      setupMocks({ mutationError: error });
      const { result } = renderHook(() => useMediaDatabaseSettings());
      expect(result.current.saveError).toBe(error);
    });
  });

  describe("hasChanges", () => {
    it("is false when form matches initial values", () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());
      expect(result.current.hasChanges).toBe(false);
    });

    it("is true when tmdbHost changes", () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());

      act(() => {
        result.current.form.setTmdbHost("https://other.example.com");
      });

      expect(result.current.hasChanges).toBe(true);
    });

    it("is true when primaryDatabase changes", () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());

      act(() => {
        result.current.form.setPrimaryDatabase("TVDB");
      });

      expect(result.current.hasChanges).toBe(true);
    });

    it("is false after onReset restores initial values", () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());

      act(() => {
        result.current.form.setTmdbHost("https://other.example.com");
      });
      expect(result.current.hasChanges).toBe(true);

      act(() => {
        result.current.onReset();
      });
      expect(result.current.hasChanges).toBe(false);
    });
  });

  describe("validation (errors / hasUrlErrors)", () => {
    it("has no errors when all fields are empty", () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());

      expect(result.current.errors.tmdbHost).toBeUndefined();
      expect(result.current.errors.tmdbProxy).toBeUndefined();
      expect(result.current.errors.tvdbHost).toBeUndefined();
      expect(result.current.errors.tvdbProxy).toBeUndefined();
      expect(result.current.hasUrlErrors).toBe(false);
    });

    it("accepts valid http URL", () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());

      act(() => { result.current.form.setTmdbHost("http://example.com"); });

      expect(result.current.errors.tmdbHost).toBeUndefined();
      expect(result.current.hasUrlErrors).toBe(false);
    });

    it("accepts valid https URL", () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());

      act(() => { result.current.form.setTmdbHost("https://api.example.com/v3"); });

      expect(result.current.errors.tmdbHost).toBeUndefined();
    });

    it("rejects invalid tmdbHost", () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());

      act(() => { result.current.form.setTmdbHost("not-a-url"); });

      expect(result.current.errors.tmdbHost).toBe("invalidUrl");
      expect(result.current.hasUrlErrors).toBe(true);
    });

    it("rejects tmdbProxy with non-http protocol", () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());

      act(() => { result.current.form.setTmdbProxy("ftp://proxy.example.com"); });

      expect(result.current.errors.tmdbProxy).toBe("invalidUrl");
    });

    it("rejects invalid tvdbHost", () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());

      act(() => { result.current.form.setTvdbHost("htp://bad-url"); });

      expect(result.current.errors.tvdbHost).toBe("invalidUrl");
    });

    it("rejects invalid tvdbProxy", () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());

      act(() => { result.current.form.setTvdbProxy("missing-protocol"); });

      expect(result.current.errors.tvdbProxy).toBe("invalidUrl");
    });

    it("hasUrlErrors is true when any field has an error", () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());

      act(() => { result.current.form.setTmdbHost("bad"); });

      expect(result.current.hasUrlErrors).toBe(true);
    });

    it("clears error when invalid value is fixed", () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());

      act(() => { result.current.form.setTmdbHost("bad"); });
      expect(result.current.errors.tmdbHost).toBe("invalidUrl");

      act(() => { result.current.form.setTmdbHost("https://valid.example.com"); });
      expect(result.current.errors.tmdbHost).toBeUndefined();
      expect(result.current.hasUrlErrors).toBe(false);
    });
  });

  describe("onSave", () => {
    it("calls mutateAsync with updated config", async () => {
      setupMocks({
        userConfig: {
          tmdb: { host: "https://old.example.com", apiKey: "old-key" },
          tvdb: { apiKey: "tvdb-key" },
        },
      });
      const { result } = renderHook(() => useMediaDatabaseSettings());

      act(() => { result.current.form.setTmdbHost("https://new.example.com"); });
      act(() => { result.current.form.setTmdbApiKey("new-key"); });
      act(() => { result.current.form.setTvdbProxy("http://proxy:8080"); });

      await act(async () => {
        await result.current.onSave();
      });

      expect(mockMutateAsync).toHaveBeenCalledOnce();
      const callArg = mockMutateAsync.mock.calls[0][0];
      expect(callArg.traceId).toBe("MediaDatabasesSettings-test-trace-id");
      expect(callArg.config.tmdb.host).toBe("https://new.example.com");
      expect(callArg.config.tmdb.apiKey).toBe("new-key");
      expect(callArg.config.tvdb.httpProxy).toBe("http://proxy:8080");
    });

    it("preserves existing config fields in updated config", async () => {
      setupMocks({
        userConfig: {
          applicationLanguage: "en",
          tmdb: { host: "https://old.example.com" },
          tvdb: {},
        },
      });
      const { result } = renderHook(() => useMediaDatabaseSettings());

      await act(async () => {
        await result.current.onSave();
      });

      const callArg = mockMutateAsync.mock.calls[0][0];
      expect(callArg.config.applicationLanguage).toBe("en");
    });

    it("does not call mutateAsync when hasUrlErrors is true", async () => {
      setupMocks();
      const { result } = renderHook(() => useMediaDatabaseSettings());

      act(() => { result.current.form.setTmdbHost("bad-url"); });

      await act(async () => {
        await result.current.onSave();
      });

      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it("strips empty fields to undefined", async () => {
      setupMocks({
        userConfig: {
          tmdb: { host: "https://old.example.com", apiKey: "old-key", httpProxy: "http://old-proxy:8080" },
          tvdb: { host: "https://old-tvdb.example.com", apiKey: "tvdb-key", httpProxy: "http://old-tvdb-proxy:3128" },
        },
      });
      const { result } = renderHook(() => useMediaDatabaseSettings());

      act(() => { result.current.form.setTmdbHost(""); });
      act(() => { result.current.form.setTmdbApiKey(""); });
      act(() => { result.current.form.setTmdbProxy(""); });
      act(() => { result.current.form.setTvdbHost(""); });
      act(() => { result.current.form.setTvdbApiKey(""); });
      act(() => { result.current.form.setTvdbProxy(""); });

      await act(async () => {
        await result.current.onSave();
      });

      const config = mockMutateAsync.mock.calls[0][0].config;
      expect(config.tmdb.host).toBeUndefined();
      expect(config.tmdb.apiKey).toBeUndefined();
      expect(config.tmdb.httpProxy).toBeUndefined();
      expect(config.tvdb.host).toBeUndefined();
      expect(config.tvdb.apiKey).toBeUndefined();
      expect(config.tvdb.httpProxy).toBeUndefined();
    });
  });

  describe("onReset", () => {
    it("restores all form fields to initial values", () => {
      setupMocks({
        userConfig: {
          tmdb: { host: "https://original.example.com", apiKey: "original-key" },
          tvdb: { host: "https://original-tvdb.example.com" },
          primaryDatabase: "TVDB",
        },
      });
      const { result } = renderHook(() => useMediaDatabaseSettings());

      act(() => {
        result.current.form.setTmdbHost("https://changed.example.com");
        result.current.form.setTmdbApiKey("changed");
        result.current.form.setPrimaryDatabase("TMDB");
      });

      act(() => {
        result.current.onReset();
      });

      expect(result.current.form.tmdbHost).toBe("https://original.example.com");
      expect(result.current.form.tmdbApiKey).toBe("original-key");
      expect(result.current.form.tvdbHost).toBe("https://original-tvdb.example.com");
      expect(result.current.form.primaryDatabase).toBe("TVDB");
      expect(result.current.hasChanges).toBe(false);
    });
  });
});
