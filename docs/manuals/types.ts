/** Shared shape of a manual. Content lives in content/*.ts; build.ts renders it to PDF. */

/** A screenshot plus the marker keys (from marks.json) to number on it, in order. */
export interface Shot {
  shot: string;
  marks?: string[];
}

/** Big screenshot on the left, title + numbered points on the right. Point i ↔ marker i+1. */
export interface Step extends Shot {
  kind: "step";
  title: string;
  points: string[];
  /** Extra un-numbered bullets under the points. */
  extra?: string[];
  tip?: string;
  warn?: string;
}

/** A grid of small screenshots with captions (overviews, quick start). */
export interface Tiles {
  kind: "tiles";
  tiles: (Shot & { caption: string })[];
}

/** Troubleshooting card: "you see this" → "do this". Screenshot optional. */
export interface Trouble extends Partial<Shot> {
  kind: "trouble";
  icon?: string;
  problem: string;
  fix: string[];
}

/** A coloured box of bullets. */
export interface Note {
  kind: "note";
  icon: string;
  title: string;
  items: string[];
  tone?: "info" | "warn" | "ok";
}

/** A two-column reference table (e.g. what each flag means). */
export interface Table {
  kind: "table";
  head: [string, string];
  rows: [string, string][];
}

export type Block = Step | Tiles | Trouble | Note | Table;

export interface Section {
  icon: string;
  title: string;
  intro?: string;
  blocks: Block[];
}

export interface Manual {
  /** Output file name, without extension. */
  file: string;
  /** <html lang>. */
  lang: "th" | "my";
  /** Screenshot folder under docs/manuals/screenshots. */
  shots: string;
  title: string;
  subtitle: string;
  draft: string;
  exampleNote: string;
  contentsTitle: string;
  sections: Section[];
}
