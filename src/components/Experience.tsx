import { Flex, Skeleton, Tag, Timeline, Typography } from 'antd'
import { useTranslation } from 'react-i18next'

import { getExperience } from '../api/resume'
import type { SupportedLanguage } from '../i18n'
import { useResumeSection } from '../hooks/useResumeSection'
import { formatDuration, formatMonthYear, formatTotalDuration } from '../utils/formatDate'
import { ExpandableList } from './ExpandableList'

const { Text } = Typography

export function ExperienceTitle() {
  const { t, i18n } = useTranslation()
  const { data, loading } = useResumeSection(getExperience)
  const lang = (i18n.resolvedLanguage ?? 'ru') as SupportedLanguage

  const webData = data.filter((item) => item.web)

  return (
    <>
      {t('experience.title')}
      {!loading && data.length > 0 && (
        <Text type="secondary" style={{ fontWeight: 'normal' }}>
          {' '}
          ({formatTotalDuration(data, lang)}
          {webData.length > 0 &&
            `, ${t('experience.inDevelopment')} — ${formatTotalDuration(webData, lang)}`}
          )
        </Text>
      )}
    </>
  )
}

export function Experience() {
  const { t, i18n } = useTranslation()
  const { data, loading } = useResumeSection(getExperience)
  const lang = (i18n.resolvedLanguage ?? 'ru') as SupportedLanguage

  if (loading) return <Skeleton active paragraph={{ rows: 3 }} />

  return (
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
                    <a href={item.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
                      {item.company}
                    </a>
                  ) : (
                    item.company
                  )}
                </Text>
                <br />
                <Text type="secondary">
                  {formatMonthYear(item.startDate, i18n.language)} —{' '}
                  {item.endDate
                    ? formatMonthYear(item.endDate, i18n.language)
                    : t('common.present')}{' '}
                  ({formatDuration(item.startDate, item.endDate, lang)})
                  {item.location ? ` · ${item.location}` : ''}
                </Text>
                <ul
                  style={{
                    marginTop: 8,
                    marginBottom: item.technologies ? 4 : 0,
                    paddingLeft: 20,
                  }}
                >
                  {item.highlights.map((highlight, index) => (
                    <li key={index}>{highlight}</li>
                  ))}
                </ul>
                {item.technologies && (
                  <Flex wrap gap={4}>
                    {item.technologies.map((tech) => (
                      <Tag key={tech} style={{ marginInlineEnd: 0 }}>
                        {tech}
                      </Tag>
                    ))}
                  </Flex>
                )}
              </>
            ),
          }))}
        />
      )}
    />
  )
}
