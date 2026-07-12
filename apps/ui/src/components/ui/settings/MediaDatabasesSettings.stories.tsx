import type { Meta, StoryObj } from "@storybook/react-vite"
import { MediaDatabasesSettingsView } from "./MediaDatabasesSettings"
import type { MediaDatabasesSettingsForm, MediaDatabasesSettingsProps } from "./useMediaDatabaseSettings"

function noop(): void {}

function createForm(overrides?: Partial<MediaDatabasesSettingsForm>): MediaDatabasesSettingsForm {
  const base: MediaDatabasesSettingsForm = {
    tmdbHost: "",
    tmdbApiKey: "",
    tmdbProxy: "",
    tvdbHost: "",
    tvdbApiKey: "",
    tvdbProxy: "",
    primaryDatabase: "TMDB",
    setTmdbHost: noop,
    setTmdbApiKey: noop,
    setTmdbProxy: noop,
    setTvdbHost: noop,
    setTvdbApiKey: noop,
    setTvdbProxy: noop,
    setPrimaryDatabase: noop,
  }
  return { ...base, ...overrides }
}

function defaultArgs(): MediaDatabasesSettingsProps {
  return {
    form: createForm(),
    errors: {},
    hasUrlErrors: false,
    isLoading: false,
    isSaving: false,
    hasChanges: false,
    saveError: null,
    onSave: noop,
    onReset: noop,
  }
}

const meta = {
  title: "Settings/MediaDatabasesSettings",
  component: MediaDatabasesSettingsView,
  decorators: [
    (Story) => (
      <div className="w-[720px] rounded-md border bg-card">
        <Story />
      </div>
    ),
  ],
  args: defaultArgs(),
} satisfies Meta<typeof MediaDatabasesSettingsView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FilledIn: Story = {
  args: {
    form: createForm({
      tmdbHost: "https://api.themoviedb.org/3",
      tmdbApiKey: "my-tmdb-key-12345",
      tmdbProxy: "http://proxy.example.com:8080",
      tvdbHost: "https://api4.thetvdb.com/v4",
      tvdbApiKey: "my-tvdb-key-67890",
      primaryDatabase: "TMDB",
    }),
  },
}

export const WithChanges: Story = {
  args: {
    form: createForm({
      tmdbHost: "https://api.themoviedb.org/3",
      tmdbApiKey: "my-tmdb-key-12345",
    }),
    hasChanges: true,
  },
}

export const Loading: Story = {
  args: {
    isLoading: true,
  },
}

export const Saving: Story = {
  args: {
    form: createForm({
      tmdbHost: "https://api.themoviedb.org/3",
      tmdbApiKey: "my-tmdb-key-12345",
    }),
    hasChanges: true,
    isSaving: true,
  },
}

export const SaveError: Story = {
  args: {
    form: createForm({
      tmdbHost: "https://api.themoviedb.org/3",
      tmdbApiKey: "my-tmdb-key-12345",
    }),
    hasChanges: true,
    saveError: new Error("Failed to save configuration. Check your network connection."),
  },
}

export const ValidationError: Story = {
  args: {
    form: createForm({
      tmdbHost: "not-a-url",
      tmdbProxy: "ftp://proxy.example.com",
      tvdbHost: "htp://api4.thetvdb.com/v4",
      tvdbApiKey: "my-tvdb-key-67890",
      primaryDatabase: "TVDB",
    }),
    errors: {
      tmdbHost: "invalidUrl",
      tmdbProxy: "invalidUrl",
      tvdbHost: "invalidUrl",
    },
    hasUrlErrors: true,
    hasChanges: true,
  },
}
