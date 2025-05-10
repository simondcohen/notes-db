import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { debounce } from 'lodash-es';
import { parseISO } from 'date-fns';
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
import { supabase } from './lib/supabase';
import { Section, Note, Folder } from './types';
import { SearchResult } from './components/SearchResults';
import { useFolders } from './hooks/useFolders';

interface AppUIProps {
  session: Session;
  initialNote?: {
    notebookId: string;
    sectionId: string;
    itemId: string;
    noteId: string;
    skipFolderView?: boolean;
  };
}

interface PersistedState {
  selectedNotebook?: string;
  selectedSection?: string;
  selectedItem?: string;
  selectedNote?: string;
  selectedFolder?: string;
}

const loadPersistedState = (userId: string): PersistedState => {
  const stored = localStorage.getItem(`appState_${userId}`);
  return stored ? JSON.parse(stored) : {};
};

const savePersistedState = (userId: string, partial: PersistedState) => {
  const existing = loadPersistedState(userId);
  const merged: PersistedState = { ...existing };
  Object.entries(partial).forEach(([k, v]) => {
    if (v !== undefined) merged[k as keyof PersistedState] = v;
  });
  localStorage.setItem(`appState_${userId}`, JSON.stringify(merged));
};

export default function AppUI({ session, initialNote }: AppUIProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedNotebook, setSelectedNotebook] = useState<string>();
  const [selectedSection, setSelectedSection] = useState<string>();
  const [selectedItem, setSelectedItem] = useState<string>();
  const [selectedNote, setSelectedNote] = useState<string>();
  const [selectedFolder, setSelectedFolder] = useState<string>();
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
    moveToFolder,
    refresh: refreshSections,
  } = useSections(selectedNotebook);

  const {
    items,
    loading: itemsLoading,
    addItem,
    updateItem: updateItemTitle,
    deleteItem,
    reorderItems,
    moveToFolder: moveItemToFolder,
  } = useItems(selectedSection);

  const {
    notes,
    loading: notesLoading,
    addNote,
    updateNote,
    deleteNote,
    addTagToNote,
    removeTagFromNote,
    refresh: refreshNotes,
  } = useNotes(selectedItem);

  const {
    folders,
    loading: foldersLoading,
    addFolder,
    updateFolder,
    deleteFolder,
    reorderFolders,
    tableMigrated: foldersMigrated
  } = useFolders(selectedNotebook);

  // Add a new state for sections with notes
  const [sectionsWithNotes, setSectionsWithNotes] = useState<Section[]>([]);
  
  // Load notes for all items in sections
  useEffect(() => {
    if (!sections || sections.length === 0) {
      setSectionsWithNotes([]);
      return;
    }
    
    console.log("Processing sections for search:", sections);

    // Helper function to load notes for an item
    const loadNotesForItem = async (itemId: string) => {
      const { data, error } = await supabase
        .from('notes')
        .select(`
          id, 
          title, 
          content, 
          created_at, 
          updated_at,
          tags!note_tags(
            id,
            name
          )
        `)
        .eq('item_id', itemId);
        
      if (error) {
        console.error('Error loading notes for item:', error);
        return [];
      }
      
      return data?.map(note => ({
        id: note.id,
        title: note.title,
        content: note.content,
        tags: note.tags?.map(tag => ({
          id: tag.id,
          name: tag.name
        })) || [],
        lastModified: new Date(note.updated_at)
      })) as Note[];
    };
    
    // Clone and process sections
    const processSections = async () => {
      const processedSections = [...sections];
      
      // Process all sections
      for (const section of processedSections) {
        // Process items in section
        if (section.items) {
          for (const item of section.items) {
            item.notes = await loadNotesForItem(item.id);
          }
        }
        
        // Process items in subsections
        if (section.subsections) {
          for (const subsection of section.subsections) {
            if (subsection.items) {
              for (const item of subsection.items) {
                item.notes = await loadNotesForItem(item.id);
              }
            }
          }
        }
      }
      
      console.log("Processed sections with notes:", processedSections);
      setSectionsWithNotes(processedSections);
    };
    
    processSections();
  }, [sections]);

  useEffect(() => {
    const persisted = loadPersistedState(session.user.id);
    
    if (urlNotebookId) {
      setSelectedNotebook(urlNotebookId);

      // If we've saved state **for this same notebook**, restore it
      if (persisted.selectedNotebook === urlNotebookId) {
        // Only restore the folder selection if a section or item is also selected
        // This prevents showing the subfolder view by default
        if (persisted.selectedSection || persisted.selectedItem) {
          setSelectedFolder(persisted.selectedFolder);
        } else {
          setSelectedFolder(undefined); // Don't default to folder view
        }
        
        setSelectedSection(persisted.selectedSection);
        setSelectedItem(persisted.selectedItem);
        setSelectedNote(persisted.selectedNote);
      } else {
        // New notebook → start clean
        setSelectedSection(undefined);
        setSelectedItem(undefined);
        setSelectedNote(undefined);
        setSelectedFolder(undefined);
      }
    } else if (initialNote) {
      setSelectedNotebook(initialNote.notebookId);
      setSelectedSection(initialNote.sectionId);
      setSelectedItem(initialNote.itemId);
      setSelectedNote(initialNote.noteId);
      
      // If the skipFolderView flag is present, or if we're opening a specific note,
      // don't show the folder view
      setSelectedFolder(undefined);
    } else {
      const persistedState = loadPersistedState(session.user.id);
      setSelectedNotebook(persistedState.selectedNotebook);
      
      // Only restore folder if section or item is also selected
      if (persistedState.selectedSection || persistedState.selectedItem) {
        setSelectedFolder(persistedState.selectedFolder);
      } else {
        setSelectedFolder(undefined);
      }
      
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
      selectedFolder,
    });
  }, [
    session.user.id,
    selectedNotebook,
    selectedSection,
    selectedItem,
    selectedNote,
    selectedFolder,
  ]);

  const activeNotebook = notebooks?.find(
    notebook => notebook?.id === selectedNotebook
  ) || null;

  // Add dynamic document title
  useEffect(() => {
    if (activeNotebook?.title) {
      document.title = `${activeNotebook.title} — Notes`;
    } else {
      document.title = 'Notes App';
    }
    return () => { document.title = 'Notes App'; };
  }, [activeNotebook?.title]);

  const activeSection = sections?.find(
    section => section?.id === selectedSection
  ) || null;

  const activeItem = items?.find(item => item.id === selectedItem) || null;

  const handleNotebookSelect = (notebookId: string) => {
    setSelectedNotebook(notebookId);
    setSelectedSection(undefined);
    setSelectedItem(undefined);
    setSelectedNote(undefined);
    setSelectedFolder(undefined);
    setIsSidebarOpen(false);
    navigate(`/nb/${notebookId}`);
  };

  const handleCreateNotebook = async () => {
    try {
      const newNotebookId = await addNotebook('New Notebook');
      if (newNotebookId) {
        // Navigate to the new notebook
        navigate(`/nb/${newNotebookId}`);
      }
    } catch (error) {
      console.error('Error creating notebook:', error);
    }
  };

  const handleDeleteNotebook = async (notebookId: string) => {
    await deleteNotebook(notebookId);
    setSelectedNotebook(notebooks[0]?.id);
  };

  const handleAddFolder = async () => {
    if (!session?.user?.id || !selectedNotebook) return;
    
    // Deselect any currently selected folder to prevent confusion
    // This ensures the new folder is created at the root level and UI reflects that
    if (selectedFolder) {
      console.log("Deselecting folder before creating new root folder");
      setSelectedFolder(undefined);
      // Reset other selections
      setSelectedSection(undefined);
      setSelectedItem(undefined);
      setSelectedNote(undefined);
    }
    
    await addFolder('New Folder', session.user.id);
  };

  const handleAddSubfolder = async (parentFolderId: string) => {
    if (!session?.user?.id || !selectedNotebook) return;
    
    // Create a subfolder under the parent folder
    await addFolder('New Subfolder', session.user.id, parentFolderId);
  };

  const handleAddSection = async (folderId?: string) => {
    if (!session?.user?.id || !selectedNotebook) return;
    
    console.log("Creating section with folderId:", folderId);
    
    try {
      // If a specific folder ID is passed, use it; otherwise, use the currently selected folder
      const targetFolderId = folderId || selectedFolder;
      console.log("Target folder ID:", targetFolderId);
      
      // Pass the folderId to addSection
      const success = await addSection(session.user.id, 'New Section', targetFolderId);
      
      if (success) {
        console.log("Section created successfully");
        // Make sure the UI updates to show the new section
        await refreshSections();
        
        // If this was added to a subfolder, make sure we're viewing that folder
        if (targetFolderId && targetFolderId !== selectedFolder) {
          setSelectedFolder(targetFolderId);
        }
      } else {
        console.error("Failed to create section");
      }
    } catch (error) {
      console.error("Error adding section:", error);
      alert("Failed to add section. Please try again.");
    }
  };

  const handleAddItem = async () => {
    if (!selectedSection || !session?.user?.id) return;
    
    const newItem = await addItem(session.user.id, 'New Item');
    if (newItem?.id && newItem?.notes?.[0]?.id) {
      setSelectedItem(newItem.id);
      setSelectedNote(newItem.notes[0].id);
    }
  };

  const debouncedSave = React.useMemo(
    () => debounce(async (id: string, html: string) => {
      try {
        if (id && html !== undefined) {
          await updateNote(id, { content: html });
        }
      } catch (error) {
        console.error('Error saving note:', error);
      }
    }, 600),           // waits 600 ms after the last keypress
    [updateNote, refreshNotes]
  );

  const handleUpdateContent = async (noteId: string, content: string) => {
    debouncedSave(noteId, content);
    return Promise.resolve();
  };

  const handleUpdateNoteTitle = async (noteId: string, title: string) => {
    await updateNote(noteId, { title });
    await refreshNotes();
  };

  // Handle search result selection
  const handleSearchResultSelect = (result: SearchResult) => {
    if (!result.sectionId) return;
    
    // Clear any selected folder to prevent showing the subfolder view
    setSelectedFolder(undefined);
    
    // Always navigate to the selected section
    setSelectedSection(result.sectionId);
    
    // If it's a section result, only navigate to the section
    if (result.type === 'section') {
      setSelectedItem(undefined);
      setSelectedNote(undefined);
      return;
    }
    
    // If it's a subsection result, only navigate to the section
    if (result.type === 'subsection') {
      // TODO: If you implement subsection navigation in the future
      setSelectedItem(undefined);
      setSelectedNote(undefined);
      return;
    }
    
    // If it's an item or note result, navigate to the item
    if (result.item && result.item.id) {
      setSelectedItem(result.item.id);
      
      // If it's specifically a note result, also set the selected note
      if (result.type === 'note' && result.note && result.note.id) {
        setSelectedNote(result.note.id);
      } else {
        // For items, select the first note if available
        const item = items.find(i => i.id === result.item?.id);
        if (item?.notes && item.notes.length > 0) {
          setSelectedNote(item.notes[0].id);
        } else {
          setSelectedNote(undefined);
        }
      }
    }
  };

  // Automatically open the most recently edited note when a new item is selected
  React.useEffect(() => {
    if (!selectedItem || notes.length === 0) return;

    // Assumes each note has an `updated_at` (or falls back to `created_at`)
    const lastEdited = [...notes].sort((a, b) => {
      const aTime = parseISO((a as any).updated_at ?? (a as any).created_at).getTime();
      const bTime = parseISO((b as any).updated_at ?? (b as any).created_at).getTime();
      return bTime - aTime;   // newest first
    })[0];

    if (lastEdited && lastEdited.id !== selectedNote) {
      setSelectedNote(lastEdited.id);
    }
  }, [selectedItem, notes]);

  const handleUpdateFolderTitle = async (folderId: string, title: string) => {
    await updateFolder(folderId, title);
  };

  const handleDeleteFolder = async (folderId: string) => {
    await deleteFolder(folderId);
    if (selectedFolder === folderId) {
      setSelectedFolder(undefined);
      setSelectedSection(undefined);
      setSelectedItem(undefined);
      setSelectedNote(undefined);
    }
  };

  const handleSelectFolder = (folderId: string) => {
    console.log("AppUI: handleSelectFolder called with:", folderId);
    
    if (folderId === '') {
      console.log("AppUI: Deselecting folder");
      setSelectedFolder(undefined);
      // When deselecting a folder, we don't necessarily want to clear section selection
      // User might be going from a folder view back to a root section view
    } else {
      console.log("AppUI: Selecting folder:", folderId);
      setSelectedFolder(folderId);
      // When a folder is selected, clear section/item/note to focus on folder contents in SectionsColumn
      setSelectedSection(undefined);
      setSelectedItem(undefined);
      setSelectedNote(undefined);
    }
    
    // Save persisted state
    savePersistedState(session.user.id, {
      selectedNotebook,
      selectedSection: undefined, // Ensure this is cleared when a folder is selected
      selectedItem: undefined,
      selectedNote: undefined,
      selectedFolder: folderId === '' ? undefined : folderId,
    });
  };

  const handleMoveToFolder = async (sectionId: string, folderId: string | null) => {
    if (!sectionId) return;
    
    // Use the moveToFolder function from the useSections hook
    await moveToFolder(sectionId, folderId);
  };

  // Add function to move items to folders
  const handleMoveItemToFolder = async (itemId: string, folderId: string | null) => {
    if (!itemId) return;
    
    // Use the moveToFolder function from the useItems hook for items
    await moveItemToFolder(itemId, folderId);
  };

  // Centralized handler for selecting an item, whether from ItemsColumn or FolderItem
  const handleSelectItem = (itemId: string) => {
    setSelectedItem(itemId);
    // Notes are handled by useNotes(selectedItem)
  };

  // Updated to use the new central handler
  const handleSectionSelect = (sectionId: string) => {
    setSelectedSection(sectionId);
    setSelectedItem(undefined); // Clear item when section changes
    setSelectedNote(undefined);
    // selectedFolder remains as is, allowing a section within a folder to be active
  };

  // Fix handleDeleteSection definition
  const handleDeleteSection = async (sectionId: string) => {
    await deleteSection(sectionId);
  };

  // Fix handleUpdateSectionTitle definition
  const handleUpdateSectionTitle = async (sectionId: string, title: string) => {
    await updateSection(sectionId, title);
  };

  // Fix handleReorderSections definition
  const handleReorderSections = async (reorderedSections: Section[]) => {
    await reorderSections(reorderedSections);
  };

  // Add handleReorderFolders function
  const handleReorderFolders = async (reorderedFolders: Folder[]) => {
    await reorderFolders(reorderedFolders);
  };

  if (notebooksLoading) return <LoadingSpinner />;
  if (notebooksError) return <div className="text-red-500">Error: {notebooksError}</div>;

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
        sections={sectionsWithNotes}
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
            folders={folders}
            selectedSection={selectedSection}
            selectedFolder={selectedFolder}
            onSelectSection={handleSectionSelect}
            onSelectFolder={handleSelectFolder}
            onSelectItem={handleSelectItem}
            onAddSection={handleAddSection}
            onAddFolder={handleAddFolder}
            onAddSubfolder={handleAddSubfolder}
            onDeleteSection={handleDeleteSection}
            onDeleteFolder={handleDeleteFolder}
            onUpdateSectionTitle={handleUpdateSectionTitle}
            onUpdateFolderTitle={handleUpdateFolderTitle}
            onReorderSections={handleReorderSections}
            onReorderFolders={handleReorderFolders}
            onMoveToFolder={handleMoveToFolder}
            userId={session?.user?.id}
            hasFolderSupport={foldersMigrated === true}
          />
          
          <ItemsColumn
            items={items}
            folders={folders}
            selectedItem={selectedItem}
            onSelectItem={handleSelectItem}
            onAddItem={handleAddItem}
            onDeleteItem={deleteItem}
            onUpdateItemTitle={updateItemTitle}
            onReorderItems={reorderItems}
            onMoveItemToFolder={handleMoveItemToFolder}
            hasFolderSupport={foldersMigrated === true}
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