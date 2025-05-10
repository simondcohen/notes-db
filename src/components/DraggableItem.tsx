import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, FolderSymlink } from 'lucide-react';
import type { Item, Folder } from '../types';
import { EditableText } from './EditableText';

interface DraggableItemProps {
  item: Item;
  isSelected: boolean;
  onSelect: (itemId: string) => void;
  onDelete: (itemId: string) => void;
  onUpdateTitle: (itemId: string, newTitle: string) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMoveToFolder?: (itemId: string, folderId: string | null) => void;
  folders?: Folder[];
}

export function DraggableItem({
  item,
  isSelected,
  onSelect,
  onDelete,
  onUpdateTitle,
  onContextMenu,
  onMoveToFolder,
  folders = [],
}: DraggableItemProps) {
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const folderMenuRef = useRef<HTMLDivElement>(null);
  
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
  
  // Close folder menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(event.target as Node)) {
        setShowFolderMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleMoveToClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowFolderMenu(!showFolderMenu);
  };
  
  const handleFolderSelect = (e: React.MouseEvent, folderId: string | null) => {
    e.stopPropagation();
    if (onMoveToFolder) {
      onMoveToFolder(item.id, folderId);
    }
    setShowFolderMenu(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group px-3 py-2 rounded-lg cursor-pointer flex items-center
        border-b border-gray-100 last:border-b-0 relative
        ${isDragging ? 'opacity-50' : ''}
        ${isSelected ? 'bg-blue-50 text-blue-700 border-blue-100' : 'hover:bg-gray-50'}
      `}
      onClick={() => onSelect(item.id)}
      onContextMenu={onContextMenu}
    >
      <div className="flex items-center space-x-2 flex-1 min-w-0">
        <button
          className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing flex-shrink-0"
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
      <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
        {onMoveToFolder && (
          <button
            onClick={handleMoveToClick}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded-lg transition-opacity"
            title="Move to folder"
          >
            <FolderSymlink className="h-4 w-4 text-gray-500" />
          </button>
        )}
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
      
      {/* Folder selection dropdown */}
      {showFolderMenu && (
        <div 
          ref={folderMenuRef}
          className="absolute z-10 right-0 mt-1 w-48 bg-white rounded-md shadow-lg py-1 text-sm"
          style={{ top: '100%' }}
        >
          <div className="px-3 py-2 font-medium text-gray-700 border-b">Move to:</div>
          
          {/* Root option */}
          <div 
            className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"
            onClick={(e) => handleFolderSelect(e, null)}
          >
            <span className="mr-2">📁</span> Root Level
          </div>
          
          {/* Folder options */}
          {folders.map(folder => (
            <div 
              key={folder.id}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"
              onClick={(e) => handleFolderSelect(e, folder.id)}
            >
              <span className="mr-2">📁</span> {folder.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}