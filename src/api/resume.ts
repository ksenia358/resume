import type { SupportedLanguage } from '../i18n';
import type { CertificateItem, EducationItem, ExperienceItem, ProfileInfo } from '../data/types';

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
  const [profile, experience, education, certificates, skills, technologies] = await Promise.all([
    import(`../data/content/${lang}/profile.json`),
    import(`../data/content/${lang}/experience.json`),
    import(`../data/content/${lang}/education.json`),
    import(`../data/content/${lang}/certificates.json`),
    import(`../data/content/${lang}/skills.json`),
    import('../data/content/technologies.json'),
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
    certificates: certificates.default,
    skills: skills.default,
  };
}

async function getApiResume(lang: SupportedLanguage): Promise<Resume> {
  try {
    const response = await fetch(`${RESUME_ENDPOINT}?lang=${lang}`);
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
