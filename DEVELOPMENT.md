# Development Guideline

## Folder Structure

* ui - The HTML frontend
* electron - The electron application, which use the dist files from `ui`
* cli - The server side app

## UI

The HTML frontend application, uses Shadcn + Tailwind CSS.
The `ui` module bulid distribution for both Electron and Web UI.

## Electron
The `electron` module wrap HTML files into Electron application. And implement the platform specific logic.

## CLI

The `cli` module serves HTML as web UI and Implement the platform specific logic.
`cli` is a Bun application written in TypeScipt, and will be build into executable for different OS and arch.