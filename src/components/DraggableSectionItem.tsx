import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Archive, FolderSymlink } from 'lucide-react';
import type { Section, Folder } from '../types';
import { EditableText } from './EditableText';

interface DraggableSectionItemProps {
  section: Section;
  isSelected: boolean;
  onSelect: (sectionId: string) => void;
  onDelete: (sectionId: string) => void;
  onUpdateTitle: (sectionId: string, newTitle: string) => void;
  onExport?: (sectionId: string) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMoveToFolder?: (sectionId: string, folderId: string | null) => void;
  folders?: Folder[];
}

export function DraggableSectionItem({
  section,
  isSelected,
  onSelect,
  onDelete,
  onUpdateTitle,
  onExport,
  onContextMenu,
  onMoveToFolder,
  folders = [],
}: DraggableSectionItemProps) {
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const folderMenuRef = useRef<HTMLDivElement>(null);
  
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
      onMoveToFolder(section.id, folderId);
    }
    setShowFolderMenu(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group cursor-pointer rounded-md relative
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
          {onMoveToFolder && (
            <button
              onClick={handleMoveToClick}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded-lg"
              title="Move to folder"
            >
              <FolderSymlink className="h-3.5 w-3.5 text-gray-500" />
            </button>
          )}
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
      
      {/* Folder selection dropdown */}
      {showFolderMenu && (
        <div 
          ref={folderMenuRef}
          className="absolute z-10 right-0 mt-1 w-48 bg-white rounded-md shadow-lg py-1 text-sm"
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