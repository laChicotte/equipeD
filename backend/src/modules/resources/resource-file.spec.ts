import {
  attachmentHeader,
  decodeUploadName,
  detectResourceFile,
  safeFileName,
} from './resource-file.js';

const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj\n', 'latin1');
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

describe('documents joints aux ressources', () => {
  it('accepte un document dont le contenu correspond à l’extension', () => {
    expect(detectResourceFile('guide.pdf', PDF)).toBe('application/pdf');
    expect(detectResourceFile('CV.DOCX', ZIP)).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(detectResourceFile('notes.txt', Buffer.from('Préparer l’entretien', 'utf8'))).toBe(
      'text/plain',
    );
  });

  it('refuse un format non autorisé ou un fichier renommé', () => {
    expect(detectResourceFile('page.html', Buffer.from('<html>'))).toBeNull();
    expect(detectResourceFile('logo.svg', Buffer.from('<svg>'))).toBeNull();
    expect(detectResourceFile('outil.exe', Buffer.from('MZ'))).toBeNull();
    // Un exécutable renommé en .pdf n'a pas la signature PDF.
    expect(detectResourceFile('faux.pdf', Buffer.from('MZ\x90\x00'))).toBeNull();
    // Un binaire renommé en .txt contient des octets nuls.
    expect(detectResourceFile('faux.txt', Buffer.from([0x41, 0x00, 0x42]))).toBeNull();
    expect(detectResourceFile('sans-extension', PDF)).toBeNull();
  });

  it('produit un nom de fichier sûr et lisible', () => {
    expect(safeFileName('C:\\Users\\moi\\CV "final".pdf')).toBe('CV final.pdf');
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('a\u0000b\u001f.pdf')).toBe('ab.pdf');
    const long = safeFileName(`${'x'.repeat(300)}.pdf`);
    expect(long).toHaveLength(200);
    expect(long.endsWith('.pdf')).toBe(true);
    // Nom envoyé en UTF-8 mais lu en latin-1 par multer.
    expect(decodeUploadName(Buffer.from('Été.pdf', 'utf8').toString('latin1'))).toBe('Été.pdf');
  });

  it('télécharge toujours en pièce jointe avec un nom encodé', () => {
    expect(attachmentHeader('Guide d’entretien.pdf')).toBe(
      'attachment; filename="Guide d_entretien.pdf"; filename*=UTF-8\'\'Guide%20d%E2%80%99entretien.pdf',
    );
  });
});
