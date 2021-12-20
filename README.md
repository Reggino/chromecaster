# Chromecaster

## Fast and simple Chromecast Video Player

- Support for Windows, Mac OS and Linux
- CLI based
- Realtime transcoding of video, if required
- Support for .srt subtitles
- Support for older Chromecast devices (no subtitle placement issues)
- "FFmpeg" & "mediainfo" dependencies provided automatically

## Usage

```
Usage: chromecaster [options] <path to video file>

Play any video on your Chromecast

Arguments:
  path to video file                   Video to play

Options:
  -V, --version                        output the version number
  -c, --chromecast <name>              Name of target Chromecast on the network
  -s, --subtitles <path to .srt-file>  Subtitles to show
  -h, --help                           display help for command

```

## Note

- Only use -c parameter when multiple Chromecasts exist on the network.

## Download 1.0.0

- [For Windows](https://github.com/Reggino/chromecaster/releases/download/v1.0.0/chromecaster-win.exe)
- [For macOS](https://github.com/Reggino/chromecaster/releases/download/v1.0.0/chromecaster-macos)
- [For Linux](https://github.com/Reggino/chromecaster/releases/download/v1.0.0/chromecaster-linux)
