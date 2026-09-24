import { Flex, Skeleton, Tag } from 'antd';

import { getSkills } from '../api/resume';
import { useResumeSection } from '../hooks/useResumeSection';

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
  const { data, loading } = useResumeSection(getSkills);
  const highlightedKeys = new Set(highlighted.map(normalize));

  if (loading)
    return (
      <Skeleton
        active
        paragraph={{ rows: 2 }}
      />
    );

  return (
    <Flex
      wrap
      gap={4}
    >
      {data.map((skill) => (
        <Tag
          key={skill}
          color={highlightedKeys.has(normalize(skill)) ? 'success' : undefined}
          style={{ marginInlineEnd: 0 }}
        >
          {skill}
        </Tag>
      ))}
    </Flex>
  );
}
