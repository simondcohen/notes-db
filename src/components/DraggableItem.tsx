import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import type { Item } from '../types';
import { EditableText } from './EditableText';

interface DraggableItemProps {
  item: Item;
  isSelected: boolean;
  onSelect: (itemId: string) => void;
  onDelete: (itemId: string) => void;
  onUpdateTitle: (itemId: string, newTitle: string) => void;
}

export function DraggableItem({
  item,
  isSelected,
  onSelect,
  onDelete,
  onUpdateTitle,
}: DraggableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between
        border-b border-gray-100 last:border-b-0
        ${isDragging ? 'opacity-50' : ''}
        ${isSelected ? 'bg-blue-50 text-blue-700 border-blue-100' : 'hover:bg-gray-50'}
      `}
      onClick={() => onSelect(item.id)}
    >
      <div className="flex items-center space-x-2">
        <button
          className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </button>
        <EditableText
          value={item.title}
          onSave={(newTitle) => onUpdateTitle(item.id, newTitle)}
          className="truncate"
        />
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(item.id);
        }}
        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded-lg transition-opacity"
      >
        <Trash2 className="h-4 w-4 text-gray-500" />
      </button>
    </div>
  );
}