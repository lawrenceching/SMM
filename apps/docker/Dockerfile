# SMM Docker image: CLI + UI + bin (ffmpeg / yt-dlp / videocaptioner / quickjs)
# Build context: repository root (e.g. docker build -f apps/docker/Dockerfile .)
#
# This is the final-stage assembly Dockerfile. It does NOT build anything from
# source. It only pulls pre-built artifacts from intermediate images:
#   - smm-cli-build:latest   (built via cli.Dockerfile,  ships /app/cli — musl ELF)
#   - smm-ui-build:latest    (built via ui.Dockerfile,   ships Vite dist at /)
#   - smm-ffmpeg:latest      (built via ffmpeg.Dockerfile, ships bin/ffmpeg/ + bin/quickjs/)
#   - smm-ytdlp:latest       (built via ytdlp.Dockerfile,  ships bin/yt-dlp/)
#   - smm-videocaptioner:latest (built via videocaptioner.Dockerfile, ships bin/videocaptioner/)
#
# Final base is alpine so the musl-linked CLI runs natively.
#
# Prerequisite: build all intermediate images first:
#   pnpm --filter docker build:cli
#   pnpm --filter docker build:ui
#   pnpm --filter docker build:ffmpeg
#   pnpm --filter docker build:ytdlp
#   pnpm --filter docker build:videocaptioner

# Intermediate sources
FROM smm-cli-build:latest AS cli
FROM smm-ui-build:latest AS ui
FROM smm-ffmpeg:latest AS ffmpeg
FROM smm-ytdlp:latest AS ytdlp
FROM smm-videocaptioner:latest AS videocaptioner

# Final stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl bash libstdc++6 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=cli /app/cli /app/cli
RUN chmod +x /app/cli

COPY --from=ui / /app/public/
COPY --from=ffmpeg        / /app/resources/
COPY --from=ytdlp         / /app/resources/
COPY --from=videocaptioner / /app/resources/

WORKDIR /app
ENV NODE_ENV=production
ENV SMM_RESOURCES_PATH=/app/resources
ENV SMM_AUTH_ENABLED=true
EXPOSE 30000

CMD ["/app/cli", "--staticDir", "/app/public", "--port", "30000"]
