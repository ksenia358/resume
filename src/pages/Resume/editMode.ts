import { createContext, useContext } from 'react';

import type { CertificateItem, EducationItem, ExperienceItem } from '../../shared/data/types';

// A block of the resume that can be edited on its own; a list item without `item` is a new one.
export type EditTarget =
  | { section: 'profile' }
  | { section: 'skills' }
  | { section: 'experience'; item?: ExperienceItem }
  | { section: 'education'; item?: EducationItem }
  | { section: 'certificates'; item?: CertificateItem };

export type ListSection = 'experience' | 'education' | 'certificates';

// Set only on the edit page: then every block shows a pencil that opens its form.
export const ResumeEditContext = createContext<((target: EditTarget) => void) | null>(null);

export function useResumeEdit() {
  return useContext(ResumeEditContext);
}
