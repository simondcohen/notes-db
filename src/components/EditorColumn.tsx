import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus, X, Tag } from 'lucide-react';
import type { Note } from '../types';
import { EditableText } from './EditableText';
import { RichTextEditor } from './RichTextEditor';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from './ui/command';
import { useTags } from '../hooks/useTags';
import { DeleteNoteDialog } from './DeleteNoteDialog';
import debounce from 'lodash.debounce';

interface EditorColumnProps {
  notes: Note[];
  selectedNote?: string;
  onSelectNote: (noteId: string) => void;
  onAddNote: () => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  onUpdateContent: (noteId: string, content: string) => Promise<void>;
  onUpdateNoteTitle: (noteId: string, newTitle: string) => Promise<void>;
  addTagToNote: (noteId: string, tagId: string) => Promise<void>;
  removeTagFromNote: (noteId: string, tagId: string) => Promise<void>;
  userId: string;
}

export function EditorColumn({
  notes,
  selectedNote,
  onSelectNote,
  onAddNote,
  onDeleteNote,
  onUpdateContent,
  onUpdateNoteTitle,
  addTagToNote,
  removeTagFromNote,
  userId,
}: EditorColumnProps) {
  const activeNote = notes?.find((note) => note.id === selectedNote);
  const isDisabled = !notes;
  const [tagInput, setTagInput] = useState('');
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const { tags, addTag, loading: tagsLoading } = useTags(userId);
  const location = useLocation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string } | null>(null);
  const [draftContent, setDraftContent] = useState('');

  const debouncedSave = useRef(
    debounce((id: string, html: string) => onUpdateContent(id, html), 600)
  ).current;

  useEffect(() => setDraftContent(activeNote?.content || ''), [activeNote?.id]);

  const handleDeleteNote = async (noteId: string, noteTitle: string) => {
    setNoteToDelete({ id: noteId, title: noteTitle });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (noteToDelete) {
      await onDeleteNote(noteToDelete.id);
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    }
  };

  const handleTagSelect = async (tagId: string) => {
    if (activeNote && !activeNote.tags?.some(t => t.id === tagId)) {
      await addTagToNote(activeNote.id, tagId);
    }
    setTagInput('');
    setIsTagsOpen(false);
  };

  const handleCreateTag = async () => {
    const trimmedInput = tagInput.trim();
    if (!trimmedInput || !activeNote) return;

    const newTag = await addTag(trimmedInput);
    if (newTag) {
      await addTagToNote(activeNote.id, newTag.id);
      setTagInput('');
      setIsTagsOpen(false);
    }
  };

  const filteredTags = tags.filter(tag => 
    tag.name.toLowerCase().includes(tagInput.toLowerCase()) &&
    !activeNote?.tags?.some(t => t.id === tag.id)
  );

  return (
    <div className="flex-1 h-full bg-white flex flex-col">
      <div className="h-14 px-4 border-b border-gray-200 flex items-center justify-between bg-white">
        <div className="flex space-x-2 overflow-x-auto">
          {notes?.map((note) => (
            <div
              key={note.id}
              className={`
                group px-3 py-2 rounded-lg cursor-pointer flex items-center space-x-2
                ${note.id === selectedNote ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}
              `}
              onClick={() => onSelectNote(note.id)}
            >
              <EditableText
                value={note.title}
                onSave={(newTitle) => onUpdateNoteTitle(note.id, newTitle)}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteNote(note.id, note.title);
                }}
                className="opacity-0 group-hover:opacity-100"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={onAddNote}
          className={`
            p-1.5 rounded-lg transition-all duration-200
            ${isDisabled
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'hover:bg-gray-100 text-gray-600'
            }
          `}
          title={isDisabled ? "Select an item first" : "Add Note"}
          disabled={isDisabled}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeNote ? (
          <>
            <div className="p-4 border-b border-gray-200">
              <div className="flex flex-wrap gap-2 mb-2">
                {activeNote.tags?.map(tag => (
                  <Link
                    key={tag.id}
                    to={`/tag/${encodeURIComponent(tag.name)}`}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-sm hover:bg-blue-100"
                  >
                    {tag.name}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        removeTagFromNote(activeNote.id, tag.id);
                      }}
                      className="hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Link>
                ))}
                <button
                  onClick={() => setIsTagsOpen(true)}
                  className="inline-flex items-center gap-1 px-2 py-1 border border-gray-200 hover:border-gray-300 rounded-full text-sm text-gray-600"
                >
                  <Tag className="h-3 w-3" />
                  Add tag
                </button>
              </div>

              <div className="relative">
                {isTagsOpen && (
                  <div className="absolute z-50 top-full left-0 w-64 mt-1 bg-white rounded-lg shadow-lg border border-gray-200">
                    <Command>
                      <CommandInput
                        placeholder="Search or create tag..."
                        value={tagInput}
                        onValueChange={setTagInput}
                      />
                      <CommandList>
                        <CommandEmpty>
                          {tagInput.trim() && (
                            <button
                              className="w-full text-left px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
                              onClick={handleCreateTag}
                              disabled={tagsLoading}
                            >
                              Create "{tagInput.trim()}"
                            </button>
                          )}
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredTags.map(tag => (
                            <CommandItem
                              key={tag.id}
                              onSelect={() => handleTagSelect(tag.id)}
                            >
                              {tag.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <RichTextEditor
                content={draftContent}
                onChange={(content) => {
                  setDraftContent(content);      // instant UI update
                  if (activeNote) debouncedSave(activeNote.id, content); // background save
                }}
              />
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            {isDisabled ? 'Select an item to view notes' : 'Select a note to start editing'}
          </div>
        )}
      </div>

      {/* Delete Note Dialog */}
      {noteToDelete && (
        <DeleteNoteDialog
          isOpen={deleteDialogOpen}
          noteTitle={noteToDelete.title}
          onClose={() => {
            setDeleteDialogOpen(false);
            setNoteToDelete(null);
          }}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}