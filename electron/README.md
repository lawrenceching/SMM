# Electron Wrapper for SMM

This is an electron wrapper for SMM.

The main backend logic is in `cli` module, and the frontend is in `ui` module.

This project implements function that require Electron capabilites.


When start electron wrapper in development mode:

1. Start `cli` module by running `bun run dev` in `cli` folder.
2. Start `ui` module by running `bun run dev` in `ui` folder.
3. Main window loads URL `http://localhost:5173`


When start electron wrapper in production mode:

1. Start `cli` module by running cli executable bundled in Electron package. cli process serves frontend resource at `cliPort` that runtime allocated.
2. Main window loads URL `http://localhost:{cliPort}`