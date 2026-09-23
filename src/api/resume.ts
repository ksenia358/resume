import type { SupportedLanguage } from '../i18n'
import type {
  CertificateItem,
  EducationItem,
  ExperienceItem,
  ProfileInfo,
  SkillGroup,
} from '../data/types'

// Local JSON for now; swap each loader's body for a fetch to the PHP API once it exists.
export async function getExperience(lang: SupportedLanguage): Promise<ExperienceItem[]> {
  const module = await import(`../data/content/${lang}/experience.json`)
  return module.default
}

export async function getEducation(lang: SupportedLanguage): Promise<EducationItem[]> {
  const module = await import(`../data/content/${lang}/education.json`)
  return module.default
}

export async function getCertificates(lang: SupportedLanguage): Promise<CertificateItem[]> {
  const module = await import(`../data/content/${lang}/certificates.json`)
  return module.default
}

export async function getSkills(lang: SupportedLanguage): Promise<SkillGroup[]> {
  const module = await import(`../data/content/${lang}/skills.json`)
  return module.default
}

export async function getProfile(lang: SupportedLanguage): Promise<ProfileInfo> {
  const module = await import(`../data/content/${lang}/profile.json`)
  return module.default
}
