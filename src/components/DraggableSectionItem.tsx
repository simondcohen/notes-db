import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Archive } from 'lucide-react';
import type { Section } from '../types';
import { EditableText } from './EditableText';

interface DraggableSectionItemProps {
  section: Section;
  isSelected: boolean;
  onSelect: (sectionId: string) => void;
  onDelete: (sectionId: string) => void;
  onUpdateTitle: (sectionId: string, newTitle: string) => void;
  onExport?: (sectionId: string) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function DraggableSectionItem({
  section,
  isSelected,
  onSelect,
  onDelete,
  onUpdateTitle,
  onExport,
  onContextMenu,
}: DraggableSectionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group cursor-pointer rounded-md
        ${isDragging ? 'opacity-50' : ''}
      `}
      onContextMenu={onContextMenu}
    >
      <div
        className={`
          p-2 flex items-center justify-between rounded-md
          ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'}
        `}
        onClick={() => onSelect(section.id)}
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
            value={section.title}
            onSave={(newTitle) => onUpdateTitle(section.id, newTitle)}
            className={`text-sm ${isSelected ? 'text-blue-700 font-medium' : 'text-gray-700'}`}
          />
        </div>
        <div className="flex space-x-1">
          {onExport && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExport(section.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded-lg"
              title="Export section as ZIP"
            >
              <Archive className="h-3.5 w-3.5 text-gray-500" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(section.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded-lg"
          >
            <Trash2 className="h-3.5 w-3.5 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  );
}