import { Skeleton, Tag, message } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SupportedLanguage } from '../../../i18n';
import { getSkills, saveResumeSection } from '../../../shared/api/resume';
import { useResumeSection } from '../../../shared/hooks/useResumeSection';
import { useResumeEdit } from '../editMode';
import { SortableTags } from './SortableTags';

// "UI Kit" from the experience tags and "UI-KIT" here should count as the same technology.
function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s.\-_]/g, '');
}

interface SkillsProps {
  // Technologies the visitor picked in the tech-match modal.
  highlighted?: string[];
}

// Tags are listed in skills.json from most to least used in my experience.
export function Skills({ highlighted = [] }: SkillsProps) {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'ru') as SupportedLanguage;
  const { data, loading } = useResumeSection(getSkills);
  const highlightedKeys = new Set(highlighted.map(normalize));
  const editing = Boolean(useResumeEdit());
  // A dragged order shows at once, until the saved resume comes back with it.
  const [dragged, setDragged] = useState<{ data: string[]; order: string[] } | null>(null);
  const [messageApi, messageContext] = message.useMessage();

  if (loading)
    return (
      <Skeleton
        active
        paragraph={{ rows: 2 }}
      />
    );

  const onReorder = async (order: string[]) => {
    setDragged({ data, order });
    try {
      await saveResumeSection(lang, 'skills', order);
    } catch (error) {
      setDragged(null);
      messageApi.error(`Не удалось сохранить порядок: ${(error as Error).message}`);
    }
  };

  return (
    <>
      {messageContext}
      <SortableTags
        tags={dragged?.data === data ? dragged.order : data}
        renderTag={(skill) => (
          <Tag
            color={highlightedKeys.has(normalize(skill)) ? 'success' : undefined}
            style={{ marginInlineEnd: 0 }}
          >
            {skill}
          </Tag>
        )}
        onReorder={editing ? onReorder : undefined}
      />
    </>
  );
}
