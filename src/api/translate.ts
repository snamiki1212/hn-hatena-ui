import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = resolve(__dirname, "../data/translation-cache.json");

function loadCache(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf-8")) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, string>): void {
  try {
    writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n", "utf-8");
  } catch {
    // ignore write errors
  }
}

const cache = loadCache();

export async function translateToJa(text: string): Promise<string | null> {
  if (cache[text] !== undefined) {
    return cache[text];
  }
  try {
    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=en|ja`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { responseStatus: number; responseData: { translatedText: string } };
    if (data.responseStatus !== 200) return null;
    const translated = data.responseData.translatedText;
    cache[text] = translated;
    saveCache(cache);
    return translated;
  } catch {
    return null;
  }
}
