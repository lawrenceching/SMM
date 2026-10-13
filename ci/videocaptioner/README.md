# VideoCaptioner packaging (SMM)

SMM builds VideoCaptioner executables in CI and publishes them to **this**
repo's GitHub Releases. Upstream source is cloned ephemerally; it is not
vendored into git.

## 3pp keys (`package.json`)

| Key | Meaning |
|-----|---------|
| `videocaptioner_version` | Artifact version / Release tag `videocaptioner-<ver>` |
| `videocaptioner_ref` | Upstream git tag or SHA to clone |
| `videocaptioner_repo` | Upstream `owner/repo` to clone |
| `videocaptioner_releases_repo` | Where binaries are downloaded from (`lawrenceching/SMM`) |

## Publish a new build

1. Bump `videocaptioner_version` (and `videocaptioner_ref` if upgrading upstream).
2. Add/refresh patches under `patches/` if needed (`git format-patch` against the pinned ref).
3. Run Actions workflow **Build videocaptioner executables** (`build-videocaptioner-exe.yml`).
4. Confirm Release `videocaptioner-<version>` has five `.tar.gz` assets.
5. Rebuild Docker `smm-videocaptioner` / Electron packs as usual.

## Patches

Patches are applied with `git apply` inside the CI checkout of upstream only.
Never push these commits to the VideoCaptioner repository.
