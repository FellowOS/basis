/** Turn `{ "0": item, "1": item, … }` locale blobs into ordered arrays. */
export function i18nIndexedList<T>(record: Record<string, T>): T[] {
  return Object.keys(record)
    .filter((key) => /^\d+$/.test(key))
    .sort((a, b) => Number(a) - Number(b))
    .map((key) => record[key]);
}
