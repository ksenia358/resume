import { HolderOutlined } from '@ant-design/icons';
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { ContactCell } from './index';
import styles from './Profile.module.scss';

function SortableCell({ cell }: { cell: ContactCell }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: cell.key,
  });

  return (
    <div
      ref={setNodeRef}
      className={styles.sortable}
      style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className={styles.handle}
        aria-label="Перетащить"
        title="Перетащить"
        {...attributes}
        {...listeners}
      >
        <HolderOutlined />
      </button>
      {cell.node}
    </div>
  );
}

// The contact cells on the edit page: each has a handle to drag it to another place in the grid.
export function SortableContacts({ cells, onReorder }: { cells: ContactCell[]; onReorder: (order: string[]) => void }) {
  // A few pixels of movement before a drag starts, so a tap on the handle isn't a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const keys = cells.map((cell) => cell.key);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      onReorder(arrayMove(keys, keys.indexOf(String(active.id)), keys.indexOf(String(over.id))));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={keys}
        strategy={rectSortingStrategy}
      >
        {cells.map((cell) => (
          <SortableCell
            key={cell.key}
            cell={cell}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
