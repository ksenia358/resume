import { Flex } from 'antd';
import type { ReactNode } from 'react';

import styles from './ContactRow.module.scss';

interface ContactRowProps {
  className?: string;
  icon: string;
  iconLabel: string;
  items: string[];
  renderItem: (item: string) => ReactNode;
}

export function ContactRow({ className, icon, iconLabel, items, renderItem }: ContactRowProps) {
  return (
    <Flex
      gap={8}
      align="start"
      className={className}
    >
      <img
        src={icon}
        alt={iconLabel}
        width={16}
        height={16}
        className={styles.image}
      />
      <Flex
        vertical
        gap={4}
      >
        {items.map((item) => (
          <div key={item}>{renderItem(item)}</div>
        ))}
      </Flex>
    </Flex>
  );
}

export default ContactRow;
