/** @vitest-environment jsdom */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MediaDatabasesSettingsView } from "./MediaDatabasesSettings";
import type { MediaDatabasesSettingsProps, MediaDatabasesSettingsForm } from "./useMediaDatabaseSettings";

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function createForm(overrides?: Partial<MediaDatabasesSettingsForm>): MediaDatabasesSettingsForm {
  const base: MediaDatabasesSettingsForm = {
    tmdbHost: "",
    tmdbApiKey: "",
    tmdbProxy: "",
    tvdbHost: "",
    tvdbApiKey: "",
    tvdbProxy: "",
    primaryDatabase: "TMDB" as const,
    setTmdbHost: vi.fn(),
    setTmdbApiKey: vi.fn(),
    setTmdbProxy: vi.fn(),
    setTvdbHost: vi.fn(),
    setTvdbApiKey: vi.fn(),
    setTvdbProxy: vi.fn(),
    setPrimaryDatabase: vi.fn(),
  };
  return { ...base, ...overrides };
}

function createProps(overrides?: Partial<MediaDatabasesSettingsProps>): MediaDatabasesSettingsProps {
  return {
    form: createForm(),
    errors: {},
    hasUrlErrors: false,
    isLoading: false,
    isSaving: false,
    hasChanges: false,
    saveError: null,
    onSave: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
}

describe("MediaDatabasesSettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the settings container", () => {
      render(<MediaDatabasesSettingsView {...createProps()} />);
      expect(screen.getByTestId("media-databases-settings")).toBeInTheDocument();
    });

    it("renders all form fields with default values", () => {
      render(<MediaDatabasesSettingsView {...createProps()} />);
      expect(screen.getByTestId("setting-primary-database-trigger")).toBeInTheDocument();
      expect(screen.getByTestId("setting-tmdb-host")).toBeInTheDocument();
      expect(screen.getByTestId("setting-tmdb-api-key")).toBeInTheDocument();
      expect(screen.getByTestId("setting-tmdb-proxy")).toBeInTheDocument();
      expect(screen.getByTestId("setting-tvdb-host")).toBeInTheDocument();
      expect(screen.getByTestId("setting-tvdb-api-key")).toBeInTheDocument();
      expect(screen.getByTestId("setting-tvdb-proxy")).toBeInTheDocument();
    });

    it("renders with filled form values", () => {
      const form = createForm({
        tmdbHost: "https://api.themoviedb.org/3",
        tmdbApiKey: "tmdb-key-123",
        tmdbProxy: "http://proxy.example.com:8080",
        tvdbHost: "https://api4.thetvdb.com/v4",
        tvdbApiKey: "tvdb-key-456",
        tvdbProxy: "http://tvdb-proxy.example.com:3128",
        primaryDatabase: "TVDB" as const,
      });
      render(<MediaDatabasesSettingsView {...createProps({ form })} />);

      const tmdbHostInput = screen.getByTestId("setting-tmdb-host") as HTMLInputElement;
      expect(tmdbHostInput.value).toBe("https://api.themoviedb.org/3");

      const tmdbApiKeyInput = screen.getByTestId("setting-tmdb-api-key") as HTMLInputElement;
      expect(tmdbApiKeyInput.value).toBe("tmdb-key-123");

      const tmdbProxyInput = screen.getByTestId("setting-tmdb-proxy") as HTMLInputElement;
      expect(tmdbProxyInput.value).toBe("http://proxy.example.com:8080");

      const tvdbHostInput = screen.getByTestId("setting-tvdb-host") as HTMLInputElement;
      expect(tvdbHostInput.value).toBe("https://api4.thetvdb.com/v4");

      const tvdbApiKeyInput = screen.getByTestId("setting-tvdb-api-key") as HTMLInputElement;
      expect(tvdbApiKeyInput.value).toBe("tvdb-key-456");

      const tvdbProxyInput = screen.getByTestId("setting-tvdb-proxy") as HTMLInputElement;
      expect(tvdbProxyInput.value).toBe("http://tvdb-proxy.example.com:3128");
    });

    it("renders API key inputs as password type", () => {
      render(<MediaDatabasesSettingsView {...createProps()} />);
      expect(screen.getByTestId("setting-tmdb-api-key")).toHaveAttribute("type", "password");
      expect(screen.getByTestId("setting-tvdb-api-key")).toHaveAttribute("type", "password");
    });
  });

  describe("loading state", () => {
    it("disables all inputs when isLoading is true", () => {
      render(<MediaDatabasesSettingsView {...createProps({ isLoading: true })} />);
      expect(screen.getByTestId("setting-tmdb-host")).toBeDisabled();
      expect(screen.getByTestId("setting-tmdb-api-key")).toBeDisabled();
      expect(screen.getByTestId("setting-tmdb-proxy")).toBeDisabled();
      expect(screen.getByTestId("setting-tvdb-host")).toBeDisabled();
      expect(screen.getByTestId("setting-tvdb-api-key")).toBeDisabled();
      expect(screen.getByTestId("setting-tvdb-proxy")).toBeDisabled();
    });

    it("hides save and cancel buttons during loading", () => {
      render(<MediaDatabasesSettingsView {...createProps({ isLoading: true, hasChanges: true })} />);
      expect(screen.queryByTestId("settings-save-button")).not.toBeInTheDocument();
      expect(screen.queryByTestId("settings-reset-button")).not.toBeInTheDocument();
    });
  });

  describe("save/cancel buttons", () => {
    it("does not show buttons when hasChanges is false", () => {
      render(<MediaDatabasesSettingsView {...createProps({ hasChanges: false })} />);
      expect(screen.queryByTestId("settings-save-button")).not.toBeInTheDocument();
      expect(screen.queryByTestId("settings-reset-button")).not.toBeInTheDocument();
    });

    it("shows save and cancel buttons when hasChanges is true", () => {
      render(<MediaDatabasesSettingsView {...createProps({ hasChanges: true })} />);
      expect(screen.getByTestId("settings-save-button")).toBeInTheDocument();
      expect(screen.getByTestId("settings-reset-button")).toBeInTheDocument();
    });

    it("disables save button during saving", () => {
      render(<MediaDatabasesSettingsView {...createProps({ hasChanges: true, isSaving: true })} />);
      expect(screen.getByTestId("settings-save-button")).toBeDisabled();
    });

    it("disables cancel button during saving", () => {
      render(<MediaDatabasesSettingsView {...createProps({ hasChanges: true, isSaving: true })} />);
      expect(screen.getByTestId("settings-reset-button")).toBeDisabled();
    });

    it("disables save button when hasUrlErrors is true", () => {
      render(<MediaDatabasesSettingsView {...createProps({ hasChanges: true, hasUrlErrors: true })} />);
      expect(screen.getByTestId("settings-save-button")).toBeDisabled();
    });

    it("calls onSave when save button clicked", () => {
      const onSave = vi.fn();
      render(<MediaDatabasesSettingsView {...createProps({ hasChanges: true, onSave })} />);
      fireEvent.click(screen.getByTestId("settings-save-button"));
      expect(onSave).toHaveBeenCalledOnce();
    });

    it("calls onReset when cancel button clicked", () => {
      const onReset = vi.fn();
      render(<MediaDatabasesSettingsView {...createProps({ hasChanges: true, onReset })} />);
      fireEvent.click(screen.getByTestId("settings-reset-button"));
      expect(onReset).toHaveBeenCalledOnce();
    });
  });

  describe("validation errors", () => {
    it("shows validation error for invalid tmdbHost", () => {
      const errors = { tmdbHost: "invalidUrl" as const };
      render(<MediaDatabasesSettingsView {...createProps({ errors, hasUrlErrors: true, hasChanges: true })} />);
      expect(screen.getByTestId("setting-tmdb-host-error")).toHaveTextContent("invalidUrl");
      expect(screen.getByTestId("setting-tmdb-host")).toHaveAttribute("aria-invalid", "true");
    });

    it("shows validation error for invalid tmdbProxy", () => {
      const errors = { tmdbProxy: "invalidUrl" as const };
      render(<MediaDatabasesSettingsView {...createProps({ errors, hasUrlErrors: true })} />);
      expect(screen.getByTestId("setting-tmdb-proxy-error")).toHaveTextContent("invalidUrl");
      expect(screen.getByTestId("setting-tmdb-proxy")).toHaveAttribute("aria-invalid", "true");
    });

    it("shows validation error for invalid tvdbHost", () => {
      const errors = { tvdbHost: "invalidUrl" as const };
      render(<MediaDatabasesSettingsView {...createProps({ errors, hasUrlErrors: true })} />);
      expect(screen.getByTestId("setting-tvdb-host-error")).toHaveTextContent("invalidUrl");
      expect(screen.getByTestId("setting-tvdb-host")).toHaveAttribute("aria-invalid", "true");
    });

    it("shows validation error for invalid tvdbProxy", () => {
      const errors = { tvdbProxy: "invalidUrl" as const };
      render(<MediaDatabasesSettingsView {...createProps({ errors, hasUrlErrors: true })} />);
      expect(screen.getByTestId("setting-tvdb-proxy-error")).toHaveTextContent("invalidUrl");
      expect(screen.getByTestId("setting-tvdb-proxy")).toHaveAttribute("aria-invalid", "true");
    });
  });

  describe("save error", () => {
    it("shows save error message", () => {
      const saveError = new Error("Failed to save");
      render(<MediaDatabasesSettingsView {...createProps({ saveError })} />);
      expect(screen.getByTestId("setting-save-error")).toHaveTextContent("Failed to save");
    });

    it("does not render error container when saveError is null", () => {
      render(<MediaDatabasesSettingsView {...createProps({ saveError: null })} />);
      expect(screen.queryByTestId("setting-save-error")).not.toBeInTheDocument();
    });
  });

  describe("form interactions", () => {
    it("calls setTmdbHost on input change", () => {
      const setTmdbHost = vi.fn();
      const form = createForm({ setTmdbHost });
      render(<MediaDatabasesSettingsView {...createProps({ form })} />);
      fireEvent.change(screen.getByTestId("setting-tmdb-host"), { target: { value: "https://example.com" } });
      expect(setTmdbHost).toHaveBeenCalledWith("https://example.com");
    });

    it("calls setTmdbApiKey on input change", () => {
      const setTmdbApiKey = vi.fn();
      const form = createForm({ setTmdbApiKey });
      render(<MediaDatabasesSettingsView {...createProps({ form })} />);
      fireEvent.change(screen.getByTestId("setting-tmdb-api-key"), { target: { value: "new-key" } });
      expect(setTmdbApiKey).toHaveBeenCalledWith("new-key");
    });

    it("calls setTmdbProxy on input change", () => {
      const setTmdbProxy = vi.fn();
      const form = createForm({ setTmdbProxy });
      render(<MediaDatabasesSettingsView {...createProps({ form })} />);
      fireEvent.change(screen.getByTestId("setting-tmdb-proxy"), { target: { value: "http://new-proxy:8080" } });
      expect(setTmdbProxy).toHaveBeenCalledWith("http://new-proxy:8080");
    });
  });
});
