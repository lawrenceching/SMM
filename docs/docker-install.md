# Install SMM with Docker

Run **Simple Media Manager (SMM)** as a web application inside a Docker container. The image bundles the CLI backend, the web UI, and Linux binaries for ffmpeg, yt-dlp, VideoCaptioner, and QuickJS—the same layout as the Electron desktop build.

This guide is for **operators and end users**. For Dockerfile internals and monorepo build scripts, see [`apps/docker/README.md`](../apps/docker/README.md).

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 20.10 or newer
- [Docker Buildx](https://docs.docker.com/build/install-buildx/) (included with Docker Desktop)
- Enough disk space for the image and your media library (the final image is roughly 250 MB before your media volumes)

SMM listens on **port 30000** inside the container.

## Build the image

The final image (`smm:latest`) is assembled from several intermediate images. Build them **in order** from the repository root.

### Option A — pnpm scripts (recommended)

```bash
git clone https://github.com/lawrenceching/SMM.git
cd SMM/apps/docker

pnpm run build:cli
pnpm run build:ui
pnpm run build:ffmpeg
pnpm run build:ytdlp
pnpm run build:videocaptioner
pnpm run build
```

The last step produces `smm:latest`.

If you only changed the UI or CLI, you can rebuild just the affected intermediate image and then run `pnpm run build` again.

### Option B — docker buildx directly

Run these from the **repository root**:

```bash
docker buildx build --progress=plain -t smm-cli-build:latest        -f apps/docker/cli.Dockerfile .
docker buildx build --progress=plain -t smm-ui-build:latest         -f apps/docker/ui.Dockerfile .
docker buildx build --progress=plain -t smm-ffmpeg:latest           -f apps/docker/ffmpeg.Dockerfile .
docker buildx build --progress=plain -t smm-ytdlp:latest            -f apps/docker/ytdlp.Dockerfile .
docker buildx build --progress=plain -t smm-videocaptioner:latest     -f apps/docker/videocaptioner.Dockerfile .
docker buildx build --progress=plain -t smm:latest                  -f apps/docker/Dockerfile .
```

## Run the container

### Minimal example

```bash
docker run --rm -p 30000:30000 smm:latest
```

Open `http://localhost:30000/` in your browser.

**Note:** The official Docker image enables API authentication by default. Use `?token=` in the URL (see [Authentication](#authentication)) or set `-e SMM_AUTH_ENABLED=false` to disable it.

This starts SMM with **no persistent config**. Settings and imported folders are lost when the container is removed. Use the examples below for a real deployment.

### Recommended example (auth + persistent data + media)

```bash
docker run -d \
  --name smm \
  --restart unless-stopped \
  -p 30000:30000 \
  -e SMM_AUTH_TOKEN=change-me-to-a-long-random-secret \
  -e USER_DATA_DIR=/data/config \
  -e APP_DATA_DIR=/data/app \
  -v smm-config:/data/config \
  -v smm-app:/data/app \
  -v /path/to/your/media:/media:rw \
  smm:latest
```

Then open:

```
http://localhost:30000/?token=change-me-to-a-long-random-secret
```

The UI reads the token from the URL query string, stores it in the browser, and sends it on every API request. Replace the host, port, and token with your own values.

### Docker Compose

Save as `docker-compose.yml` next to your media folder (adjust paths and secrets):

```yaml
services:
  smm:
    image: smm:latest
    container_name: smm
    restart: unless-stopped
    ports:
      - "30000:30000"
    environment:
      SMM_AUTH_TOKEN: change-me-to-a-long-random-secret
      USER_DATA_DIR: /data/config
      APP_DATA_DIR: /data/app
    volumes:
      - smm-config:/data/config
      - smm-app:/data/app
      - ./media:/media:rw

volumes:
  smm-config:
  smm-app:
```

Start:

```bash
docker compose up -d
```

## Authentication

The Docker image enables Bearer token authentication **by default** (`SMM_AUTH_ENABLED=true` in the image, and the CLI also auto-enables auth when `/.dockerenv` is present). Set `SMM_AUTH_ENABLED=false` only if you intentionally want an open API on a trusted network.

| Variable | Description |
|----------|-------------|
| `SMM_AUTH_ENABLED` | `true` (default in Docker) requires a token on all `/api/*` requests. Set to `false` to disable. |
| `SMM_AUTH_TOKEN` | The shared secret. If unset or empty, the CLI generates a random token and prints it in the container logs. |

**Access the UI with a token**

1. Set `SMM_AUTH_TOKEN` when starting the container (or use a fixed token in Compose).
2. Open `http://<host>:30000/?token=<your-token>`.
3. The UI saves the token in browser `localStorage` so refreshes keep working.

If authentication is enabled but the browser has no token, API calls return **401 Unauthorized**.

Electron and local development do not enable auth unless you set `SMM_AUTH_ENABLED=true` or run inside Docker.

## Mount media libraries

SMM only reads and writes files under paths on its **allowlist**: config/data directories plus every **media folder** you import in the UI.

1. Mount host directories into the container, for example `-v /srv/tv:/media/tv:rw`.
2. In the SMM web UI, import folders using **container paths** such as `/media/tv/My Show`, not the host path `/srv/tv/My Show`.

See [Import Media Library](./import-media-library.md) for how media libraries and folders are organized.

Example layout:

```
/media                    # mount point inside the container
├── tv/                   # media library
│   ├── Show A/           # media folder
│   └── Show B/
└── movies/
    └── Movie Title (2024)/
```

## Persistent application data

By default, config and cache live under the container user's home directory and are lost when the container is recreated without volumes.

| Path (default on Linux) | Purpose |
|-------------------------|---------|
| `~/.config/smm/smm.json` | User settings, TMDB/TVDB keys, imported folder list |
| `~/.local/share/smm/` | Metadata cache, rename/recognize plans |
| `~/.local/share/smm/logs/` | Application logs |

Override locations with environment variables and mount them as volumes:

| Variable | Example mount |
|----------|---------------|
| `USER_DATA_DIR` | `-v smm-config:/data/config` with `-e USER_DATA_DIR=/data/config` |
| `APP_DATA_DIR` | `-v smm-app:/data/app` with `-e APP_DATA_DIR=/data/app` |
| `LOG_DIR` | `-v smm-logs:/data/logs` with `-e LOG_DIR=/data/logs` |

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SMM_AUTH_ENABLED` | `true` in Docker image | Require Bearer token on `/api/*`. Set `false` to disable. |
| `SMM_AUTH_TOKEN` | auto-generated if empty | Shared API token when auth is enabled. |
| `SMM_RESOURCES_PATH` | `/app/resources` in the image | Root directory for bundled ffmpeg, yt-dlp, VideoCaptioner, QuickJS. |
| `USER_DATA_DIR` | `~/.config/smm` | Config directory (`smm.json`). |
| `APP_DATA_DIR` | `~/.local/share/smm` | App data (metadata, plans). |
| `LOG_DIR` | `~/.local/share/smm/logs` | Log files. |
| `NODE_ENV` | `production` | Set in the image; usually leave unchanged. |

Third-party tools are installed under `/app/resources/bin/`:

| Tool | Location |
|------|----------|
| ffmpeg / ffprobe | `/app/resources/bin/ffmpeg/` |
| yt-dlp | `/app/resources/bin/yt-dlp/` |
| VideoCaptioner | `/app/resources/bin/videocaptioner/` |
| QuickJS | `/app/resources/bin/quickjs/` |

## Verify the installation

1. **Container logs** — should show the static file server on port 30000 and Socket.IO starting:

   ```bash
   docker logs smm
   ```

2. **Web UI** — open `http://<host>:30000/` (with `?token=` if auth is enabled).

3. **Import a folder** — mount media, import a container path in the UI, and confirm the folder appears in the sidebar.

4. **Optional tools** — try a small ffmpeg or yt-dlp operation from the UI to confirm bundled binaries are found.

## Troubleshooting

### `docker build` fails: image not found

Build all intermediate images before the final `Dockerfile`. See [Build the image](#build-the-image).

### 401 Unauthorized in the browser

- Open the UI with `?token=...` using the same value as `SMM_AUTH_TOKEN`.
- Check container logs if you did not set `SMM_AUTH_TOKEN`; the generated token is printed at startup.

### Imported folder not found or permission denied

- Use the **container path** (e.g. `/media/tv/Show`), not the host path.
- Ensure the mount is read-write (`:rw`) and the container user can read the files.
- On Linux, UID/GID mismatches between host and container can cause permission errors; adjust host directory permissions or run with a matching user if needed.

### ffmpeg / yt-dlp features fail

Confirm `SMM_RESOURCES_PATH` is `/app/resources` (the image default). Rebuild the ffmpeg, ytdlp, and videocaptioner intermediate images if you changed those Dockerfiles.

### Port already in use

Change the host port mapping, e.g. `-p 8080:30000`, and open `http://localhost:8080/`.

## Docker vs Electron desktop

| | Docker | Electron desktop |
|---|--------|------------------|
| Interface | Web browser | Native app window |
| Authentication | On by default | Not required (localhost) |
| Media paths | Container paths via volume mounts | Native OS paths |
| Updates | Rebuild or pull a new image | Install a new release |
| Folder picker | Manual path entry / import by path | Native file dialog |

For day-to-day use after setup, workflow in the web UI is the same as the desktop app: import folders, recognize shows, rename files, download with yt-dlp, and so on.

## Related documentation

- [Import Media Library](./import-media-library.md)
- [Features](./features.md)
- [API index](./api/index.md)
- Developer build notes: [`apps/docker/README.md`](../apps/docker/README.md)
