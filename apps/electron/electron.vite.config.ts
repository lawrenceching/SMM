import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    build: {
      // Workspace package ships TypeScript sources; bundle it instead of runtime require().
      externalizeDeps: {
        exclude: ['@smm/electron-common'],
      },
    },
  },
  preload: {
    build: {
      externalizeDeps: {
        exclude: ['@smm/electron-common'],
      },
    },
  },
  renderer: {},
})
