def parse(url: str) -> str:
    import trafilatura
    downloaded = trafilatura.fetch_url(url)
    return trafilatura.extract(downloaded) or ""