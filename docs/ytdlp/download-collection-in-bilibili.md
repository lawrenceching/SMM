# How to download collection in Bilibili

# Get Metadata
```
ytdlp -j "${bilibili_video_url}"
{} // JSON for video 1
{} // JSON for video 2
{} // JSON for video 3
```

ytdlp prints info for each video in collection/playlist line by line.
Each line is a JSON text.

The `docs/ytdlp/bilibili-data-extraction-example.json` provided the JSON example of one line.