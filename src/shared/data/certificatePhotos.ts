import type { SupportedLanguage } from '../../i18n';
import type { CertificatePhoto } from './types';

// Scans built into the site, by file name; the list of which certificate has which scan is in the resume data.
const bundled = import.meta.glob<string>('../assets/img/certificates/*', { eager: true, import: 'default' });
const bundledByName = Object.fromEntries(
  Object.entries(bundled).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]),
);

// A photo is either a file built into the site (a bare name) or one uploaded from the editor (an address).
export function photoUrl(src: string): string | undefined {
  return src.startsWith('/') || src.startsWith('http') ? src : bundledByName[src];
}

export function getOrderedPhotos(photos: CertificatePhoto[], lang: SupportedLanguage): CertificatePhoto[] {
  return [...photos].sort((a, b) => rank(a, lang) - rank(b, lang));
}

function rank(photo: CertificatePhoto, lang: SupportedLanguage): number {
  if (photo.isOfficialDocument) return 2;
  return photo.lang === lang ? 0 : 1;
}
