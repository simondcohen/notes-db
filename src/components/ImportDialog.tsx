import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ImportDialogProps {
  userId: string;
  onClose: () => void;
  onImportComplete: () => void;
}

export function ImportDialog({ userId, onClose, onImportComplete }: ImportDialogProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string>();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setError(undefined);

      const text = await file.text();
      const data = JSON.parse(text);

      // Validate the structure
      if (!Array.isArray(data.notebooks)) {
        throw new Error('Invalid format: Expected an array of notebooks');
      }

      // Import each notebook
      for (const notebook of data.notebooks) {
        if (!notebook.title) {
          throw new Error('Invalid notebook: Missing title');
        }

        // Create notebook
        const { data: newNotebook, error: notebookError } = await supabase
          .from('notebooks')
          .insert({
            title: notebook.title,
            user_id: userId,
          })
          .select('id')
          .single();

        if (notebookError) throw notebookError;

        // Import sections if they exist
        if (Array.isArray(notebook.sections)) {
          for (const section of notebook.sections) {
            if (!section.title) continue;

            // Create section
            const { data: newSection, error: sectionError } = await supabase
              .from('sections')
              .insert({
                title: section.title,
                notebook_id: newNotebook.id,
                position: section.position || 0,
                user_id: userId,
              })
              .select('id')
              .single();

            if (sectionError) throw sectionError;

            // Import items if they exist
            if (Array.isArray(section.items)) {
              for (const item of section.items) {
                if (!item.title) continue;

                // Create item
                const { data: newItem, error: itemError } = await supabase
                  .from('items')
                  .insert({
                    title: item.title,
                    section_id: newSection.id,
                    position: item.position || 0,
                  })
                  .select('id')
                  .single();

                if (itemError) throw itemError;

                // Import notes if they exist
                if (Array.isArray(item.notes)) {
                  for (const note of item.notes) {
                    if (!note.title) continue;

                    const { error: noteError } = await supabase
                      .from('notes')
                      .insert({
                        title: note.title,
                        content: note.content || '',
                        item_id: newItem.id,
                      });

                    if (noteError) throw noteError;
                  }
                }
              }
            }
          }
        }
      }

      onImportComplete();
      onClose();
    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import data');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Import Data</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Select a JSON file to import. The file should contain notebooks, sections, items, and notes.
              Your existing data will be preserved.
            </p>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
              <label className="flex flex-col items-center justify-center cursor-pointer">
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">Choose a file or drag it here</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={isImporting}
                />
              </label>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {error}
              </div>
            )}

            {isImporting && (
              <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Importing data...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}