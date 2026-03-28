/** HN API Item (story, comment, etc.) */
export interface HnItem {
  id: number;
  type: "story" | "comment" | "job" | "poll" | "pollopt";
  by: string;
  time: number;
  text?: string;
  url?: string;
  title?: string;
  score?: number;
  descendants?: number;
  kids?: number[];
  parent?: number;
  dead?: boolean;
  deleted?: boolean;
}

export interface HnStory {
  id: number;
  by: string;
  time: number;
  title: string;
  url?: string;
  score: number;
  descendants: number;
  kids: number[];
}

export interface HnComment {
  id: number;
  by: string;
  time: number;
  text: string;
  kids: number[];
  parent: number;
}

export interface HnUser {
  id: string;
  created: number;
  karma: number;
  about?: string;
  submitted: number[];
}
