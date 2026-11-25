const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ALLOWED_COVER_HOSTS,
  safeCoverUrl,
  safeExternalUrl,
} = require("../../src/omakase/web/static/url_safety.js");

test("safeExternalUrl allows http and https links and drops unsafe schemes", () => {
  assert.equal(safeExternalUrl("https://anilist.co/anime/154587/"), "https://anilist.co/anime/154587/");
  assert.equal(safeExternalUrl("http://example.com/anime"), "http://example.com/anime");
  assert.equal(safeExternalUrl("javascript:alert(1)"), "");
  assert.equal(safeExternalUrl("data:text/html,<script>alert(1)</script>"), "");
  assert.equal(safeExternalUrl(""), "");
  assert.equal(safeExternalUrl(null), "");
});

test("safeCoverUrl restricts poster images to HTTPS on allowlisted anime hosts", () => {
  assert.deepEqual([...ALLOWED_COVER_HOSTS], ["s4.anilist.co", "cdn.myanimelist.net"]);
  assert.equal(
    safeCoverUrl("https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx154587.jpg"),
    "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx154587.jpg",
  );
  assert.equal(
    safeCoverUrl("https://cdn.myanimelist.net/images/anime/1015/138006.jpg"),
    "https://cdn.myanimelist.net/images/anime/1015/138006.jpg",
  );
  assert.equal(safeCoverUrl("http://s4.anilist.co/poster.jpg"), "");
  assert.equal(safeCoverUrl("https://evil.example.invalid/poster.jpg"), "");
  assert.equal(safeCoverUrl("not-a-url"), "");
});
