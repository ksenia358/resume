import { MenuOutlined } from '@ant-design/icons';
import { Anchor, Button, Drawer } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LanguageSwitcher } from '../LanguageSwitcher.tsx';
import styles from './SectionNav.module.scss';

const SECTION_KEYS = ['about', 'experience', 'education', 'certificates', 'skills', 'contact'];

// `hidden` are the sections turned off in the editor: no menu item leads to them.
export function SectionNav({ hidden = [] }: { hidden?: string[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const items = SECTION_KEYS.filter((key) => !hidden.includes(key)).map((key) => ({
    key,
    href: `#${key}`,
    title: t(`nav.${key}`),
  }));

  return (
    <header className={styles.bar}>
      <div className={styles.desktopNav}>
        <Anchor
          direction="horizontal"
          affix={false}
          targetOffset={80}
          items={items}
        />
      </div>

      <Button
        className={styles.burger}
        type="text"
        icon={<MenuOutlined />}
        onClick={() => setOpen(true)}
        aria-label="Menu"
      />

      <div className={styles.right}>
        <LanguageSwitcher />
      </div>

      <Drawer
        placement="top"
        open={open}
        onClose={() => setOpen(false)}
        size="auto"
      >
        <Anchor
          direction="vertical"
          affix={false}
          targetOffset={80}
          items={items}
          onClick={() => setOpen(false)}
        />
      </Drawer>
    </header>
  );
}
export default SectionNav;
