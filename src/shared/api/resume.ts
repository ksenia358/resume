import type { SupportedLanguage } from '../../i18n';
import type { CertificateItem, CertificatePhoto, EducationItem, ExperienceItem, ProfileInfo } from '../data/types';

// PHP lives next to the site on the same hosting (public/api/resume.php); the content is stored in MySQL.
const RESUME_ENDPOINT = import.meta.env.VITE_RESUME_API_URL || '/api/resume.php';

// `yarn dev` reads the local JSON unless VITE_RESUME_SOURCE=api; the built site asks the API.
const SOURCE = import.meta.env.VITE_RESUME_SOURCE || (import.meta.env.DEV ? 'json' : 'api');

type Resume = {
  profile: ProfileInfo;
  experience: ExperienceItem[];
  education: EducationItem[];
  certificates: CertificateItem[];
  skills: string[];
};

// The same content the database was filled from. In the built site it's a separate chunk,
// downloaded only when the API fails.
async function getLocalResume(lang: SupportedLanguage): Promise<Resume> {
  const [profile, experience, education, certificates, skills, technologies, photos] = await Promise.all([
    import(`../data/content/${lang}/profile.json`),
    import(`../data/content/${lang}/experience.json`),
    import(`../data/content/${lang}/education.json`),
    import(`../data/content/${lang}/certificates.json`),
    import(`../data/content/${lang}/skills.json`),
    import('../data/content/technologies.json'),
    import('../data/content/certificatePhotos.json'),
  ]);
  // Technology tags are language-neutral, so they live in one shared file keyed by item id.
  const tagsById: Record<string, string[]> = technologies.default;
  return {
    profile: profile.default,
    experience: (experience.default as Omit<ExperienceItem, 'technologies'>[]).map((item) => ({
      ...item,
      technologies: tagsById[item.id],
    })),
    education: education.default,
    // Photos are language-neutral too, keyed by certificate id.
    certificates: (certificates.default as CertificateItem[]).map((item) => ({
      ...item,
      photos: (photos.default as Record<string, CertificatePhoto[]>)[item.id],
    })),
    skills: skills.default,
  };
}

async function getApiResume(lang: SupportedLanguage): Promise<Resume> {
  try {
    // After an edit the browser's 5-minute copy is stale, so ask the server again.
    const response = await fetch(`${RESUME_ENDPOINT}?lang=${lang}`, { cache: version > 0 ? 'reload' : 'default' });
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    return (await response.json()) as Resume;
  } catch (error) {
    // An empty resume is worse than a slightly outdated one.
    console.warn('Resume API failed, showing the bundled copy:', error);
    return getLocalResume(lang);
  }
}

// Every section comes from one response, so the page makes a single request per language.
const requests = new Map<SupportedLanguage, Promise<Resume>>();

// Bumped after every saved edit: hooks re-read the resume when it changes.
let version = 0;
const listeners = new Set<() => void>();

export function subscribeToResume(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getResumeVersion(): number {
  return version;
}

// Called after any change to the resume, so the page loads it again.
export function invalidateResume(): void {
  requests.clear();
  version += 1;
  listeners.forEach((listener) => listener());
}

export type EditableSection = 'profile' | 'experience' | 'education' | 'certificates' | 'skills';

async function postResume(body: object): Promise<void> {
  const response = await fetch(RESUME_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as { error?: string; field?: string };
    throw new Error(result.field ? `неверное поле ${result.field}` : (result.error ?? `status ${response.status}`));
  }
  invalidateResume();
}

// Saves one block of the resume: the whole profile or skills list, or one item (by id) of the other sections;
// an item without an id is added to both languages.
// On the site it goes to the database (admin cookie required); in `yarn dev` the dev server writes the JSON files.
export function saveResumeSection(
  lang: SupportedLanguage,
  section: EditableSection,
  data: unknown,
  id?: string,
): Promise<void> {
  return postResume({ lang, section, id, data });
}

// PHP next to resume.php (public/api/photo.php).
const PHOTO_ENDPOINT = import.meta.env.VITE_PHOTO_API_URL || '/api/photo.php';

// Replaces the profile photo (both languages); the body is the JPEG itself.
// On the site it's stored on the server; in `yarn dev` it replaces the photo built into the project.
export function uploadPhoto(image: Blob): Promise<void> {
  return postPhoto('', image, 'image/jpeg');
}

async function postPhoto(query: string, body: BodyInit, type: string): Promise<void> {
  const response = await fetch(`${PHOTO_ENDPOINT}${query}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': type },
    body,
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(result.error ?? `status ${response.status}`);
  }
  invalidateResume();
}

// Adds a scan to a certificate; `lang` is the version it belongs to (shown first there).
export function uploadCertificatePhoto(lang: SupportedLanguage, certificateId: string, image: Blob): Promise<void> {
  return postPhoto(`?for=certificate&id=${encodeURIComponent(certificateId)}&lang=${lang}`, image, 'image/jpeg');
}

export function deleteCertificatePhoto(certificateId: string, src: string): Promise<void> {
  return postPhoto('?delete=certificate', JSON.stringify({ id: certificateId, src }), 'application/json');
}

// Removes an item from both languages.
export function deleteResumeItem(
  lang: SupportedLanguage,
  section: 'experience' | 'education' | 'certificates',
  id: string,
): Promise<void> {
  return postResume({ lang, section, id, delete: true });
}

function getResume(lang: SupportedLanguage): Promise<Resume> {
  let request = requests.get(lang);
  if (!request) {
    request = SOURCE === 'json' ? getLocalResume(lang) : getApiResume(lang);
    requests.set(lang, request);
  }
  return request;
}

export async function getExperience(lang: SupportedLanguage): Promise<ExperienceItem[]> {
  return (await getResume(lang)).experience;
}

export async function getEducation(lang: SupportedLanguage): Promise<EducationItem[]> {
  return (await getResume(lang)).education;
}

export async function getCertificates(lang: SupportedLanguage): Promise<CertificateItem[]> {
  return (await getResume(lang)).certificates;
}

export async function getSkills(lang: SupportedLanguage): Promise<string[]> {
  return (await getResume(lang)).skills;
}

export async function getProfile(lang: SupportedLanguage): Promise<ProfileInfo> {
  return (await getResume(lang)).profile;
}
