import React, { useState, useEffect } from 'react';
import { Plus, FolderPlusIcon, ArrowLeft } from 'lucide-react';
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
import type { Section, Folder } from '../types';
import { DraggableSectionItem } from './DraggableSectionItem';
import { exportSectionAsZip } from '../utils/zipExportImport';
import { useToast } from './ui/Toast';
import { FolderItem } from './FolderItem';

interface SectionsColumnProps {
  sections: Section[];
  folders: Folder[];
  selectedSection?: string;
  selectedFolder?: string;
  onSelectSection: (sectionId: string) => void;
  onSelectFolder: (folderId: string) => void;
  onAddSection: (folderId?: string) => void;
  onAddFolder: () => void;
  onAddSubfolder: (parentFolderId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onUpdateSectionTitle: (sectionId: string, newTitle: string) => void;
  onUpdateFolderTitle: (folderId: string, newTitle: string) => void;
  onReorderSections: (sections: Section[]) => void;
  onReorderFolders: (folders: Folder[]) => void;
  onMoveToFolder: (sectionId: string, folderId: string | null) => void;
  userId: string;
  hasFolderSupport?: boolean;
}

export function SectionsColumn({
  sections,
  folders,
  selectedSection,
  selectedFolder,
  onSelectSection,
  onSelectFolder,
  onAddSection,
  onAddFolder,
  onAddSubfolder,
  onDeleteSection,
  onDeleteFolder,
  onUpdateSectionTitle,
  onUpdateFolderTitle,
  onReorderSections,
  onReorderFolders,
  onMoveToFolder,
  userId,
  hasFolderSupport = false,
}: SectionsColumnProps) {
  const { showToast } = useToast();
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuTargetId, setContextMenuTargetId] = useState<string | null>(null);
  const [contextMenuType, setContextMenuType] = useState<'section' | 'folder'>('section');
  const [currentFolderName, setCurrentFolderName] = useState('Folder');
  
  // Effect to find the current folder name when selectedFolder changes
  useEffect(() => {
    if (!selectedFolder) {
      setCurrentFolderName('Folder');
      return;
    }

    // Check root level folders
    const folder = folders.find(f => f.id === selectedFolder);
    if (folder) {
      setCurrentFolderName(folder.title);
      return;
    }

    // If not found in root folders, we'll just use a generic name
    // In a real implementation, you'd want to do a proper recursive search or
    // keep a flattened map of all folders including subfolders
    setCurrentFolderName('Subfolder');
  }, [selectedFolder, folders]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDeleteSection = (sectionId: string, sectionTitle: string) => {
    if (window.confirm(`Are you sure you want to delete the section "${sectionTitle}" and all its contents?`)) {
      onDeleteSection(sectionId);
    }
  };

  const handleDeleteFolder = (folderId: string, folderTitle: string) => {
    if (window.confirm(`Are you sure you want to delete the folder "${folderTitle}" and all its contents?`)) {
      onDeleteFolder(folderId);
    }
  };

  const handleExportSection = async (sectionId: string) => {
    try {
      await exportSectionAsZip(userId, sectionId);
      showToast('Section exported successfully as ZIP', 'success');
    } catch (error) {
      console.error('Error exporting section as zip:', error);
      showToast('Failed to export section as ZIP. Please try again.', 'error');
    }
  };

  // Handle section drag and drop
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    if (active.id !== over.id) {
      if (contextMenuType === 'section') {
        // Handle section reordering
        const sectionsToSort = sections.filter(s => !s.folderId);
        const oldIndex = sectionsToSort.findIndex(section => section.id === active.id);
        const newIndex = sectionsToSort.findIndex(section => section.id === over.id);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedSections = arrayMove(sectionsToSort, oldIndex, newIndex);
          onReorderSections(reorderedSections);
        }
      } else {
        // Handle folder reordering
        const oldIndex = folders.findIndex(folder => folder.id === active.id);
        const newIndex = folders.findIndex(folder => folder.id === over.id);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedFolders = arrayMove(folders, oldIndex, newIndex);
          onReorderFolders(reorderedFolders);
        }
      }
    }
  };

  // Handle right-click context menu
  const handleContextMenu = (e: React.MouseEvent, id: string, type: 'section' | 'folder') => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuTargetId(id);
    setContextMenuType(type);
    setShowContextMenu(true);
    
    // Add event listener to close the menu when clicking anywhere
    document.addEventListener('click', handleCloseContextMenu);
  };
  
  const handleCloseContextMenu = () => {
    setShowContextMenu(false);
    document.removeEventListener('click', handleCloseContextMenu);
  };
  
  const handleMoveToFolder = (targetFolderId: string | null) => {
    if (contextMenuTargetId) {
      onMoveToFolder(contextMenuTargetId, targetFolderId);
    }
    handleCloseContextMenu();
  };

  // Add a helper function to handle adding a section
  const handleAddSectionClick = () => {
    // Log current selected folder
    console.log("Current selected folder:", selectedFolder);
    
    // Make sure this value is passed to the parent
    if (selectedFolder) {
      console.log("Adding section to specific folder:", selectedFolder);
    } else {
      console.log("Adding section to root level");
    }
    
    // Call the parent function with the current selected folder
    onAddSection(selectedFolder);
  };

  return (
    <div className="w-64 h-full bg-gray-50 flex flex-col">
      <div className="h-14 px-4 border-b border-gray-200 flex items-center justify-between bg-white">
        <div className="flex items-center">
          {selectedFolder && (
            <button
              onClick={() => onSelectFolder('')}
              className="p-1 hover:bg-gray-200 rounded-lg mr-2"
              title="Back to Root Level"
            >
              <ArrowLeft className="h-4 w-4 text-gray-600" />
            </button>
          )}
          <h2 className="font-semibold text-gray-700">
            {selectedFolder 
              ? `${currentFolderName} Sections` 
              : 'Sections'}
          </h2>
        </div>
        <div className="flex">
          {hasFolderSupport && (
            <>
              <button
                onClick={() => onAddFolder()}
                className="p-1 hover:bg-gray-200 rounded-lg mr-1"
                title={selectedFolder ? "Add Root Folder" : "Add Folder"}
              >
                <FolderPlusIcon className="h-5 w-5 text-gray-600" />
              </button>
              {selectedFolder && (
                <div className="text-xs text-gray-400 absolute -mt-5 right-12">
                  Root
                </div>
              )}
            </>
          )}
          <button
            onClick={handleAddSectionClick}
            className="p-1 hover:bg-gray-200 rounded-lg"
            title="Add Section"
          >
            <Plus className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          {/* Folders - only show if folder support is enabled */}
          {hasFolderSupport && folders.length > 0 && (
            <div className="mt-2 space-y-1">
              {folders.map((folder) => {
                // Log which sections belong to this folder
                const folderSections = sections.filter(section => section.folderId === folder.id);
                console.log(`Sections for folder ${folder.title} (${folder.id}):`, folderSections);
                
                return (
                  <FolderItem
                    key={folder.id}
                    folder={folder}
                    isActive={selectedFolder === folder.id}
                    selectedFolder={selectedFolder}
                    onSelect={onSelectFolder}
                    onRename={onUpdateFolderTitle}
                    onDelete={(folderId) => handleDeleteFolder(folderId, folder.title)}
                    onAddSubfolder={onAddSubfolder}
                  >
                    {/* Show sections in this folder */}
                    {selectedFolder === folder.id && (
                      <div className="section-container mt-1 space-y-0.5">
                        {folderSections.length > 0 && folderSections.map(section => (
                          <DraggableSectionItem
                            key={section.id}
                            section={section}
                            isSelected={selectedSection === section.id}
                            onSelect={onSelectSection}
                            onDelete={(sectionId) => handleDeleteSection(sectionId, section.title)}
                            onUpdateTitle={onUpdateSectionTitle}
                            onExport={handleExportSection}
                            onContextMenu={(e) => handleContextMenu(e, section.id, 'section')}
                          />
                        ))}
                      </div>
                    )}
                  </FolderItem>
                );
              })}
            </div>
          )}

          {/* Root sections (not in any folder) */}
          {sections.filter(section => !section.folderId).length > 0 && (
            <>
              {folders.length > 0 && <div className="h-0.5 bg-gray-100 mx-3 my-2" />}
              <SortableContext
                items={sections.filter(section => !section.folderId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="mt-2 space-y-1 px-2">
                  {sections
                    .filter(section => !section.folderId)
                    .map((section) => (
                      <DraggableSectionItem
                        key={section.id}
                        section={section}
                        isSelected={selectedSection === section.id}
                        onSelect={onSelectSection}
                        onDelete={(sectionId) => handleDeleteSection(sectionId, section.title)}
                        onUpdateTitle={onUpdateSectionTitle}
                        onExport={handleExportSection}
                        onContextMenu={hasFolderSupport ? (e) => handleContextMenu(e, section.id, 'section') : undefined}
                      />
                    ))}
                </div>
              </SortableContext>
            </>
          )}
        </DndContext>
      </div>

      {/* Context menu for moving sections to folders - only shown if folder support is enabled */}
      {hasFolderSupport && showContextMenu && contextMenuType === 'section' && (
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