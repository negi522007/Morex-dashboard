// Turns a browser's User-Agent header into the two names an admin can read: which browser, on which
// system ("Chrome" + "Linux"). Order matters: Edge and Opera also say "Chrome", Chrome also says
// "Safari", Android also says "Linux".
export function parseUserAgent(ua: string | null | undefined): { browser: string; os: string } {
  const s = ua ?? '';
  const browser =
    /Edg\//.test(s) ? 'Edge'
    : /OPR\/|Opera/.test(s) ? 'Opera'
    : /Firefox\//.test(s) ? 'Firefox'
    : /Chrome\/|CriOS\//.test(s) ? 'Chrome'
    : /Safari\//.test(s) && /Version\//.test(s) ? 'Safari'
    : /curl\/|PostmanRuntime|insomnia|axios|node-fetch|python-requests/i.test(s) ? 'API client'
    : 'Unknown';
  const os =
    /Windows NT/.test(s) ? 'Windows'
    : /Android/.test(s) ? 'Android'
    : /iPhone|iPad|iPod/.test(s) ? 'iOS'
    : /Mac OS X|Macintosh/.test(s) ? 'macOS'
    : /CrOS/.test(s) ? 'ChromeOS'
    : /Linux/.test(s) ? 'Linux'
    : 'Unknown';
  return { browser, os };
}
