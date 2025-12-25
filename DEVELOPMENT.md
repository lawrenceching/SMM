# Development Guideline

## Folder Structure

* core - The common and share code. The code in this module MUST be available in both frontend(browser) and backend(Bun.js and Node.js) side.
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

### Folder Structure in CLI module

* **`src/route`** The API Routes / API handlers
* **`src/tools`** The tools for AI Agent tool calling
* **`src/utils`** The utility code

## Unit Test

This is the unit test guideline for AI Agent.

Following the red-green principle, you need to ensure the unit test is actually work by:

1. Comment out part of production code
2. Run unit test
3. Verify the unit test fail with expected error reason
4. Uncomment the production code which commented out in step 1

Repeat above step to ensure all assertions are actual working.