export type DataPage<T> = { items: T[]; nextCursor?: string | null };
export async function collectPages<T>(loadPage: (cursor: string | null) => Promise<DataPage<T>>): Promise<T[]> {
  const all: T[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;
  do {
    const response = await loadPage(cursor);
    if (!Array.isArray(response.items)) throw new Error('The record list could not be loaded completely. Refresh the workspace.');
    all.push(...response.items);
    cursor = response.nextCursor ?? null;
    if (cursor && seen.has(cursor)) throw new Error('The record list could not be loaded completely. Refresh the workspace.');
    if (cursor) seen.add(cursor);
  } while (cursor);
  return all;
}
