import { Flex, Skeleton, Timeline, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import { getEducation } from '../../../shared/api/resume';
import type { EducationItem } from '../../../shared/data/types';
import { useResumeSection } from '../../../shared/hooks/useResumeSection';
import { ExpandableList } from './ExpandableList';

const { Text } = Typography;

type InstitutionGroup = {
  institution: string;
  url?: string;
  description?: string;
  field?: string;
  degrees: EducationItem[];
};

export function Education() {
  const { t } = useTranslation();
  const { data, loading } = useResumeSection(getEducation);

  if (loading)
    return (
      <Skeleton
        active
        paragraph={{ rows: 2 }}
      />
    );

  const groups = groupByInstitution(data);

  // A single institution reads as plain text; once a second one shows up,
  // switch to the same dotted Timeline used for work experience.
  if (groups.length > 1) {
    return (
      <ExpandableList
        items={groups}
        showAllLabel={t('education.showAll')}
        collapseLabel={t('education.collapse')}
        renderItems={(visibleGroups) => (
          <Timeline
            items={visibleGroups.map((group) => ({
              key: group.institution,
              content: <InstitutionContent group={group} />,
            }))}
          />
        )}
      />
    );
  }

  return (
    <Flex
      vertical
      gap="middle"
    >
      {groups.map((group) => (
        <InstitutionContent
          key={group.institution}
          group={group}
        />
      ))}
    </Flex>
  );
}

function InstitutionContent({ group }: { group: InstitutionGroup }) {
  const { t } = useTranslation();

  return (
    <div>
      <Text strong>
        {group.url ? (
          <a
            href={group.url}
            target="_blank"
            rel="noreferrer"
            style={{ color: 'inherit' }}
          >
            {group.institution}
          </a>
        ) : (
          group.institution
        )}
      </Text>
      {group.description && (
        <>
          <br />
          <Text>{group.description}</Text>
        </>
      )}
      {group.field && (
        <>
          <br />
          <Text type="secondary">{group.field}</Text>
        </>
      )}
      {group.degrees.map((degree) => (
        <div
          key={degree.id}
          style={{ marginTop: 4 }}
        >
          <Text style={{ textTransform: 'lowercase' }}>{degree.degree}</Text>
          <br />
          <Text type="secondary">
            {degree.endDate ? degree.endDate.split('-')[0] : t('common.present')}
            {degree.level ? ` · ${degree.level}` : ''}
          </Text>
        </div>
      ))}
    </div>
  );
}

function groupByInstitution(data: EducationItem[]): InstitutionGroup[] {
  const order: string[] = [];
  const byInstitution = new Map<string, EducationItem[]>();

  for (const item of data) {
    if (!byInstitution.has(item.institution)) {
      byInstitution.set(item.institution, []);
      order.push(item.institution);
    }
    byInstitution.get(item.institution)!.push(item);
  }

  return order.map((institution) => {
    const degrees = byInstitution.get(institution)!;
    return {
      institution,
      url: degrees[0].url,
      description: degrees[0].description,
      field: degrees[0].field,
      degrees,
    };
  });
}
