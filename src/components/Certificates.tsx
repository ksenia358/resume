import { useState } from 'react';
import { Image, Skeleton, Timeline, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import { getCertificates } from '../api/resume.ts';
import { certificatePhotos, getOrderedPhotos } from '../data/certificatePhotos.ts';
import type { CertificateItem } from '../data/types.ts';
import type { SupportedLanguage } from '../i18n';
import { useResumeSection } from '../hooks/useResumeSection.ts';
import { ExpandableList } from './ExpandableList.tsx';

const { Text } = Typography;

export function Certificates() {
  const { data, loading } = useResumeSection(getCertificates);
  const { t, i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'ru') as SupportedLanguage;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (loading)
    return (
      <Skeleton
        active
        paragraph={{ rows: 2 }}
      />
    );

  const groups = groupByIssuer(data);
  const { items, startIndexById } = buildGallery(data, lang);

  return (
    <>
      <ExpandableList
        items={groups}
        showAllLabel={t('certificates.showAll')}
        collapseLabel={t('certificates.collapse')}
        renderItems={(visibleGroups) => (
          <Timeline
            items={visibleGroups.map((group) => ({
              key: group.issuer,
              content: (
                <>
                  <Text strong>
                    {group.issuerUrl ? (
                      <a
                        href={group.issuerUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'inherit' }}
                      >
                        {group.issuer}
                      </a>
                    ) : (
                      group.issuer
                    )}
                  </Text>
                  {group.courses.map((course) => {
                    const startIndex = startIndexById.get(course.id);

                    return (
                      <div
                        key={course.id}
                        style={{ marginTop: 4 }}
                      >
                        <Text>
                          {startIndex !== undefined ? (
                            <a onClick={() => setOpenIndex(startIndex)}>{course.name}</a>
                          ) : course.url ? (
                            <a
                              href={course.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {course.name}
                            </a>
                          ) : (
                            course.name
                          )}
                        </Text>{' '}
                        <Text type="secondary">· {course.date}</Text>
                      </div>
                    );
                  })}
                </>
              ),
            }))}
          />
        )}
      />
      <Image.PreviewGroup
        items={items}
        preview={{
          open: openIndex !== null,
          current: openIndex ?? 0,
          onChange: (next) => setOpenIndex(next),
          onOpenChange: (open) => {
            if (!open) setOpenIndex(null);
          },
        }}
      />
    </>
  );
}

// One combined gallery for all certificates: clicking a course only picks the
// starting slide (its own photo in the current language, then its other
// language, then any official "удостоверение" scan) — paging past it continues
// into the following certificates' photos, in the same order they're listed.
function buildGallery(
  data: CertificateItem[],
  lang: SupportedLanguage,
): { items: string[]; startIndexById: Map<string, number> } {
  const items: string[] = [];
  const startIndexById = new Map<string, number>();

  for (const item of data) {
    const photos = certificatePhotos[item.id];
    if (!photos) continue;

    startIndexById.set(item.id, items.length);
    items.push(...getOrderedPhotos(photos, lang).map((photo) => photo.src));
  }

  return { items, startIndexById };
}

function groupByIssuer(data: CertificateItem[]): { issuer: string; issuerUrl?: string; courses: CertificateItem[] }[] {
  const order: string[] = [];
  const byIssuer = new Map<string, CertificateItem[]>();

  for (const item of data) {
    if (!byIssuer.has(item.issuer)) {
      byIssuer.set(item.issuer, []);
      order.push(item.issuer);
    }
    byIssuer.get(item.issuer)!.push(item);
  }

  return order.map((issuer) => {
    const courses = byIssuer.get(issuer)!;
    return { issuer, issuerUrl: courses[0].issuerUrl, courses };
  });
}
