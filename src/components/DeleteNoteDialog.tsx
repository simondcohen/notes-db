import React from 'react';
import { X } from 'lucide-react';

interface DeleteNoteDialogProps {
  isOpen: boolean;
  noteTitle: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteNoteDialog({ 
  isOpen, 
  noteTitle, 
  onClose, 
  onConfirm 
}: DeleteNoteDialogProps) {
  if (!isOpen) return null;

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
          <h2 className="text-xl font-semibold text-gray-800">Delete Note</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        
        <div className="py-4">
          <p className="text-gray-600 mb-4">
            Are you sure you want to delete the note "{noteTitle}"?
            This action cannot be undone.
          </p>
        </div>
        
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
} 