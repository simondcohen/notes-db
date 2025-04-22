import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { TopBar } from './components/TopBar';
import { NotebookSidebar } from './components/NotebookSidebar';
import { SectionsColumn } from './components/SectionsColumn';
import { ItemsColumn } from './components/ItemsColumn';
import { EditorColumn } from './components/EditorColumn';
import { LoadingSpinner } from './components/LoadingSpinner';
import { useNotebooks } from './hooks/useNotebooks';
import { useSections } from './hooks/useSections';
import { useItems } from './hooks/useItems';
import { useNotes } from './hooks/useNotes';

interface AppUIProps {
  session: Session;
  initialNote?: {
    notebookId: string;
    sectionId: string;
    itemId: string;
    noteId: string;
  };
}

interface PersistedState {
  selectedNotebook?: string;
  selectedSection?: string;
  selectedItem?: string;
  selectedNote?: string;
}

const loadPersistedState = (userId: string): PersistedState => {
  const stored = localStorage.getItem(`appState_${userId}`);
  return stored ? JSON.parse(stored) : {};
};

const savePersistedState = (userId: string, state: PersistedState) => {
  localStorage.setItem(`appState_${userId}`, JSON.stringify(state));
};

export default function AppUI({ session, initialNote }: AppUIProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedNotebook, setSelectedNotebook] = useState<string>();
  const [selectedSection, setSelectedSection] = useState<string>();
  const [selectedItem, setSelectedItem] = useState<string>();
  const [selectedNote, setSelectedNote] = useState<string>();
  const navigate = useNavigate();
  const { notebookId: urlNotebookId } = useParams();
  
  const {
    notebooks,
    loading: notebooksLoading,
    error: notebooksError,
    addNotebook,
    updateNotebook,
    deleteNotebook,
    refresh: refreshNotebooks,
  } = useNotebooks(session.user.id);

  const {
    sections,
    loading: sectionsLoading,
    addSection,
    updateSection,
    deleteSection,
    reorderSections,
  } = useSections(selectedNotebook);

  const {
    items,
    loading: itemsLoading,
    addItem,
    updateItem: updateItemTitle,
    deleteItem,
    reorderItems,
  } = useItems(selectedSection);

  const {
    notes,
    loading: notesLoading,
    addNote,
    updateNote,
    deleteNote,
    addTagToNote,
    removeTagFromNote,
  } = useNotes(selectedItem);

  useEffect(() => {
    if (urlNotebookId) {
      setSelectedNotebook(urlNotebookId);
    } else if (initialNote) {
      setSelectedNotebook(initialNote.notebookId);
      setSelectedSection(initialNote.sectionId);
      setSelectedItem(initialNote.itemId);
      setSelectedNote(initialNote.noteId);
    } else {
      const persistedState = loadPersistedState(session.user.id);
      setSelectedNotebook(persistedState.selectedNotebook);
      setSelectedSection(persistedState.selectedSection);
      setSelectedItem(persistedState.selectedItem);
      setSelectedNote(persistedState.selectedNote);
    }
  }, [session.user.id, initialNote, urlNotebookId]);

  useEffect(() => {
    savePersistedState(session.user.id, {
      selectedNotebook,
      selectedSection,
      selectedItem,
      selectedNote,
    });
  }, [
    session.user.id,
    selectedNotebook,
    selectedSection,
    selectedItem,
    selectedNote,
  ]);

  if (notebooksLoading) return <LoadingSpinner />;
  if (notebooksError) return <div className="text-red-500">Error: {notebooksError}</div>;

  const activeNotebook = notebooks?.find(
    notebook => notebook?.id === selectedNotebook
  ) || null;

  const activeSection = sections?.find(
    section => section?.id === selectedSection
  ) || null;

  const activeItem = items?.find(item => item.id === selectedItem) || null;

  const handleNotebookSelect = (notebookId: string) => {
    setSelectedNotebook(notebookId);
    setSelectedSection(undefined);
    setSelectedItem(undefined);
    setSelectedNote(undefined);
    setIsSidebarOpen(false);
    navigate('/nb/' + notebookId);
  };

  const handleCreateNotebook = async () => {
    await addNotebook('New Notebook');
  };

  const handleDeleteNotebook = async (notebookId: string) => {
    await deleteNotebook(notebookId);
    setSelectedNotebook(notebooks[0]?.id);
  };

  const handleAddSection = async () => {
    if (selectedNotebook) {
      await addSection(session.user.id);
    }
  };

  const handleAddItem = async () => {
    if (!selectedSection) return;
    
    const newItem = await addItem('New Item');
    if (newItem?.id && newItem?.notes?.[0]?.id) {
      setSelectedItem(newItem.id);
      setSelectedNote(newItem.notes[0].id);
    }
  };

  const handleUpdateContent = async (noteId: string, content: string) => {
    await updateNote(noteId, { content });
  };

  const handleUpdateNoteTitle = async (noteId: string, title: string) => {
    await updateNote(noteId, { title });
  };

  // Handle search result selection
  const handleSearchResultSelect = (result: { 
    sectionId: string, 
    item: any, 
    note: any, 
    subsectionId?: string 
  }) => {
    if (!result.sectionId || !result.item || !result.note) return;
    
    // Navigate to the correct section
    setSelectedSection(result.sectionId);
    
    // Select the item
    setSelectedItem(result.item.id);
    
    // Select the note
    setSelectedNote(result.note.id);
  };

  return (
    <div className="h-screen flex flex-col">
      <TopBar
        onOpenSidebar={() => setIsSidebarOpen(true)}
        lastSaved={activeNotebook?.lastModified}
        onSave={async () => {
          if (selectedNotebook) {
            await updateNotebook(selectedNotebook, activeNotebook?.title || '');
          }
        }}
        currentNotebook={activeNotebook ? { id: activeNotebook.id, title: activeNotebook.title } : undefined}
        onRenameNotebook={updateNotebook}
        onDeleteNotebook={handleDeleteNotebook}
        userId={session.user.id}
        onImportComplete={refreshNotebooks}
        notebooks={notebooks}
        onSelectNotebook={handleNotebookSelect}
        onCreateNotebook={handleCreateNotebook}
        sections={sections}
        onSearchResultSelect={handleSearchResultSelect}
      />
      
      <div className="flex-1 flex">
        <NotebookSidebar
          notebooks={notebooks}
          selectedNotebook={selectedNotebook}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          onSelectNotebook={handleNotebookSelect}
          onCreateNotebook={handleCreateNotebook}
          onRenameNotebook={updateNotebook}
          onDeleteNotebook={handleDeleteNotebook}
        />
        
        <div className="flex-1 flex divide-x divide-gray-200">
          <SectionsColumn
            sections={sections}
            selectedSection={selectedSection}
            onSelectSection={(sectionId) => {
              setSelectedSection(sectionId);
              setSelectedItem(undefined);
              setSelectedNote(undefined);
            }}
            onAddSection={handleAddSection}
            onDeleteSection={deleteSection}
            onUpdateSectionTitle={updateSection}
            onReorderSections={reorderSections}
          />
          
          <ItemsColumn
            items={items}
            selectedItem={selectedItem}
            onSelectItem={(itemId) => {
              setSelectedItem(itemId);
              const item = items.find(i => i.id === itemId);
              if (item?.notes?.length > 0) {
                setSelectedNote(item.notes[0].id);
              }
            }}
            onAddItem={handleAddItem}
            onDeleteItem={deleteItem}
            onUpdateItemTitle={updateItemTitle}
            onReorderItems={reorderItems}
          />
          
          <EditorColumn
            notes={notes}
            selectedNote={selectedNote}
            onSelectNote={setSelectedNote}
            onAddNote={async () => {
              if (selectedItem) {
                const newNote = await addNote('New Note');
                if (newNote) {
                  setSelectedNote(newNote.id);
                }
              }
            }}
            onDeleteNote={async (noteId: string) => {
              await deleteNote(noteId);
              return;
            }}
            onUpdateContent={handleUpdateContent}
            onUpdateNoteTitle={handleUpdateNoteTitle}
            addTagToNote={async (noteId: string, tagId: string) => {
              await addTagToNote(noteId, tagId);
              return;
            }}
            removeTagFromNote={async (noteId: string, tagId: string) => {
              await removeTagFromNote(noteId, tagId);
              return;
            }}
            userId={session.user.id}
          />
        </div>
      </div>
    </div>
  );
}