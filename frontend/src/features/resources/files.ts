/** Documents joints aux ressources : mêmes règles que l'API (10 Mo, formats bureautiques et images). */
export const RESOURCE_FILE_MAX_BYTES = 10 * 1024 * 1024;

const LABELS: Record<string, string> = {
  pdf: 'PDF',
  doc: 'Word',
  docx: 'Word',
  odt: 'Texte',
  xls: 'Excel',
  xlsx: 'Excel',
  ods: 'Tableur',
  ppt: 'PowerPoint',
  pptx: 'PowerPoint',
  odp: 'Présentation',
  txt: 'Texte',
  csv: 'CSV',
  png: 'Image',
  jpg: 'Image',
  jpeg: 'Image',
  webp: 'Image',
};

/** Valeur de l'attribut `accept` du champ fichier. */
export const RESOURCE_FILE_ACCEPT = Object.keys(LABELS)
  .map((ext) => `.${ext}`)
  .join(',');

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

/** « PDF », « Word »… ou « Document » pour un format inconnu. */
export function fileKindLabel(fileName: string): string {
  return LABELS[extensionOf(fileName)] ?? 'Document';
}

export function isAcceptedFile(fileName: string): boolean {
  return extensionOf(fileName) in LABELS;
}

/** Taille lisible en français : « 850 Ko », « 2,4 Mo ». */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}

export const resourceFileUrl = (resourceId: string) => `/api/v1/resources/${resourceId}/file`;
