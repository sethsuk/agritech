/**
 * Read every row of a query, page by page.
 *
 * Supabase's API returns at most 1000 rows per request (PostgREST `max-rows`), and a
 * client-side `.range(0, 9999)` can't raise that — the server silently truncates. With
 * 1035 seeded trees the trees list showed exactly 1000, and anything past the cap (a
 * new zone's trees, older harvests) just vanished. Use this for any list that can grow
 * past 1000; prefer aggregating in SQL when only totals are needed.
 *
 *   const rows = await fetchAll((from, to) =>
 *     admin.from("trees").select("tree_id").order("tree_id").range(from, to));
 *
 * The query MUST have a deterministic order, or pages can overlap/skip.
 */
const PAGE = 1000;

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { data: all, error };
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) return { data: all, error: null };
  }
}
