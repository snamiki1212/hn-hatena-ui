import type { HnItem, HnStory, HnComment, HnUser } from "./types";

const BASE_URL = "https://hacker-news.firebaseio.com/v0";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`HN API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function getTopStoryIds(): Promise<number[]> {
  return fetchJson<number[]>("/topstories.json");
}

export async function getNewStoryIds(): Promise<number[]> {
  return fetchJson<number[]>("/newstories.json");
}

export async function getBestStoryIds(): Promise<number[]> {
  return fetchJson<number[]>("/beststories.json");
}

export async function getItem(id: number): Promise<HnItem> {
  return fetchJson<HnItem>(`/item/${id}.json`);
}

export async function getStory(id: number): Promise<HnStory> {
  const item = await getItem(id);
  return {
    id: item.id,
    by: item.by,
    time: item.time,
    title: item.title ?? "",
    url: item.url,
    score: item.score ?? 0,
    descendants: item.descendants ?? 0,
    kids: item.kids ?? [],
  };
}

export async function getComment(id: number): Promise<HnComment> {
  const item = await getItem(id);
  return {
    id: item.id,
    by: item.by,
    time: item.time,
    text: item.text ?? "",
    kids: item.kids ?? [],
    parent: item.parent ?? 0,
  };
}

export async function getUser(id: string): Promise<HnUser> {
  return fetchJson<HnUser>(`/user/${id}.json`);
}

/** Fetch multiple stories in parallel */
export async function getStories(
  ids: number[],
  limit = 30,
): Promise<HnStory[]> {
  const sliced = ids.slice(0, limit);
  return Promise.all(sliced.map(getStory));
}
