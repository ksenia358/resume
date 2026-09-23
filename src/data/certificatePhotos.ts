import practicumReactRu1 from '../assets/img/certificates/practicum-2023-react-ru-1.jpg';
import practicumReactRu2 from '../assets/img/certificates/practicum-2023-react-ru-2.jpg';
import practicumReactEn1 from '../assets/img/certificates/practicum-2023-react-en-1.jpg';
import practicumReactEn2 from '../assets/img/certificates/practicum-2023-react-en-2.jpg';
import specialistBasicsRuUdost from '../assets/img/certificates/specialist-2020-vue-basics-ru-udost.jpg';
import specialistBasicsRu from '../assets/img/certificates/specialist-2020-vue-basics-ru.jpg';
import specialistBasicsEn from '../assets/img/certificates/specialist-2020-vue-basics-en.jpg';
import specialistAdvancedRuUdost from '../assets/img/certificates/specialist-2020-vue-advanced-ru-udost.jpg';
import specialistAdvancedRu from '../assets/img/certificates/specialist-2020-vue-advanced-ru.jpg';
import specialistAdvancedEn from '../assets/img/certificates/specialist-2020-vue-advanced-en.jpg';
import js2011Ru from '../assets/img/certificates/js-2011-ru.jpg';
import js2011En from '../assets/img/certificates/js-2011-en.jpg';
import phpBasics2009Ru from '../assets/img/certificates/php-basics-2009-ru.jpg';
import phpBasics2009En from '../assets/img/certificates/php-basics-2009-en.jpg';
import programmingDb2009Ru from '../assets/img/certificates/programming-db-2009-ru.jpg';
import programmingDb2009En from '../assets/img/certificates/programming-db-2009-en.jpg';
import htmlCss2009Ru from '../assets/img/certificates/html-css-2009-ru.jpg';
import htmlCss2009En from '../assets/img/certificates/html-css-2009-en.jpg';
import phpMysql2010Ru from '../assets/img/certificates/php-mysql-2010-ru.jpg';
import phpMysql2010En from '../assets/img/certificates/php-mysql-2010-en.jpg';

import type { SupportedLanguage } from '../i18n';

export interface CertificatePhoto {
  src: string;
  lang: SupportedLanguage;
  /** Official "удостоверение" scan — always shown last, regardless of language. */
  isOfficialDocument?: boolean;
}

// Keyed by CertificateItem.id. Only certificates with scanned photos appear here;
// certificates without an entry fall back to plain text (or item.url, if set).
export const certificatePhotos: Record<string, CertificatePhoto[]> = {
  'cert-react-2023': [
    { src: practicumReactRu2, lang: 'ru' },
    { src: practicumReactRu1, lang: 'ru' },
    { src: practicumReactEn2, lang: 'en' },
    { src: practicumReactEn1, lang: 'en' },
  ],
  'cert-specialist-2020-1': [
    { src: specialistBasicsRu, lang: 'ru' },
    { src: specialistBasicsEn, lang: 'en' },
    { src: specialistBasicsRuUdost, lang: 'ru', isOfficialDocument: true },
  ],
  'cert-specialist-2020-2': [
    { src: specialistAdvancedRu, lang: 'ru' },
    { src: specialistAdvancedEn, lang: 'en' },
    { src: specialistAdvancedRuUdost, lang: 'ru', isOfficialDocument: true },
  ],
  'cert-js-2011': [
    { src: js2011Ru, lang: 'ru' },
    { src: js2011En, lang: 'en' },
  ],
  'cert-php-basics-2009': [
    { src: phpBasics2009Ru, lang: 'ru' },
    { src: phpBasics2009En, lang: 'en' },
  ],
  'cert-programming-db-2009': [
    { src: programmingDb2009Ru, lang: 'ru' },
    { src: programmingDb2009En, lang: 'en' },
  ],
  'cert-html-css-2009': [
    { src: htmlCss2009Ru, lang: 'ru' },
    { src: htmlCss2009En, lang: 'en' },
  ],
  'cert-php-mysql-2010': [
    { src: phpMysql2010Ru, lang: 'ru' },
    { src: phpMysql2010En, lang: 'en' },
  ],
};

export function getOrderedPhotos(photos: CertificatePhoto[], lang: SupportedLanguage): CertificatePhoto[] {
  return [...photos].sort((a, b) => rank(a, lang) - rank(b, lang));
}

function rank(photo: CertificatePhoto, lang: SupportedLanguage): number {
  if (photo.isOfficialDocument) return 2;
  return photo.lang === lang ? 0 : 1;
}
