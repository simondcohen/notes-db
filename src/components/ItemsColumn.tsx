import React from 'react';
import { Plus } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import type { Item } from '../types';
import { DraggableItem } from './DraggableItem';

interface ItemsColumnProps {
  items: Item[];
  selectedItem?: string;
  onSelectItem: (itemId: string) => void;
  onAddItem: () => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateItemTitle: (itemId: string, newTitle: string) => void;
  onReorderItems: (items: Item[]) => void;
}

export function ItemsColumn({
  items = [],
  selectedItem,
  onSelectItem,
  onAddItem,
  onDeleteItem,
  onUpdateItemTitle,
  onReorderItems,
}: ItemsColumnProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDeleteItem = (itemId: string, itemTitle: string) => {
    if (window.confirm(`Are you sure you want to delete the item "${itemTitle}" and all its contents?`)) {
      onDeleteItem(itemId);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      
      onReorderItems(arrayMove(items, oldIndex, newIndex));
    }
  };

  return (
    <div className="w-72 h-full bg-white flex flex-col">
      <div className="h-14 px-4 border-b border-gray-200 flex items-center justify-between bg-white">
        <h2 className="font-semibold text-gray-700">Items</h2>
        <button
          onClick={onAddItem}
          className="p-1.5 rounded-lg flex items-center space-x-1 text-sm bg-blue-500 text-white hover:bg-blue-600"
        >
          <Plus className="h-4 w-4" />
          <span>Add Item</span>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {items.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext
              items={items}
              strategy={verticalListSortingStrategy}
            >
              {items.map((item) => (
                <DraggableItem
                  key={item.id}
                  item={item}
                  isSelected={selectedItem === item.id}
                  onSelect={onSelectItem}
                  onDelete={(itemId) => handleDeleteItem(itemId, item.title)}
                  onUpdateTitle={onUpdateItemTitle}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-2">
            <p>No items yet</p>
            <button
              onClick={onAddItem}
              className="text-blue-500 hover:text-blue-600 text-sm"
            >
              Create your first item
            </button>
          </div>
        )}
      </div>
    </div>
  );
}