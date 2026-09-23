import { Flex, Skeleton, Tag, Typography } from 'antd';

import { getSkills } from '../api/resume';
import { useResumeSection } from '../hooks/useResumeSection';

const { Text } = Typography;

export function Skills() {
  const { data, loading } = useResumeSection(getSkills);

  if (loading)
    return (
      <Skeleton
        active
        paragraph={{ rows: 2 }}
      />
    );

  return (
    <Flex
      vertical
      gap="middle"
    >
      {data.map((group) => (
        <div key={group.id}>
          <Text strong>{group.category}</Text>
          <div style={{ marginTop: 4 }}>
            {group.items.map((skill) => (
              <Tag key={skill}>{skill}</Tag>
            ))}
          </div>
        </div>
      ))}
    </Flex>
  );
}
