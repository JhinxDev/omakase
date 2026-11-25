(function (globalScope) {
  "use strict";

  const ALLOWED_COVER_HOSTS = new Set(["s4.anilist.co", "cdn.myanimelist.net"]);

  function safeExternalUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
      return parsed.href;
    } catch {
      return "";
    }
  }

  function safeCoverUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:") return "";
      if (!ALLOWED_COVER_HOSTS.has(parsed.hostname.toLowerCase())) return "";
      return parsed.href;
    } catch {
      return "";
    }
  }

  const api = {
    ALLOWED_COVER_HOSTS,
    safeExternalUrl,
    safeCoverUrl,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.OmakaseUrlSafety = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
