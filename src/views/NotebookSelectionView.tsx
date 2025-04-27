import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Notebook } from '../types';

interface NotebookSelectionViewProps {
  notebooks: Notebook[];
  loading: boolean;
  onCreateNotebook: () => Promise<string>;
}

export function NotebookSelectionView({ notebooks, loading, onCreateNotebook }: NotebookSelectionViewProps) {
  const navigate = useNavigate();

  const handleNotebookSelect = (notebookId: string) => {
    navigate(`/nb/${notebookId}`);
  };

  const handleCreateNotebook = async () => {
    const newNotebookId = await onCreateNotebook();
    if (newNotebookId) {
      navigate(`/nb/${newNotebookId}`);
    }
  };

  // Helper function to safely format dates
  const formatDate = (dateValue: Date | string | null | undefined) => {
    if (!dateValue) return 'Never edited';
    
    try {
      // If it's a string, parse it to a Date object
      const date = typeof dateValue === 'string' ? parseISO(dateValue) : dateValue;
      return format(date, 'MMM d, yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown date';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Choose a Notebook</h1>
        <p className="text-gray-600">Select an existing notebook or create a new one</p>
      </div>

      <div className="grid gap-4">
        <button 
          onClick={handleCreateNotebook}
          className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2 text-blue-500" />
          <span className="font-medium text-blue-600">New Notebook</span>
        </button>

        {notebooks.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            No notebooks available. Create your first notebook to get started.
          </div>
        ) : (
          notebooks.map((notebook) => (
            <div
              key={notebook.id}
              onClick={() => handleNotebookSelect(notebook.id)}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div className="flex items-center">
                <Book className="h-5 w-5 text-gray-500 mr-3" />
                <span className="font-medium text-gray-800">{notebook.title}</span>
              </div>
              <div className="text-sm text-gray-500">
                Last edited: {formatDate(notebook.lastModified)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
} 