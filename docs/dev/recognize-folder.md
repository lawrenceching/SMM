# Recognize Folder

**Supported Platform** CLI
**Status** wip

We have two similar recognition functions, don't get confused:

**Recognize Folder** – determines the TV series or movie title for a given media folder. This is what this page describes.
**Recognize Episodes** – matches local video files to their correct episode numbers within a series. This function is described in [Recognize Episodes](./recognize-episodes.md)


There are two way to recognize folder:
1. manual - User tell SMM the TV series or movie for a folder
2. auto - Let SMM find out

## CLI

```
# Manual
smm recognize <folder> --db tmdb/tvdb --id <tmdbid/tvdbid>

# Auto
smm try-to-recognize <folder> --skip-episodes
Is it "{title} ({release year})"? [Y/n]
> Y
Metadata is updated
```

NOTE: `try-to-recognize` starts both folder recognition and episode recognition. Use `--skip-episodes` to skip the episode recognition process.


## References

[Import Folder](./import-folder.md)

[Supported Platform](./supported-platform.md)
