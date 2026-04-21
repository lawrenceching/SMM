# VideoCaptioner Integration

> This requirement is for https://github.com/lawrenceching/SMM/issues/20

This feature support to transcribe video/audio by calling videocaptioner command.

## Use Cases

### Transcribe

User click "Transcribe" context menu to generate subtitle file for video/audio file.

```mermaid
sequenceDiagram
    participant MP as MusicPanel
    participant S as Server

    MP->>MP: user click "Transcribe"
    MP->>S: POST "/api/videocaptioner/transcribe"
    S->>S: start videocaptioner command
    S->>MP: return
    MP->>MP: 弹出成功 toast
```

### videocaptioner Discovery

In app startup, discover the videocaptioner cli command.
If it's not found, disable the Transcribe context menu.

```mermaid
sequenceDiagram
    participant UI
    participant S as Server
    participant MP as MusicPanel

    UI->>UI: start up
    UI->>S: POST "/api/execute" for hello task
    S->>UI: videocaptioner executable path
    MP->>MP: enable/disable Transcribe context menu
```

## References

[VideoCaptioner CLI | GitHub](https://github.com/WEIFENG2333/VideoCaptioner/blob/master/docs/cli.md)
