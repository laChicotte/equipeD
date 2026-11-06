import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { unprocessable } from '../../common/errors.js';

/**
 * Documents joints aux ressources : formats autorisés, contrôle du contenu réel et nom de fichier sûr.
 *
 * Le type annoncé par le navigateur n'est pas fiable : on exige une extension connue ET une
 * signature (premiers octets) cohérente avec elle. Le HTML, le SVG et les exécutables sont exclus,
 * et le téléchargement se fait toujours en pièce jointe (jamais affiché dans la page).
 */

/** Taille maximale d'un document (10 Mo), aussi garantie par une contrainte SQL. */
export const RESOURCE_FILE_MAX_BYTES = 10 * 1024 * 1024;
/** Document publié par l'équipe dans la bibliothèque (livres, guides) : 25 Mo. */
export const LIBRARY_FILE_MAX_BYTES = 25 * 1024 * 1024;
/** Couverture (réduite par le navigateur avant l'envoi) : 1 Mo au plus. */
export const COVER_MAX_BYTES = 1024 * 1024;

type Family = 'pdf' | 'zip' | 'ole' | 'png' | 'jpeg' | 'webp' | 'text';

const FORMATS: Record<string, { mime: string; family: Family }> = {
  pdf: { mime: 'application/pdf', family: 'pdf' },
  doc: { mime: 'application/msword', family: 'ole' },
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    family: 'zip',
  },
  xls: { mime: 'application/vnd.ms-excel', family: 'ole' },
  xlsx: {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    family: 'zip',
  },
  ppt: { mime: 'application/vnd.ms-powerpoint', family: 'ole' },
  pptx: {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    family: 'zip',
  },
  odt: { mime: 'application/vnd.oasis.opendocument.text', family: 'zip' },
  ods: { mime: 'application/vnd.oasis.opendocument.spreadsheet', family: 'zip' },
  odp: { mime: 'application/vnd.oasis.opendocument.presentation', family: 'zip' },
  txt: { mime: 'text/plain', family: 'text' },
  csv: { mime: 'text/csv', family: 'text' },
  png: { mime: 'image/png', family: 'png' },
  jpg: { mime: 'image/jpeg', family: 'jpeg' },
  jpeg: { mime: 'image/jpeg', family: 'jpeg' },
  webp: { mime: 'image/webp', family: 'webp' },
};

export const RESOURCE_FILE_EXTENSIONS = Object.keys(FORMATS);

const startsWith = (buf: Buffer, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

function matchesFamily(buf: Buffer, family: Family): boolean {
  switch (family) {
    case 'pdf':
      return startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    case 'zip':
      return startsWith(buf, [0x50, 0x4b, 0x03, 0x04]); // PK.. (Office Open XML, OpenDocument)
    case 'ole':
      return startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // anciens Office
    case 'png':
      return startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'jpeg':
      return startsWith(buf, [0xff, 0xd8, 0xff]);
    case 'webp':
      return (
        startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)
      );
    case 'text': {
      // Texte UTF-8 valide, sans octet nul (qui trahit un fichier binaire renommé).
      if (buf.includes(0)) return false;
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(buf);
        return true;
      } catch {
        return false;
      }
    }
  }
}

/**
 * Multer décode le nom de fichier en latin-1 : on le relit en UTF-8 quand c'est possible
 * (« CV_Aminata_Été.pdf » plutôt que « CV_Aminata_Ã‰tÃ©.pdf »).
 */
export function decodeUploadName(raw: string): string {
  const utf8 = Buffer.from(raw, 'latin1').toString('utf8');
  return utf8.includes('\uFFFD') ? raw : utf8;
}

/** Nom affichable et sûr : sans chemin, sans caractères de contrôle, 200 caractères au plus. */
export function safeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = [...base]
    .filter((c) => c.charCodeAt(0) > 0x1f && c.charCodeAt(0) !== 0x7f && !'"<>|:*?'.includes(c))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= 200) return cleaned || 'document';
  const dot = cleaned.lastIndexOf('.');
  const ext = dot > 0 ? cleaned.slice(dot) : '';
  return cleaned.slice(0, 200 - ext.length) + ext;
}

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

/** Type MIME du document s'il est autorisé et que son contenu correspond à son extension. */
export function detectResourceFile(fileName: string, data: Buffer): string | null {
  const format = FORMATS[extensionOf(fileName)];
  if (!format || data.length === 0) return null;
  return matchesFamily(data, format.family) ? format.mime : null;
}

/** En-tête Content-Disposition en pièce jointe, nom UTF-8 (RFC 6266 / 5987) avec repli ASCII. */
export function attachmentHeader(fileName: string): string {
  const ascii = fileName
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

// ─── Envoi (multipart) : partagé par les ressources, les messages privés et les groupes ───

/** Fichier reçu par multer (stockage en mémoire). */
export interface UploadedDocument {
  originalname: string;
  buffer: Buffer;
  size: number;
}

/** Un seul fichier « file », 10 Mo au plus, gardé en mémoire puis stocké en base. */
export const documentUpload = () =>
  FileInterceptor('file', {
    limits: { fileSize: RESOURCE_FILE_MAX_BYTES, files: 1, fields: 10, fieldSize: 8 * 1024 },
  });

/** Bibliothèque : un document « file » et une couverture « cover » facultatifs. */
export const libraryUpload = () =>
  FileFieldsInterceptor(
    [
      { name: 'file', maxCount: 1 },
      { name: 'cover', maxCount: 1 },
    ],
    { limits: { fileSize: LIBRARY_FILE_MAX_BYTES, files: 2, fields: 20, fieldSize: 8 * 1024 } },
  );

/** Couverture : image PNG, JPEG ou WebP réelle (signature vérifiée), 1 Mo au plus. */
export function readUploadedCover(upload: UploadedDocument) {
  const fail = (message: string) =>
    unprocessable('COVER_INVALID', message, [{ field: 'cover', messages: [message] }]);
  if (upload.size === 0 || upload.size > COVER_MAX_BYTES)
    throw fail('La couverture doit être une image de 1 Mo au plus.');
  const buf = upload.buffer;
  const mimeType = matchesFamily(buf, 'jpeg')
    ? 'image/jpeg'
    : matchesFamily(buf, 'png')
      ? 'image/png'
      : matchesFamily(buf, 'webp')
        ? 'image/webp'
        : null;
  if (!mimeType) throw fail('La couverture doit être une image JPEG, PNG ou WebP.');
  return { mimeType, size: upload.size, data: new Uint8Array(buf) };
}

/**
 * Contrôle d'un document reçu : non vide, extension autorisée, contenu réel cohérent.
 * Renvoie les colonnes à stocker (nom sûr, type détecté, taille, octets).
 */
export function readUploadedDocument(upload: UploadedDocument) {
  if (upload.size === 0) {
    throw unprocessable('FILE_EMPTY', 'Le document envoyé est vide.', [
      { field: 'file', messages: ['Le document envoyé est vide.'] },
    ]);
  }
  const fileName = safeFileName(decodeUploadName(upload.originalname));
  const mimeType = detectResourceFile(fileName, upload.buffer);
  if (!mimeType) {
    throw unprocessable(
      'FILE_INVALID_TYPE',
      'Formats acceptés : PDF, Word, Excel, PowerPoint, OpenDocument, texte, CSV, PNG, JPEG ou WebP.',
      [{ field: 'file', messages: ['Format de document non accepté ou fichier endommagé.'] }],
    );
  }
  return { fileName, mimeType, size: upload.size, data: new Uint8Array(upload.buffer) };
}

/** Les images (PNG, JPEG, WebP) peuvent s'afficher dans la page ; tout le reste se télécharge. */
export const isInlineImage = (mimeType: string) =>
  mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/webp';

/** Envoi d'un fichier stocké : en-têtes sûrs (pièce jointe, CSP bac à sable, pas de cache partagé). */
export function sendStoredFile(
  res: Response,
  file: { fileName: string; mimeType: string; size: number; data: Uint8Array },
  opts: { inline?: boolean; isPublic?: boolean } = {},
) {
  const inline = opts.inline === true && isInlineImage(file.mimeType);
  res
    .status(200)
    .type(file.mimeType)
    .set({
      'Content-Disposition': inline ? 'inline' : attachmentHeader(file.fileName),
      'Content-Length': String(file.size),
      'Cache-Control': opts.isPublic ? 'public, max-age=300' : 'private, no-store',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    })
    .send(Buffer.from(file.data));
}
