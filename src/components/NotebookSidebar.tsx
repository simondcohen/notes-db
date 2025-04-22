import React from 'react';
import { Book, Plus, X } from 'lucide-react';
import type { Notebook } from '../types';
import { EditableText } from './EditableText';

interface NotebookSidebarProps {
  notebooks: Notebook[];
  selectedNotebook?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectNotebook: (notebookId: string) => void;
  onCreateNotebook: () => void;
  onRenameNotebook: (notebookId: string, newTitle: string) => void;
  onDeleteNotebook: (notebookId: string) => void;
}

export function NotebookSidebar({
  notebooks,
  selectedNotebook,
  isOpen,
  onClose,
  onSelectNotebook,
  onCreateNotebook,
  onRenameNotebook,
  onDeleteNotebook,
}: NotebookSidebarProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-25"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="relative w-80 max-w-sm bg-white h-full shadow-xl flex flex-col">
        <div className="h-14 px-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700 flex items-center">
            <Book className="h-5 w-5 mr-2" />
            Notebooks
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {notebooks.map((notebook) => (
              <div
                key={notebook.id}
                className={`
                  p-3 rounded-lg cursor-pointer
                  ${selectedNotebook === notebook.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}
                `}
                onClick={() => onSelectNotebook(notebook.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Book className="h-5 w-5" />
                    <EditableText
                      value={notebook.title}
                      onSave={(newTitle) => onRenameNotebook(notebook.id, newTitle)}
                    />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Are you sure you want to delete "${notebook.title}"?`)) {
                        onDeleteNotebook(notebook.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 text-red-600 rounded"
                  >
                    Delete
                  </button>
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  Last modified: {notebook.lastModified ? new Date(notebook.lastModified).toLocaleDateString() : 'No last modified date'}
                </div>
              </div>
            ))}
          </div>
          
          {notebooks.length === 0 && (
            <div className="text-center text-gray-500 mt-8">
              <p>No notebooks yet</p>
              <button
                onClick={onCreateNotebook}
                className="mt-2 text-blue-500 hover:text-blue-600"
              >
                Create your first notebook
              </button>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={onCreateNotebook}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center justify-center space-x-2 hover:bg-blue-600 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>New Notebook</span>
          </button>
        </div>
      </div>
    </div>
  );
}