import type { ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from 'antd';

import styles from './ExpandableList.module.scss';

interface ExpandableListProps<T> {
  items: T[];
  renderItems: (items: T[]) => ReactNode;
  showAllLabel: string;
  collapseLabel: string;
  initialVisibleCount?: number;
}

export function ExpandableList<T>({
  items,
  renderItems,
  showAllLabel,
  collapseLabel,
  initialVisibleCount = 2,
}: ExpandableListProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const collapseButtonTopRef = useRef<number | null>(null);
  const canCollapse = items.length > initialVisibleCount;
  const visibleItems = canCollapse && !expanded ? items.slice(0, initialVisibleCount) : items;

  useLayoutEffect(() => {
    if (expanded || collapseButtonTopRef.current === null) return;

    const nextButtonTop = toggleButtonRef.current?.getBoundingClientRect().top;
    if (nextButtonTop !== undefined) {
      window.scrollBy({
        top: nextButtonTop - collapseButtonTopRef.current,
        behavior: 'auto',
      });
    }

    collapseButtonTopRef.current = null;
  }, [expanded]);

  function toggleExpanded() {
    if (expanded) {
      collapseButtonTopRef.current = toggleButtonRef.current?.getBoundingClientRect().top ?? null;
    }
    setExpanded((prev) => !prev);
  }

  return (
    <>
      <div className={styles.screenOnly}>{renderItems(visibleItems)}</div>
      <div className={styles.printOnly}>{renderItems(items)}</div>
      {canCollapse && (
        <Button
          ref={toggleButtonRef}
          type="link"
          className={styles.toggle}
          onClick={toggleExpanded}
        >
          {expanded ? collapseLabel : showAllLabel}
        </Button>
      )}
    </>
  );
}
