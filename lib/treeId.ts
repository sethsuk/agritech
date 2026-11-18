// Tree ID convention: [zone letter][side L|R][row]-[column], e.g. "AL13-7".
// Format is validated (any zone letter, any row/column number) — uniqueness against
// existing trees is the real guard, so the farm can add new zones/rows without a code change.

const TREE_ID_PATTERN = /^([A-Z])(L|R)(\d{1,2})-(\d{1,2})$/;

export interface ParsedTreeId {
  zone: string;
  side: "L" | "R";
  rowNum: number;
  position: number;
}

export function parseTreeId(treeId: string): ParsedTreeId | null {
  const match = TREE_ID_PATTERN.exec(treeId.trim().toUpperCase());
  if (!match) return null;
  const [, zone, side, row, col] = match;
  return {
    zone,
    side: side as "L" | "R",
    rowNum: parseInt(row, 10),
    position: parseInt(col, 10),
  };
}

export function isValidTreeId(treeId: string): boolean {
  return parseTreeId(treeId) !== null;
}

export function qrCodeForTreeId(treeId: string): string {
  return `QR_${treeId}_v1`;
}

// --- Zone keys: a zone letter + side, e.g. "AL". The one parser for zone filters, so
// a new zone (B, C…) shows up everywhere as soon as its first tree exists. ---

const ZONE_KEY_PATTERN = /^([A-Z])(L|R)$/;

export function zoneKey(zone: string, side: string): string {
  return `${zone}${side}`;
}

export function parseZoneKey(key: string | null | undefined): { zone: string; side: "L" | "R" } | null {
  const m = key ? ZONE_KEY_PATTERN.exec(key) : null;
  return m ? { zone: m[1], side: m[2] as "L" | "R" } : null;
}
