import type { ReactNode } from 'react';
import { useState } from 'react';
import { Skeleton, Tag, Timeline, Typography, message } from 'antd';
import { useTranslation } from 'react-i18next';

import { getExperience, saveResumeSection } from '../../../shared/api/resume';
import type { ExperienceItem } from '../../../shared/data/types';
import type { SupportedLanguage } from '../../../i18n';
import { useResumeSection } from '../../../shared/hooks/useResumeSection';
import { formatDuration, formatMonthYear, formatTotalDuration } from '../../../shared/utils/formatDate';
import { EditButton } from './EditButton';
import { useResumeEdit } from '../editMode';
import { ExpandableList } from './ExpandableList';
import { SortableTags } from './SortableTags';

const { Text } = Typography;

// Highlights may contain markdown-style links: "[label](https://example.com)".
const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

function renderWithLinks(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const [whole, label, href] = match;
    parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noreferrer"
      >
        {label}
      </a>,
    );
    lastIndex = match.index + whole.length;
  }
  parts.push(text.slice(lastIndex));

  return parts;
}

export function ExperienceTitle() {
  const { t, i18n } = useTranslation();
  const { data, loading } = useResumeSection(getExperience);
  const lang = (i18n.resolvedLanguage ?? 'ru') as SupportedLanguage;

  const webData = data.filter((item) => item.web);

  return (
    <>
      {t('experience.title')}
      {!loading && data.length > 0 && (
        <Text
          type="secondary"
          style={{ fontWeight: 'normal' }}
        >
          {' '}
          ({formatTotalDuration(data, lang)}
          {webData.length > 0 && `, ${t('experience.inDevelopment')} — ${formatTotalDuration(webData, lang)}`})
        </Text>
      )}
    </>
  );
}

interface ExperienceProps {
  // Technologies to mark green, e.g. the visitor's stack matched in TechMatch.
  highlighted?: string[];
}

export function Experience({ highlighted = [] }: ExperienceProps) {
  const { t, i18n } = useTranslation();
  const { data, loading } = useResumeSection(getExperience);
  const editing = Boolean(useResumeEdit());
  // A dragged tag order shows at once, until the saved resume comes back with it.
  const [dragged, setDragged] = useState<{ data: ExperienceItem[]; id: string; order: string[] } | null>(null);
  const [messageApi, messageContext] = message.useMessage();
  const lang = (i18n.resolvedLanguage ?? 'ru') as SupportedLanguage;

  if (loading)
    return (
      <Skeleton
        active
        paragraph={{ rows: 3 }}
      />
    );

  return (
    <>
      {messageContext}
      <ExpandableList
        items={data}
        showAllLabel={t('experience.showAll')}
        collapseLabel={t('experience.collapse')}
        renderItems={(visibleData) => (
          <Timeline
            items={visibleData.map((item) => ({
              key: item.id,
              content: (
                <>
                  <Text strong>{item.role}</Text>
                  {' · '}
                  <Text>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'inherit' }}
                      >
                        {item.company}
                      </a>
                    ) : (
                      item.company
                    )}
                  </Text>
                  <EditButton target={{ section: 'experience', item }} />
                  <br />
                  <Text type="secondary">
                    {formatMonthYear(item.startDate, i18n.language)} —{' '}
                    {item.endDate ? formatMonthYear(item.endDate, i18n.language) : t('common.present')} (
                    {formatDuration(item.startDate, item.endDate, lang)}){item.location ? ` · ${item.location}` : ''}
                  </Text>
                  <ul
                    style={{
                      marginTop: 8,
                      marginBottom: item.technologies ? 4 : 0,
                      paddingLeft: 20,
                    }}
                  >
                    {item.highlights.map((highlight, index) => (
                      <li key={index}>{renderWithLinks(highlight)}</li>
                    ))}
                  </ul>
                  {item.technologies && (
                    <SortableTags
                      tags={dragged?.data === data && dragged.id === item.id ? dragged.order : item.technologies}
                      renderTag={(tech) => (
                        <Tag
                          color={highlighted.includes(tech) ? 'success' : undefined}
                          style={{ marginInlineEnd: 0 }}
                        >
                          {tech}
                        </Tag>
                      )}
                      onReorder={
                        editing
                          ? async (order) => {
                              setDragged({ data, id: item.id, order });
                              try {
                                await saveResumeSection(lang, 'experience', { ...item, technologies: order }, item.id);
                              } catch (error) {
                                setDragged(null);
                                messageApi.error(`Не удалось сохранить порядок: ${(error as Error).message}`);
                              }
                            }
                          : undefined
                      }
                    />
                  )}
                </>
              ),
            }))}
          />
        )}
      />
    </>
  );
}
