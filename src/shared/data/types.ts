import type { SupportedLanguage } from '../../i18n';

export interface ExperienceItem {
  id: string;
  company: string;
  url?: string;
  role: string;
  location?: string;
  startDate: string; // YYYY-MM
  endDate: string | null; // YYYY-MM, null = present
  highlights: string[];
  technologies?: string[];
  web?: boolean; // counts toward web development experience (vs. unrelated roles)
}

export interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  level?: string; // e.g. "Higher education"
  field?: string;
  startDate: string;
  endDate: string | null;
  description?: string;
  url?: string;
}

export interface CertificatePhoto {
  // A file built into the site (its name in assets/img/certificates) or the address of an uploaded one.
  src: string;
  lang: SupportedLanguage;
  /** Official "удостоверение" scan — always shown last, regardless of language. */
  isOfficialDocument?: boolean;
}

export interface CertificateItem {
  id: string;
  name: string;
  issuer: string;
  issuerUrl?: string;
  date: string; // YYYY
  url?: string;
  // Scans shown in the gallery; shared by both languages of the certificate.
  photos?: CertificatePhoto[];
}

// 'none' hides the gender badge next to the photo.
export type GenderCode = 'female' | 'male' | 'none';

export interface ProfileInfo {
  fullName: string;
  role: string; // the profession under the name, e.g. "Frontend-разработчик"
  tagline?: string;
  birthDate: string; // YYYY-MM-DD
  gender: string;
  genderCode: GenderCode;
  phones: string[];
  // Each contact list in one column, or a column per entry. By default phones are split, the rest together.
  phonesTogether?: boolean;
  emailTogether?: boolean;
  telegramTogether?: boolean;
  // Whether the "Am I a good fit?" and "Write" links are shown next to the contacts (both by default).
  showTechMatch?: boolean;
  showWrite?: boolean;
  // Keys of the contact cells in the order they're shown, set by dragging them on the edit page.
  contactsOrder?: string[];
  // Their order on a phone, where they're in one column; without it phones use contactsOrder.
  contactsOrderMobile?: string[];
  // Sections turned off with the eye on the edit page: 'experience', 'education', 'certificates', 'skills', 'contact'.
  hiddenSections?: string[];
  // Address of an uploaded photo; without it the site shows the one built into the project.
  photo?: string;
  telegram: string[];
  email: string[];
}
