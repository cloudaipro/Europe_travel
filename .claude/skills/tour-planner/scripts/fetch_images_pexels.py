#!/usr/bin/env python3
"""
Search Pexels for landmark photos and download the top result locally.

Usage:
    python3 fetch_images_pexels.py <out_dir> "<query 1>" "<query 2>" ...

For each query, the script:
  1. Loads the Pexels search results page (no API key needed)
  2. Extracts photo IDs in display order
  3. Downloads the top result as a JPEG into out_dir
  4. Names files NN_slug.jpg in order

Output (stdout):
    JSON: [{"query": "...", "filename": "01_query.jpg", "size": 12345}, ...]

Why Pexels and not Wikimedia:
  Wikimedia upload servers block automated thumbnail requests with a 400
  "Use thumbnail steps" error even with a valid User-Agent — verified
  in 2026. Pexels accepts requests with a browser-like UA and serves
  binary JPEGs directly. Their license also permits free use without
  attribution (though attribution is appreciated).

Rate limiting:
  This script sleeps 0.4 seconds between requests. Pexels has occasionally
  rate-limited at >5 req/s from a single IP — the delay keeps us well under.
"""

import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request


UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s[:40] or "image"


def _request_with_retry(url: str, *, attempts: int = 3, base_delay: float = 2.0):
    """GET with exponential backoff on 403/429 (Pexels rate-limits transiently)."""
    last_exc = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            return urllib.request.urlopen(req, timeout=25).read()
        except urllib.error.HTTPError as e:
            last_exc = e
            if e.code in (403, 429, 503) and i < attempts - 1:
                time.sleep(base_delay * (2 ** i))
                continue
            raise
        except Exception as e:
            last_exc = e
            if i < attempts - 1:
                time.sleep(base_delay * (2 ** i))
                continue
            raise
    if last_exc:
        raise last_exc


def search_pexels(query: str):
    """Return ordered list of photo IDs for the query."""
    url = "https://www.pexels.com/search/" + urllib.parse.quote(query) + "/"
    body = _request_with_retry(url)
    html = body.decode("utf-8", errors="ignore")

    ids = re.findall(r"images\.pexels\.com/photos/(\d+)/pexels-photo-\1\.jpeg", html)
    seen = []
    for i in ids:
        if i not in seen:
            seen.append(i)
    return seen


def download_photo(photo_id: str, dest_path: str, width: int = 900) -> int:
    url = (
        f"https://images.pexels.com/photos/{photo_id}/"
        f"pexels-photo-{photo_id}.jpeg?auto=compress&cs=tinysrgb&w={width}"
    )
    data = _request_with_retry(url)
    with open(dest_path, "wb") as f:
        f.write(data)
    return len(data)


def is_valid_jpeg(path: str) -> bool:
    """Sanity-check: real JPEG starts with FF D8 FF magic bytes."""
    try:
        with open(path, "rb") as f:
            head = f.read(3)
        return head == b"\xff\xd8\xff"
    except OSError:
        return False


def main():
    if len(sys.argv) < 3:
        print(
            "Usage: fetch_images_pexels.py <out_dir> '<query 1>' '<query 2>' ...",
            file=sys.stderr,
        )
        sys.exit(2)

    out_dir = sys.argv[1]
    queries = sys.argv[2:]
    os.makedirs(out_dir, exist_ok=True)

    results = []
    used_ids = set()

    for idx, q in enumerate(queries, 1):
        try:
            ids = search_pexels(q)
        except Exception as e:
            results.append({"query": q, "error": f"search failed: {e}"})
            time.sleep(0.4)
            continue

        # Pick first ID we haven't already used (avoids duplicates across queries)
        chosen = None
        for i in ids:
            if i not in used_ids:
                chosen = i
                break
        if chosen is None and ids:
            chosen = ids[0]  # accept duplicate as last resort

        if not chosen:
            results.append({"query": q, "error": "no results"})
            time.sleep(0.4)
            continue

        used_ids.add(chosen)
        fname = f"{idx:02d}_{slugify(q)}.jpg"
        dest = os.path.join(out_dir, fname)

        try:
            size = download_photo(chosen, dest)
            if not is_valid_jpeg(dest):
                results.append({
                    "query": q,
                    "error": "downloaded file is not a JPEG (likely an HTML error page)",
                    "filename": fname,
                })
            else:
                results.append({
                    "query": q,
                    "filename": fname,
                    "size": size,
                    "photo_id": chosen,
                })
        except Exception as e:
            results.append({"query": q, "error": f"download failed: {e}"})

        time.sleep(0.4)

    json.dump(results, sys.stdout, ensure_ascii=False, indent=2)
    print()


if __name__ == "__main__":
    main()
