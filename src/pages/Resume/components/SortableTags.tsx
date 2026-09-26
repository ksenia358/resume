import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Flex } from 'antd';
import type { ReactNode } from 'react';

import styles from './SortableTags.module.scss';

function SortableTag({ tag, children }: { tag: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tag });

  return (
    <span
      ref={setNodeRef}
      className={styles.tag}
      style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
      {...attributes}
      {...listeners}
    >
      {children}
    </span>
  );
}

interface SortableTagsProps {
  tags: string[];
  renderTag: (tag: string) => ReactNode;
  // Set only on the edit page: then the tags can be dragged into a new order.
  onReorder?: (order: string[]) => void;
}

// A wrapped row of tags; on the edit page each one can be dragged to another place.
export function SortableTags({ tags, renderTag, onReorder }: SortableTagsProps) {
  // A few pixels of movement before a drag starts, so a tap isn't a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const row = (
    <Flex
      wrap
      gap={4}
    >
      {tags.map((tag) =>
        onReorder ? (
          <SortableTag
            key={tag}
            tag={tag}
          >
            {renderTag(tag)}
          </SortableTag>
        ) : (
          <span key={tag}>{renderTag(tag)}</span>
        ),
      )}
    </Flex>
  );

  if (!onReorder) {
    return row;
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      onReorder(arrayMove(tags, tags.indexOf(String(active.id)), tags.indexOf(String(over.id))));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={tags}
        strategy={rectSortingStrategy}
      >
        {row}
      </SortableContext>
    </DndContext>
  );
}
