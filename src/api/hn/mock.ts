import type { HnStory } from "./types";

/** Mock data for development when HN API is unreachable */
export const MOCK_STORY_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const now = Math.floor(Date.now() / 1000);

export const MOCK_STORIES: HnStory[] = [
  { id: 1, by: "pg", time: now - 3600, title: "Hacker News", url: "https://news.ycombinator.com", score: 500, descendants: 120, kids: [] },
  { id: 2, by: "dang", time: now - 7200, title: "Show HN: A new programming language", url: "https://example.com/lang", score: 340, descendants: 85, kids: [] },
  { id: 3, by: "tptacek", time: now - 10800, title: "Understanding Memory Safety in Rust", url: "https://example.com/rust", score: 280, descendants: 67, kids: [] },
  { id: 4, by: "patio11", time: now - 14400, title: "Salary Negotiation Tips for Engineers", url: "https://example.com/salary", score: 220, descendants: 150, kids: [] },
  { id: 5, by: "jgrahamc", time: now - 18000, title: "How Cloudflare Handles DDoS Attacks", url: "https://example.com/ddos", score: 190, descendants: 45, kids: [] },
  { id: 6, by: "sama", time: now - 21600, title: "The Future of AI Research", url: "https://example.com/ai", score: 410, descendants: 200, kids: [] },
  { id: 7, by: "rauchg", time: now - 25200, title: "Next.js 15 Released", url: "https://example.com/nextjs", score: 175, descendants: 38, kids: [] },
  { id: 8, by: "gaearon", time: now - 28800, title: "React Server Components Explained", url: "https://example.com/rsc", score: 310, descendants: 92, kids: [] },
  { id: 9, by: "antirez", time: now - 32400, title: "Redis 8.0: What's New", url: "https://example.com/redis", score: 250, descendants: 55, kids: [] },
  { id: 10, by: "mitsuhiko", time: now - 36000, title: "Building CLI Tools in Rust", url: "https://example.com/cli-rust", score: 160, descendants: 30, kids: [] },
];
