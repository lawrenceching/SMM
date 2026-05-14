import path from "node:path"
import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import type { StorybookConfig } from "@storybook/react-vite"
import { mergeConfig } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  staticDirs: ["../public"],
  async viteFinal(viteConfig) {
    return mergeConfig(viteConfig, {
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          "@/": `${path.resolve(__dirname, "../src")}/`,
          "@core": path.resolve(__dirname, "../../../packages/core"),
          "@smm/tvdb4": path.resolve(__dirname, "../../../packages/tvdb4/src/index.ts"),
        },
      },
    })
  },
}

export default config
