// resolve spotify tracks by scraping the public /embed/track/<id> page.
// no API key, no auth — the embed page ships a __NEXT_DATA__ JSON blob with
// title, artists, and cover art (used by twitter/discord/etc. for rich previews).
//
// input:  src/_data/music-ids.json — array of spotify track URLs, spotify: URIs, or bare 22-char track ids
// output: src/_data/music.json     — array of { id, title, artist, cover, url }

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const idsPath = path.join(root, "src", "_data", "music-ids.json");
const outPath = path.join(root, "src", "_data", "music.json");

function parseTrackId(entry) {
  const s = String(entry).trim();
  const m = s.match(/(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9]{22}$/.test(s)) return s;
  throw new Error(`unrecognised track entry: ${entry}`);
}

function pickImage(images) {
  if (!Array.isArray(images) || !images.length) return "";
  // prefer ~300px (matches our 48px thumb at 2x-6x DPR); fall back to largest available
  const sorted = images
    .filter((i) => i && i.url)
    .sort((a, b) => (a.maxWidth || 0) - (b.maxWidth || 0));
  const midOrLarger = sorted.find((i) => (i.maxWidth || 0) >= 300);
  return (midOrLarger || sorted[sorted.length - 1] || {}).url || "";
}

async function fetchTrack(id) {
  const res = await fetch(`https://open.spotify.com/embed/track/${id}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`embed/track/${id} ${res.status}`);
  const html = await res.text();

  const m = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/,
  );
  if (!m) throw new Error(`no __NEXT_DATA__ payload for ${id}`);

  const data = JSON.parse(m[1]);
  const entity = data?.props?.pageProps?.state?.data?.entity;
  if (!entity || entity.type !== "track") {
    throw new Error(`unexpected entity for ${id}: ${entity?.type}`);
  }

  const title = entity.title || entity.name || `track ${id}`;
  const artist =
    (entity.artists || []).map((a) => a.name).filter(Boolean).join(", ") ||
    "unknown artist";
  const cover =
    pickImage(entity.coverArt?.sources) ||
    pickImage(entity.visualIdentity?.image) ||
    "";

  return {
    id,
    title,
    artist,
    cover,
    url: `https://open.spotify.com/track/${id}`,
  };
}

async function main() {
  let entries = [];
  try {
    entries = JSON.parse(await fs.readFile(idsPath, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") {
      console.warn("[music] no music-ids.json — writing empty music.json");
      await fs.writeFile(outPath, "[]\n");
      return;
    }
    throw e;
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    await fs.writeFile(outPath, "[]\n");
    return;
  }

  const ids = entries.map(parseTrackId);
  const out = [];
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    try {
      out.push(await fetchTrack(id));
      console.log(`[music] resolved ${id}`);
    } catch (e) {
      console.warn(`[music] failed ${id}: ${e.message}`);
    }
  }

  await fs.writeFile(outPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`[music] wrote ${out.length} tracks to _data/music.json`);
}

main().catch((e) => {
  console.error("[music] failed:", e.message);
  process.exit(1);
});
