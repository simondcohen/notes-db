import React, { useState, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { importFromZip } from '../utils/zipExportImport';
import { useToast } from './ui/Toast';

interface ZipImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onImportComplete: (result: { updated: number; added: number }) => void;
}

export function ZipImportDialog({
  isOpen,
  onClose,
  userId,
  onImportComplete
}: ZipImportDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === 'application/zip' || file.name.endsWith('.zip')) {
        setSelectedFile(file);
      } else {
        showToast('Please select a ZIP file', 'error');
        e.target.value = '';
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      showToast('Please select a file to import', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const result = await importFromZip(userId, selectedFile);
      onImportComplete(result);
      onClose();
    } catch (error) {
      console.error('Import failed:', error);
      showToast(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
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
          <h2 className="text-xl font-semibold text-gray-800">Import Notes from ZIP</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        
        <div className="py-4">
          <p className="text-gray-600 mb-4">
            Select a ZIP file containing Markdown notes with YAML frontmatter.
            Existing notes will be updated, and new ones will be created.
          </p>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            {selectedFile ? (
              <div>
                <p className="font-medium text-green-600">{selectedFile.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
                <button 
                  className="mt-2 text-sm text-red-500 hover:text-red-700"
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Drag & drop your ZIP file here or</p>
                <label className="mt-2 inline-block px-4 py-2 bg-blue-50 text-blue-700 rounded-lg cursor-pointer">
                  Browse Files
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,application/zip"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
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
            onClick={handleImport}
            disabled={!selectedFile || isLoading}
            className={`px-4 py-2 text-white rounded-lg flex items-center ${
              !selectedFile || isLoading 
                ? 'bg-blue-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              <>
                <span className="mr-2">Importing...</span>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </>
            ) : (
              'Import'
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 