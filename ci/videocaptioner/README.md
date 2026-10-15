# VideoCaptioner packaging (SMM)

SMM builds VideoCaptioner executables in CI and publishes them to **this**
repo's GitHub Releases. Upstream source is cloned ephemerally from
`WEIFENG2333/VideoCaptioner`; it is not vendored into git.

PyInstaller packaging (`packaging/build_exe.py`, `packaging/videocaptioner.spec`)
is **owned by SMM** and copied into the upstream checkout during CI.

## 3pp keys (`package.json`)

| Key | Meaning |
|-----|---------|
| `videocaptioner_upstream_version` | Upstream version without `v` (e.g. `1.4.2`); must match git tag / hatch-vcs at `videocaptioner_ref` |
| `videocaptioner_smm_build_version` | SMM packaging revision (e.g. `1.0.2`) |
| `videocaptioner_ref` | Upstream git tag or SHA to clone |
| `videocaptioner_repo` | Upstream `owner/repo` (default `WEIFENG2333/VideoCaptioner`) |
| `videocaptioner_releases_repo` | Where binaries are downloaded from (`lawrenceching/SMM`) |

Composite artifact version (Release tag, asset name, GHCR tag):

```text
{upstream}_{smm_build}   # e.g. 1.4.2_1.0.2
```

- Release tag: `videocaptioner-1.4.2_1.0.2`
- Asset: `videocaptioner-1.4.2_1.0.2-linux-x64.tar.gz`
- CLI `--version`: upstream only (`1.4.2`)

## Publish a new build

1. Set `videocaptioner_ref` + `videocaptioner_upstream_version` when upgrading upstream.
2. Bump `videocaptioner_smm_build_version` for any SMM packaging change (patches, spec, build script).
3. Refresh `packaging/` or `patches/` if needed.
4. Run Actions workflow **Build videocaptioner executables** (`build-videocaptioner-exe.yml`).
5. Confirm Release `videocaptioner-<upstream>_<smm_build>` has five `.tar.gz` assets.
6. Rebuild Docker `smm-videocaptioner` / Electron packs as usual.

## Patches

Optional `patches/*.patch` are applied with `git apply` on the upstream checkout only.
Never push these commits to the VideoCaptioner repository.
