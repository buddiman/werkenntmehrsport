/** Only plain http(s) links are accepted (mirrors the matches_info_url_is_http constraint). */
export function isHttpUrl(value: string): boolean {
  return value.length <= 500 && /^https?:\/\/[^\s]+$/i.test(value)
}

/** Short link text, e.g. "https://www.kicker.de/..." -> "kicker.de". */
export function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
