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

export interface CertificateItem {
  id: string;
  name: string;
  issuer: string;
  issuerUrl?: string;
  date: string; // YYYY
  url?: string;
}

export interface SkillGroup {
  id: string;
  category: string;
  items: string[];
}

export type GenderCode = 'female' | 'male';

export interface ProfileInfo {
  fullName: string;
  birthDate: string; // YYYY-MM-DD
  gender: string;
  genderCode: GenderCode;
  phones: string[];
  telegram: string[];
  email: string[];
}
