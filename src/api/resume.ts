import type { SupportedLanguage } from '../i18n';
import type { CertificateItem, EducationItem, ExperienceItem, ProfileInfo } from '../data/types';

// PHP lives next to the site on the same hosting (public/api/resume.php); the content is stored in MySQL.
const RESUME_ENDPOINT = import.meta.env.VITE_RESUME_API_URL || '/api/resume.php';

type Resume = {
  profile: ProfileInfo;
  experience: ExperienceItem[];
  education: EducationItem[];
  certificates: CertificateItem[];
  skills: string[];
};

// Every section comes from one response, so the page makes a single request per language.
const requests = new Map<SupportedLanguage, Promise<Resume>>();

function getResume(lang: SupportedLanguage): Promise<Resume> {
  let request = requests.get(lang);
  if (!request) {
    request = fetch(`${RESUME_ENDPOINT}?lang=${lang}`).then((response) => {
      if (!response.ok) {
        throw new Error(`Resume request failed with status ${response.status}`);
      }
      return response.json() as Promise<Resume>;
    });
    // A failed request isn't cached, so switching the language back tries again.
    request.catch(() => requests.delete(lang));
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
