import React, { useState } from 'react';
import { X, Download, Archive, Check } from 'lucide-react';
import type { Notebook } from '../types';
import { exportData } from '../utils/exportData';
import { useToast } from './ui/Toast';

interface ExportBackupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  notebooks: Notebook[];
}

export function ExportBackupDialog({
  isOpen,
  onClose,
  userId,
  notebooks,
}: ExportBackupDialogProps) {
  const [exportType, setExportType] = useState<'all' | 'selected'>('all');
  const [selectedNotebooks, setSelectedNotebooks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();
  
  if (!isOpen) return null;
  
  const handleSelectNotebook = (notebookId: string) => {
    setSelectedNotebooks(prev => 
      prev.includes(notebookId)
        ? prev.filter(id => id !== notebookId)
        : [...prev, notebookId]
    );
  };
  
  const handleSelectAll = () => {
    if (selectedNotebooks.length === notebooks.length) {
      setSelectedNotebooks([]);
    } else {
      setSelectedNotebooks(notebooks.map(nb => nb.id));
    }
  };
  
  const handleExport = async () => {
    setIsLoading(true);
    try {
      if (exportType === 'all') {
        await exportData(userId);
        showToast('All notebooks exported successfully', 'success');
      } else {
        if (selectedNotebooks.length === 0) {
          showToast('Please select at least one notebook to export', 'error');
          setIsLoading(false);
          return;
        }
        
        // Export each selected notebook individually
        for (const notebookId of selectedNotebooks) {
          await exportData(userId, notebookId);
        }
        
        showToast(`${selectedNotebooks.length} notebook(s) exported successfully`, 'success');
      }
      onClose();
    } catch (error) {
      console.error('Error exporting notebooks:', error);
      showToast('Failed to export notebooks. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-25"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Export Backup</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        
        <div className="py-2">
          <p className="text-gray-600 mb-4">
            Create a backup of your notebooks in JSON format. This will export the complete data structure including all sections, items, and notes.
          </p>
          
          <div className="space-y-3">
            <label className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name="exportType"
                checked={exportType === 'all'}
                onChange={() => setExportType('all')}
                className="h-4 w-4 text-blue-600"
              />
              <span>Export all notebooks</span>
            </label>
            
            <label className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name="exportType"
                checked={exportType === 'selected'}
                onChange={() => setExportType('selected')}
                className="h-4 w-4 text-blue-600"
              />
              <span>Select notebooks to export</span>
            </label>
            
            {exportType === 'selected' && (
              <div className="pl-6 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Select notebooks:</span>
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {selectedNotebooks.length === notebooks.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                  {notebooks.length === 0 ? (
                    <div className="p-3 text-gray-500">No notebooks available</div>
                  ) : (
                    notebooks.map(notebook => (
                      <div
                        key={notebook.id}
                        onClick={() => handleSelectNotebook(notebook.id)}
                        className="flex items-center p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center mr-2 ${
                          selectedNotebooks.includes(notebook.id) 
                            ? 'bg-blue-600 border-blue-600 text-white' 
                            : 'border-gray-300'
                        }`}>
                          {selectedNotebooks.includes(notebook.id) && (
                            <Check className="w-3 h-3" />
                          )}
                        </div>
                        <span>{notebook.title}</span>
                      </div>
                    ))
                  )}
                </div>
                
                {notebooks.length > 0 && (
                  <div className="text-sm text-gray-500 mt-1">
                    {selectedNotebooks.length} of {notebooks.length} selected
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isLoading || (exportType === 'selected' && selectedNotebooks.length === 0)}
            className={`px-4 py-2 text-white rounded-lg flex items-center ${
              isLoading || (exportType === 'selected' && selectedNotebooks.length === 0)
                ? 'bg-blue-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              <>
                <span className="mr-2">Exporting...</span>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                <span>Export Backup</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 