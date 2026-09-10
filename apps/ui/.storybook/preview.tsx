import type { Preview } from "@storybook/react-vite"
import { I18nextProvider } from "react-i18next"
import { sb } from "storybook/test"
import "../src/index.css"
import i18n from "../src/lib/i18n"
import { ThemeProvider } from "../src/providers/theme-provider"

// Spy so Sidebar.stories can stub list chrome without QueryClient / dialog providers.
sb.mock(import("../src/hooks/useSidebar.ts"), { spy: true })

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="light" storageKey="smm-storybook-theme">
        <I18nextProvider i18n={i18n}>
          <Story />
        </I18nextProvider>
      </ThemeProvider>
    ),
  ],
}

export default preview
