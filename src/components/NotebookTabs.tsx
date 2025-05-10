import React, { useState, useRef, useEffect } from 'react';
import { Book, Plus, Pencil, Trash2, Archive, Upload } from 'lucide-react';
import type { Notebook } from '../types';
import { exportAsZip } from '../utils/zipExportImport';
import { ZipImportDialog } from './ZipImportDialog';
import { useToast } from './ui/Toast';

interface NotebookTabsProps {
  notebooks: Notebook[];
  selectedNotebook?: string;
  onSelectNotebook: (notebookId: string) => void;
  onCreateNotebook: () => void;
  onRenameNotebook: (notebookId: string, newTitle: string) => void;
  onDeleteNotebook: (notebookId: string) => void;
  userId: string;
}

export function NotebookTabs({
  notebooks = [],
  selectedNotebook,
  onSelectNotebook,
  onCreateNotebook,
  onRenameNotebook,
  onDeleteNotebook,
  userId,
}: NotebookTabsProps) {
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [isZipImportDialogOpen, setIsZipImportDialogOpen] = useState(false);
  const [activeTabMenu, setActiveTabMenu] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  // Close tab menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeTabMenu && !event.composedPath().some(el => 
        el instanceof HTMLElement && el.dataset.notebookId === activeTabMenu
      )) {
        setActiveTabMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeTabMenu]);

  // Horizontal scroll on wheel
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (container.scrollWidth > container.clientWidth) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const handleRename = (notebookId: string, newTitle: string) => {
    if (newTitle.trim()) {
      onRenameNotebook(notebookId, newTitle.trim());
    }
    setIsRenaming(null);
  };

  const handleDelete = (notebookId: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      onDeleteNotebook(notebookId);
      setActiveTabMenu(null);
    }
  };

  const handleExportAsZip = async (notebookId: string) => {
    try {
      await exportAsZip(userId, notebookId);
      showToast('Notebook exported successfully as ZIP', 'success');
    } catch (error) {
      console.error('Error exporting notebook as zip:', error);
      showToast('Failed to export notebook as ZIP. Please try again.', 'error');
    }
    setActiveTabMenu(null);
  };

  const handleImportComplete = (result: { updated: number; added: number }) => {
    showToast(`Import complete: ${result.updated} notes updated, ${result.added} notes added.`, 'success');
  };

  const toggleTabMenu = (notebookId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    
    // Calculate position for the menu
    setMenuPosition({
      left: rect.left,
      top: rect.bottom
    });
    
    setActiveTabMenu(prevId => prevId === notebookId ? null : notebookId);
  };

  return (
    <div className="flex-1 flex items-center">
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto flex items-center scrollbar-hide"
      >
        <div ref={tabsContainerRef} className="flex items-center space-x-3 px-2 py-1">
          {notebooks.map((notebook) => (
            <div
              key={notebook.id}
              className="relative"
              data-notebook-id={notebook.id}
            >
              {isRenaming === notebook.id ? (
                <div className="px-4 py-1.5 rounded-full border-2 border-blue-500 bg-white">
                  <input
                    ref={inputRef}
                    type="text"
                    defaultValue={notebook.title}
                    className="outline-none bg-transparent w-full"
                    onBlur={(e) => handleRename(notebook.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRename(notebook.id, e.currentTarget.value);
                      } else if (e.key === 'Escape') {
                        setIsRenaming(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              ) : (
                <div className="flex items-center">
                  <button
                    className={`
                      px-4 py-1.5 rounded-full font-medium transition-colors flex items-center
                      ${selectedNotebook === notebook.id 
                        ? 'bg-blue-500 text-white shadow-sm' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }
                    `}
                    onClick={() => onSelectNotebook(notebook.id)}
                  >
                    {notebook.title}
                    <button 
                      className={`
                        ml-2 p-0.5 rounded-full 
                        ${selectedNotebook === notebook.id 
                          ? 'hover:bg-blue-600 bg-blue-600/50' 
                          : 'text-gray-500 hover:bg-gray-300/50 bg-gray-200/50'
                        }
                      `}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTabMenu(notebook.id, e);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </button>
                </div>
              )}

              {activeTabMenu === notebook.id && (
                <div 
                  className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-44"
                  data-notebook-id={notebook.id}
                  style={{
                    left: `${menuPosition.left}px`,
                    top: `${menuPosition.top}px`
                  }}
                >
                  <button 
                    className="w-full px-3 py-2 text-left text-gray-600 hover:bg-gray-50 flex items-center space-x-2"
                    onClick={() => {
                      setIsRenaming(notebook.id);
                      setActiveTabMenu(null);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    <span>Rename</span>
                  </button>
                  <button 
                    className="w-full px-3 py-2 text-left text-gray-600 hover:bg-gray-50 flex items-center space-x-2"
                    onClick={() => handleExportAsZip(notebook.id)}
                  >
                    <Archive className="h-4 w-4" />
                    <span>Export as ZIP</span>
                  </button>
                  <button 
                    className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 flex items-center space-x-2"
                    onClick={() => handleDelete(notebook.id, notebook.title)}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          ))}

          <button
            className="min-w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition-colors shadow-sm"
            onClick={onCreateNotebook}
            title="Create new notebook"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ZIP Import Dialog */}
      <ZipImportDialog
        isOpen={isZipImportDialogOpen}
        onClose={() => setIsZipImportDialogOpen(false)}
        userId={userId}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
} 