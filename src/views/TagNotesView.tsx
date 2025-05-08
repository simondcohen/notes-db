// trigger deploy

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useNotesByTag } from '../hooks/useNotesByTag';

export function TagNotesView() {
  const { tagName } = useParams<{ tagName: string }>();
  const navigate = useNavigate();
  const { notes, loading } = useNotesByTag(tagName || '');

  if (!tagName) {
    return <div>Tag not found</div>;
  }

  const handleBack = () => navigate(-1);

  const handleNoteClick = (note: any) => {
    // Navigate to the notebook with the note to open
    navigate(`/nb/${note.notebookId}`, {
      state: {
        noteToOpen: {
          notebookId: note.notebookId,
          sectionId: note.sectionId,
          subsectionId: note.subsectionId,
          itemId: note.itemId,
          noteId: note.id,
          skipFolderView: true
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Notes tagged with "{tagName}"
        </h1>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No notes found with this tag
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleNoteClick(note)}
              >
                <h2 className="text-lg font-medium text-gray-900 mb-2">
                  {note.title}
                </h2>
                <div className="text-gray-600 line-clamp-2">
                  {note.content.replace(/<[^>]*>/g, '')}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {note.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}