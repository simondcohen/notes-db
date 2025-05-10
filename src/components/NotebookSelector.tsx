import React, { useState } from 'react';
import { Book, ChevronDown, Plus, Pencil, Trash2, Archive, Upload } from 'lucide-react';
import type { Notebook } from '../types';
import { exportAsZip } from '../utils/zipExportImport';
import { ZipImportDialog } from './ZipImportDialog';
import { useToast } from './ui/Toast';

interface NotebookSelectorProps {
  notebooks: Notebook[];
  selectedNotebook?: string;
  onSelectNotebook: (notebookId: string) => void;
  onCreateNotebook: () => void;
  onRenameNotebook: (notebookId: string, newTitle: string) => void;
  onDeleteNotebook: (notebookId: string) => void;
  userId: string;
}

export function NotebookSelector({
  notebooks = [],
  selectedNotebook,
  onSelectNotebook,
  onCreateNotebook,
  onRenameNotebook,
  onDeleteNotebook,
  userId,
}: NotebookSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isRenaming, setIsRenaming] = React.useState<string | null>(null);
  const [isZipImportDialogOpen, setIsZipImportDialogOpen] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const selectedNotebookData = notebooks?.find(n => n.id === selectedNotebook);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRename = (notebookId: string, newTitle: string) => {
    if (newTitle.trim()) {
      onRenameNotebook(notebookId, newTitle.trim());
    }
    setIsRenaming(null);
  };

  const handleDelete = (notebookId: string, title: string) => {
    if (window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      onDeleteNotebook(notebookId);
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
  };

  const handleImportComplete = (result: { updated: number; added: number }) => {
    showToast(`Import complete: ${result.updated} notes updated, ${result.added} notes added.`, 'success');
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Book className="h-5 w-5 text-gray-600" />
        <span className="text-gray-700 font-medium text-lg">
          {selectedNotebookData?.title || 'Select Notebook'}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {notebooks.map((notebook) => (
            <div
              key={notebook.id}
              className={`
                px-3 py-2 flex items-center justify-between group cursor-pointer
                ${selectedNotebook === notebook.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}
              `}
              onClick={() => {
                onSelectNotebook(notebook.id);
                setIsOpen(false);
              }}
            >
              {isRenaming === notebook.id ? (
                <input
                  ref={inputRef}
                  type="text"
                  defaultValue={notebook.title}
                  className="flex-1 px-1 py-0.5 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              ) : (
                <>
                  <span>{notebook.title}</span>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1">
                    <button
                      className="p-1 hover:bg-gray-200 rounded-lg text-gray-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsRenaming(notebook.id);
                      }}
                      title="Rename notebook"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="p-1 hover:bg-gray-200 rounded-lg text-gray-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportAsZip(notebook.id);
                      }}
                      title="Export notebook as ZIP"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                    <button
                      className="p-1 hover:bg-red-100 rounded-lg text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(notebook.id, notebook.title);
                      }}
                      title="Delete notebook"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          
          <div className="border-t border-gray-200 mt-1 pt-1">
            <button
              className="w-full px-3 py-2 text-left text-gray-600 hover:bg-gray-50 flex items-center space-x-2"
              onClick={() => {
                onCreateNotebook();
                setIsOpen(false);
              }}
            >
              <Plus className="h-4 w-4" />
              <span>New Notebook</span>
            </button>
            <button
              className="w-full px-3 py-2 text-left text-gray-600 hover:bg-gray-50 flex items-center space-x-2"
              onClick={(e) => {
                e.stopPropagation();
                setIsZipImportDialogOpen(true);
                setIsOpen(false);
              }}
            >
              <Upload className="h-4 w-4" />
              <span>Import ZIP</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Import ZIP Dialog */}
      <ZipImportDialog
        isOpen={isZipImportDialogOpen}
        onClose={() => setIsZipImportDialogOpen(false)}
        userId={userId}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}