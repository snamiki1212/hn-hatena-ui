const MYMEMORY_URL = "https://api.mymemory.translated.net/get";

export async function translateToJa(text: string): Promise<string | null> {
  try {
    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=en|ja`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { responseStatus: number; responseData: { translatedText: string } };
    if (data.responseStatus !== 200) return null;
    return data.responseData.translatedText;
  } catch {
    return null;
  }
}
