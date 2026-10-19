/** Formats accepted by `POST .../export` (semantica `export_graph`). */

export type GraphExportFormat =
  | 'json'
  | 'csv'
  | 'ttl'
  | 'ntriples'
  | 'jsonld'
  | 'rdfxml'
  | 'graphml';

export type GraphExportFormatMeta = {
  format: GraphExportFormat;
  /** File extension for download (matches Content-Disposition from API). */
  extension: string;
  /** `kbImportExport` key describing payload contents. */
  includedKey:
    | 'includedJson'
    | 'includedCsv'
    | 'includedRdf'
    | 'includedGraphml';
};

export const GRAPH_EXPORT_FORMATS: GraphExportFormatMeta[] = [
  { format: 'json', extension: 'json', includedKey: 'includedJson' },
  { format: 'csv', extension: 'csv', includedKey: 'includedCsv' },
  { format: 'ttl', extension: 'ttl', includedKey: 'includedRdf' },
  { format: 'ntriples', extension: 'nt', includedKey: 'includedRdf' },
  { format: 'jsonld', extension: 'jsonld', includedKey: 'includedRdf' },
  { format: 'rdfxml', extension: 'rdf', includedKey: 'includedRdf' },
  { format: 'graphml', extension: 'graphml', includedKey: 'includedGraphml' },
];

export function graphExportExtension(format: GraphExportFormat): string {
  return GRAPH_EXPORT_FORMATS.find((row) => row.format === format)?.extension ?? format;
}
