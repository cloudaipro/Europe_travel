#!/usr/bin/env python3
"""
Extract video IDs and titles from a YouTube playlist URL.

Usage:
    python3 extract_youtube_playlist.py "<playlist URL>"

Output:
    JSON array on stdout: [{"videoId": "...", "title": "..."}, ...]

Notes:
    Uses the public HTML page rather than the YouTube Data API — no API key
    required. YouTube embeds the playlist data inline as JSON in the HTML;
    we extract via regex over the `playlistVideoRenderer` blocks.
    Tested with playlists up to ~200 videos. For larger playlists you may
    need pagination via the `continuation` token (not handled here).
"""

import json
import re
import sys
import urllib.parse
import urllib.request


UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def normalize_playlist_url(url: str) -> str:
    """Resolve to the canonical /playlist?list=... form."""
    parsed = urllib.parse.urlparse(url)
    qs = urllib.parse.parse_qs(parsed.query)
    list_id = qs.get("list", [None])[0]

    if list_id is None:
        # Maybe it's a youtu.be short link or the path encodes it differently
        m = re.search(r"list=([A-Za-z0-9_-]+)", url)
        if m:
            list_id = m.group(1)

    if not list_id:
        raise ValueError(f"Could not find a playlist `list=` parameter in URL: {url}")

    return f"https://www.youtube.com/playlist?list={list_id}"


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    return data.decode("utf-8", errors="ignore")


def extract_videos(html: str):
    """Pull (videoId, title) tuples in playlist order."""
    pattern = re.compile(
        r'"playlistVideoRenderer":\{"videoId":"([^"]+)".*?'
        r'"title":\{(?:"runs":\[\{"text":"([^"]*)"\}\]|"simpleText":"([^"]*)")',
        re.DOTALL,
    )

    results = []
    seen = set()
    for match in pattern.finditer(html):
        vid = match.group(1)
        title = match.group(2) or match.group(3) or ""
        if vid in seen:
            continue
        seen.add(vid)
        # Unescape common JSON escapes left in the title
        title = (
            title.replace(r"&", "&")
            .replace(r"\"", '"')
            .replace(r"\/", "/")
        )
        results.append({"videoId": vid, "title": title})
    return results


def main():
    if len(sys.argv) != 2:
        print("Usage: extract_youtube_playlist.py <playlist URL>", file=sys.stderr)
        sys.exit(2)

    url = normalize_playlist_url(sys.argv[1])
    html = fetch(url)
    videos = extract_videos(html)

    if not videos:
        print(
            "No videos extracted. The page may be region-locked, the playlist "
            "may be private, or YouTube may have changed its DOM. "
            "Try opening the URL in a browser to verify.",
            file=sys.stderr,
        )
        sys.exit(1)

    json.dump(videos, sys.stdout, ensure_ascii=False, indent=2)
    print()  # trailing newline


if __name__ == "__main__":
    main()
