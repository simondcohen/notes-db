import React, { useState } from 'react';
import { Plus, FolderIcon } from 'lucide-react';
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
import type { Item, Folder } from '../types';
import { DraggableItem } from './DraggableItem';

interface ItemsColumnProps {
  items: Item[];
  folders?: Folder[];
  selectedItem?: string;
  onSelectItem: (itemId: string) => void;
  onAddItem: () => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateItemTitle: (itemId: string, newTitle: string) => void;
  onReorderItems: (items: Item[]) => void;
  onMoveItemToFolder?: (itemId: string, folderId: string | null) => void;
  hasFolderSupport?: boolean;
}

export function ItemsColumn({
  items = [],
  folders = [],
  selectedItem,
  onSelectItem,
  onAddItem,
  onDeleteItem,
  onUpdateItemTitle,
  onReorderItems,
  onMoveItemToFolder,
  hasFolderSupport = false,
}: ItemsColumnProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuTargetId, setContextMenuTargetId] = useState<string | null>(null);
  
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
  
  const handleContextMenu = (
    e: React.MouseEvent, 
    itemId: string
  ) => {
    if (!hasFolderSupport || !onMoveItemToFolder) return;
    
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuTargetId(itemId);
    setShowContextMenu(true);
  };

  const handleMoveToFolder = (folderId: string | null) => {
    if (contextMenuTargetId && onMoveItemToFolder) {
      onMoveItemToFolder(contextMenuTargetId, folderId);
      setShowContextMenu(false);
    }
  };

  // Close the context menu when clicking anywhere else
  React.useEffect(() => {
    const handleClick = () => setShowContextMenu(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

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
                  onContextMenu={hasFolderSupport ? (e) => handleContextMenu(e, item.id) : undefined}
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
      
      {/* Context menu for moving items to folders */}
      {hasFolderSupport && showContextMenu && (
        <div 
          className="absolute bg-white shadow-lg rounded-md z-50 py-1"
          style={{ top: contextMenuPosition.y, left: contextMenuPosition.x }}
        >
          <div className="text-sm px-3 py-1 font-semibold text-gray-700 border-b">Move to folder</div>
          <div 
            className="px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm"
            onClick={() => handleMoveToFolder(null)}
          >
            Root level (no folder)
          </div>
          {folders.map(folder => (
            <div 
              key={folder.id}
              className="px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm"
              onClick={() => handleMoveToFolder(folder.id)}
            >
              {folder.title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}