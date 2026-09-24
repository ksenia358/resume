import type { SupportedLanguage } from '../i18n';
import type { CertificateItem, EducationItem, ExperienceItem, ProfileInfo, SkillGroup } from '../data/types';

// Local JSON for now; swap each loader's body for a fetch to the PHP API once it exists.
export async function getExperience(lang: SupportedLanguage): Promise<ExperienceItem[]> {
  const [module, technologies] = await Promise.all([
    import(`../data/content/${lang}/experience.json`),
    import('../data/content/technologies.json'),
  ]);
  // Technology tags are language-neutral, so they live in one shared file keyed by item id.
  const tagsById: Record<string, string[]> = technologies.default;
  return (module.default as Omit<ExperienceItem, 'technologies'>[]).map((item) => ({
    ...item,
    technologies: tagsById[item.id],
  }));
}

export async function getEducation(lang: SupportedLanguage): Promise<EducationItem[]> {
  const module = await import(`../data/content/${lang}/education.json`);
  return module.default;
}

export async function getCertificates(lang: SupportedLanguage): Promise<CertificateItem[]> {
  const module = await import(`../data/content/${lang}/certificates.json`);
  return module.default;
}

export async function getSkills(lang: SupportedLanguage): Promise<SkillGroup[]> {
  const module = await import(`../data/content/${lang}/skills.json`);
  return module.default;
}

export async function getProfile(lang: SupportedLanguage): Promise<ProfileInfo> {
  const module = await import(`../data/content/${lang}/profile.json`);
  return module.default;
}
