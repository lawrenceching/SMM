import type { Meta, StoryObj } from "@storybook/react-vite"
import { action } from "storybook/actions"
import { UIDownloadVideoDialogContent } from "./UIDownloadVideoDialogContent"
import type { UIDownloadVideoDialogContentProps } from "./UIDownloadVideoDialogContent"
import { DEFAULT_YTDLP_COOKIES_BROWSER_ID } from "@/lib/ytdlpCookiesBrowsers"
import { DEFAULT_YTDLP_DOWNLOAD_EXTRA_ARG_SELECTION } from "@/lib/ytdlpDownloadExtraArgs"
import { DEFAULT_YTDLP_JS_RUNTIME_ID } from "@/lib/ytdlpJsRuntimes"

const t = (key: string) => key
const tCommon = (key: string) => key

function baseArgs(): UIDownloadVideoDialogContentProps {
  return {
    hasAgreed: false,
    isAgreementChecked: false,
    onAgreementChange: action("onAgreementChange"),

    url: "",
    urlError: null,
    formBusy: false,
    onUrlChange: action("onUrlChange"),
    onGo: action("onGo"),

    isListingFormats: false,
    listingError: null,
    goDisabled: false,

    useCookies: false,
    cookiesText: "",
    useCookiesFromBrowser: false,
    cookiesBrowser: DEFAULT_YTDLP_COOKIES_BROWSER_ID,
    start1080pBlocked: false,
    platform: "win32",
    onUseCookiesChange: action("onUseCookiesChange"),
    onUseCookiesFromBrowserChange: action("onUseCookiesFromBrowserChange"),
    onCookiesBrowserChange: action("onCookiesBrowserChange"),
    onOpenCookiesEditor: action("onOpenCookiesEditor"),

    isUrlValid: false,
    selectedFormatPresetId: "default",
    is1080pAvailable: true,
    onFormatChange: action("onFormatChange"),

    showCookiesAtTopLevel: true,
    formatMode: "preset",
    formatCodes: [],
    selectedFormatCode: "",
    selectedSupplementaryFormatCode: "",
    onFormatModeChange: action("onFormatModeChange"),
    onFormatCodeChange: action("onFormatCodeChange"),
    onSupplementaryFormatCodeChange: action("onSupplementaryFormatCodeChange"),

    isYoutube: false,
    useJsRuntime: false,
    jsRuntime: DEFAULT_YTDLP_JS_RUNTIME_ID,
    onUseJsRuntimeChange: action("onUseJsRuntimeChange"),
    onJsRuntimeChange: action("onJsRuntimeChange"),
    quickjsUnavailable: false,

    videoList: [],
    selectedUrls: new Set(),
    onToggleUrl: action("onToggleUrl"),

    showMoreOptions: false,
    extraArgSelection: { ...DEFAULT_YTDLP_DOWNLOAD_EXTRA_ARG_SELECTION },
    onShowMoreOptionsChange: action("onShowMoreOptionsChange"),
    onExtraArgToggle: action("onExtraArgToggle"),

    downloadFolder: "",
    onFolderChange: action("onFolderChange"),
    onFolderSelect: action("onFolderSelect"),

    isEnqueueing: false,
    startButtonDisabled: true,
    onCancel: action("onCancel"),
    onStart: action("onStart"),

    onClose: action("onClose"),

    t,
    tCommon,
  }
}

const meta = {
  title: "Components/UIDownloadVideoDialogContent",
  component: UIDownloadVideoDialogContent,
} satisfies Meta<typeof UIDownloadVideoDialogContent>

export default meta
type Story = StoryObj<typeof meta>

export const AgreementRequired: Story = {
  args: baseArgs(),
}

export const Agreed: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
  },
}

export const WithValidUrl: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    isUrlValid: true,
    is1080pAvailable: true,
  },
}

export const YoutubeWithCookiesTopLevel: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    isUrlValid: true,
    isYoutube: true,
    showCookiesAtTopLevel: true,
  },
}

export const YoutubeGoDisabled: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    isUrlValid: true,
    isYoutube: true,
    showCookiesAtTopLevel: true,
    goDisabled: true,
  },
}

export const ListingFormats: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    isUrlValid: true,
    isYoutube: true,
    isListingFormats: true,
    showCookiesAtTopLevel: true,
  },
}

export const ListingError: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    isUrlValid: true,
    listingError: "Cookies 过期或无效, 请重新配置",
  },
}

export const With1080pBlocked: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    isUrlValid: true,
    selectedFormatPresetId: "1080p",
    is1080pAvailable: false,
    start1080pBlocked: true,
  },
}

export const WithUrlError: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "not-a-valid-url",
    urlError: "Invalid URL format",
  },
}

export const WithCookiesEnabled: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    isUrlValid: true,
    useCookies: true,
    useCookiesFromBrowser: true,
    cookiesBrowser: "firefox",
    platform: "win32",
  },
}

export const WithFormatCodes: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    isUrlValid: true,
    formatCodes: [
      { id: "18", ext: "mp4", resolution: "640x360", fps: 30, title: "360P (640x360) mp4", subtitle: "~500kbps avc1", category: "combined" },
      { id: "22", ext: "mp4", resolution: "1280x720", fps: 30, title: "720P (1280x720) mp4", subtitle: "~2Mbps avc1", category: "combined" },
      { id: "140", ext: "m4a", resolution: "audio only", fps: null, title: "m4a", subtitle: "~128kbps mp4a.40.2", category: "audio-only" },
      { id: "136", ext: "mp4", resolution: "1280x720", fps: 30, title: "720P (1280x720) mp4", subtitle: "~1.5Mbps avc1", category: "video-only" },
    ],
    formatMode: "format-code",
    selectedFormatCode: "18",
    showCookiesAtTopLevel: false,
  },
}

export const WithFormatCodesAudioOnly: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    isUrlValid: true,
    formatCodes: [
      { id: "140", ext: "m4a", resolution: "audio only", fps: null, title: "m4a", subtitle: "~128kbps mp4a.40.2", category: "audio-only" },
      { id: "136", ext: "mp4", resolution: "1280x720", fps: 30, title: "720P (1280x720) mp4", subtitle: "~1.5Mbps avc1", category: "video-only" },
    ],
    formatMode: "format-code",
    selectedFormatCode: "140",
    showCookiesAtTopLevel: false,
  },
}

export const WithMoreOptions: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    isUrlValid: true,
    showMoreOptions: true,
    showCookiesAtTopLevel: false,
    extraArgSelection: {
      "--write-thumbnail": true,
      "--embed-thumbnail": false,
      "--embed-metadata": true,
    },
  },
}

export const WithJsRuntime: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    isUrlValid: true,
    isYoutube: true,
    showMoreOptions: true,
    useJsRuntime: true,
    jsRuntime: "quickjs",
    quickjsUnavailable: false,
    showCookiesAtTopLevel: false,
  },
}

export const WithFolderSet: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    isUrlValid: true,
    downloadFolder: "/home/user/Downloads/videos",
  },
}

export const WithEpisodes: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.bilibili.com/video/BV1xx411c7mD",
    isUrlValid: true,
    videoList: [
      { title: "Episode 1 - Introduction", artist: "Channel Name", url: "https://example.com/ep1" },
      { title: "Episode 2 - Getting Started", artist: "Channel Name", url: "https://example.com/ep2" },
      { title: "Episode 3 - Advanced Topics", artist: "Channel Name", url: "https://example.com/ep3" },
    ],
    selectedUrls: new Set([
      "https://example.com/ep1",
      "https://example.com/ep2",
      "https://example.com/ep3",
    ]),
    onToggleUrl: action("onToggleUrl"),
  },
}

export const WithEpisodesLoading: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.bilibili.com/video/BV1xx411c7mD",
    isUrlValid: true,
    videoList: [],
    selectedUrls: new Set(),
    onToggleUrl: action("onToggleUrl"),
  },
}

export const WithEpisodesError: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.bilibili.com/video/BV1xx411c7mD",
    isUrlValid: true,
    videoList: [],
    selectedUrls: new Set(),
    onToggleUrl: action("onToggleUrl"),
  },
}

export const WithCollection: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://space.bilibili.com/123456/channel/collectiondetail?sid=789",
    isUrlValid: true,
    videoList: [
      { title: "Video 1", artist: "Bilibili Uploader", url: "https://www.bilibili.com/video/BV1aa11" },
      { title: "Video 2", artist: "Bilibili Uploader", url: "https://www.bilibili.com/video/BV1bb22" },
      { title: "Video 3", artist: "Bilibili Uploader", url: "https://www.bilibili.com/video/BV1cc33" },
      { title: "Video 4", artist: "Bilibili Uploader", url: "https://www.bilibili.com/video/BV1dd44" },
      { title: "Video 5", artist: "Bilibili Uploader", url: "https://www.bilibili.com/video/BV1ee55" },
    ],
    selectedUrls: new Set([
      "https://www.bilibili.com/video/BV1aa11",
      "https://www.bilibili.com/video/BV1bb22",
      "https://www.bilibili.com/video/BV1cc33",
      "https://www.bilibili.com/video/BV1dd44",
      "https://www.bilibili.com/video/BV1ee55",
    ]),
    onToggleUrl: action("onToggleUrl"),
  },
}

export const WithCollectionLoading: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://space.bilibili.com/123456/channel/collectiondetail?sid=789",
    isUrlValid: true,
    videoList: [],
    selectedUrls: new Set(),
    onToggleUrl: action("onToggleUrl"),
  },
}

export const WithCollectionError: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://space.bilibili.com/123456/channel/collectiondetail?sid=789",
    isUrlValid: true,
    videoList: [],
    selectedUrls: new Set(),
    onToggleUrl: action("onToggleUrl"),
  },
}

export const FormBusy: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    isUrlValid: true,
    downloadFolder: "/home/user/Downloads",
    formBusy: true,
  },
}

export const Enqueueing: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    isUrlValid: true,
    downloadFolder: "/home/user/Downloads",
    isEnqueueing: true,
  },
}

export const FullFeatured: Story = {
  args: {
    ...baseArgs(),
    hasAgreed: true,
    isAgreementChecked: true,
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    isUrlValid: true,
    isYoutube: true,
    selectedFormatPresetId: "1080p",
    is1080pAvailable: true,
    useCookies: true,
    useCookiesFromBrowser: true,
    cookiesBrowser: "firefox",
    platform: "win32",
    showCookiesAtTopLevel: false,
    showMoreOptions: true,
    useJsRuntime: true,
    jsRuntime: "quickjs",
    quickjsUnavailable: false,
    extraArgSelection: {
      "--write-thumbnail": true,
      "--embed-thumbnail": false,
      "--embed-metadata": true,
    },
    downloadFolder: "/home/user/Downloads/videos",
  },
}
