import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Save, Clock, ChevronDown, Upload, LogOut, Download, Tag, X, Database } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ImportDialog } from './ImportDialog';
import { ExportBackupDialog } from './ExportBackupDialog';
import { NotebookSelector } from './NotebookSelector';
import { useReadingQueue } from '../hooks/useReadingQueue';
import { SearchResults, SearchResult } from './SearchResults';
import { Section, Item, Note, Notebook } from '../types';
import toast from "react-hot-toast";

interface TopBarProps {
  notebooks: Notebook[];
  selectedNotebook?: string;
  onSelectNotebook: (notebookId: string) => void;
  onCreateNotebook: () => void;
  onRenameNotebook?: (notebookId: string, newTitle: string) => void;
  onDeleteNotebook?: (notebookId: string) => void;
  userId?: string;
  onImportComplete: () => void;
  lastSaved?: Date;
  onSave: () => void;
  currentNotebook?: { id: string; title: string };
  onOpenSidebar: () => void;
  sections?: Section[];
  onSearchResultSelect?: (result: SearchResult) => void;
}

export function TopBar({
  notebooks = [],
  selectedNotebook,
  onSelectNotebook,
  onCreateNotebook,
  onRenameNotebook,
  onDeleteNotebook,
  userId,
  onImportComplete,
  lastSaved,
  onSave,
  currentNotebook,
  onOpenSidebar,
  sections = [],
  onSearchResultSelect,
}: TopBarProps) {
  const [showImportDialog, setShowImportDialog] = React.useState(false);
  const [showExportDialog, setShowExportDialog] = React.useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { count: queueCount } = useReadingQueue(userId || '');

  // Search functionality
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim() || !sections.length) {
      return [];
    }

    console.log("Searching for:", searchQuery);
    console.log("Sections to search:", sections);

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    sections.forEach((section) => {
      // Search in section titles
      if (section.title && section.title.toLowerCase().includes(query)) {
        results.push({
          sectionId: section.id,
          sectionTitle: section.title,
          type: 'section'
        });
      }
      
      // Search in section items
      if (section.items) {
        section.items.forEach((item) => {
          // Search in item titles
          if (item.title && item.title.toLowerCase().includes(query)) {
            results.push({
              sectionId: section.id,
              sectionTitle: section.title || '',
              item,
              type: 'item'
            });
          }
          
          // Check if item has notes property and it's an array
          if (item.notes && Array.isArray(item.notes)) {
            item.notes.forEach((note) => {
              if (
                (note.title && note.title.toLowerCase().includes(query)) ||
                (note.content && note.content.toLowerCase().includes(query))
              ) {
                results.push({
                  sectionId: section.id,
                  sectionTitle: section.title || '',
                  item,
                  note,
                  type: 'note'
                });
              }
            });
          }
        });
      }
      
      // Search in section groups if they exist
      if (section.groups && Array.isArray(section.groups)) {
        section.groups.forEach((group) => {
          // Search in group titles
          if (group.title && group.title.toLowerCase().includes(query)) {
            results.push({
              sectionId: section.id,
              sectionTitle: section.title || '',
              type: 'item',
              item: { id: group.id, title: group.title, notes: [] }
            });
          }
          
          if (group.items && Array.isArray(group.items)) {
            group.items.forEach((item) => {
              // Search in item titles
              if (item.title && item.title.toLowerCase().includes(query)) {
                results.push({
                  sectionId: section.id,
                  sectionTitle: section.title || '',
                  item,
                  type: 'item'
                });
              }
              
              if (item.notes && Array.isArray(item.notes)) {
                item.notes.forEach((note) => {
                  if (
                    (note.title && note.title.toLowerCase().includes(query)) ||
                    (note.content && note.content.toLowerCase().includes(query))
                  ) {
                    results.push({
                      sectionId: section.id,
                      sectionTitle: section.title || '',
                      item,
                      note,
                      type: 'note'
                    });
                  }
                });
              }
            });
          }
        });
      }

      // Search in subsections if they exist
      if (section.subsections && Array.isArray(section.subsections)) {
        section.subsections.forEach((subsection) => {
          // Search in subsection titles
          if (subsection.title && subsection.title.toLowerCase().includes(query)) {
            results.push({
              sectionId: section.id,
              sectionTitle: section.title || '',
              subsectionId: subsection.id,
              subsectionTitle: subsection.title || '',
              type: 'subsection'
            });
          }
          
          if (subsection.items && Array.isArray(subsection.items)) {
            subsection.items.forEach((item) => {
              // Search in item titles
              if (item.title && item.title.toLowerCase().includes(query)) {
                results.push({
                  sectionId: section.id,
                  sectionTitle: section.title || '',
                  subsectionId: subsection.id,
                  subsectionTitle: subsection.title || '',
                  item,
                  type: 'item'
                });
              }
              
              if (item.notes && Array.isArray(item.notes)) {
                item.notes.forEach((note) => {
                  if (
                    (note.title && note.title.toLowerCase().includes(query)) ||
                    (note.content && note.content.toLowerCase().includes(query))
                  ) {
                    results.push({
                      sectionId: section.id,
                      sectionTitle: section.title || '',
                      subsectionId: subsection.id,
                      subsectionTitle: subsection.title || '',
                      item,
                      note,
                      type: 'note'
                    });
                  }
                });
              }
            });
          }
          
          // Search in subsection groups
          if (subsection.groups && Array.isArray(subsection.groups)) {
            subsection.groups.forEach((group) => {
              // Search in group titles
              if (group.title && group.title.toLowerCase().includes(query)) {
                results.push({
                  sectionId: section.id,
                  sectionTitle: section.title || '',
                  subsectionId: subsection.id,
                  subsectionTitle: subsection.title || '',
                  type: 'item',
                  item: { id: group.id, title: group.title, notes: [] }
                });
              }
              
              if (group.items && Array.isArray(group.items)) {
                group.items.forEach((item) => {
                  // Search in item titles
                  if (item.title && item.title.toLowerCase().includes(query)) {
                    results.push({
                      sectionId: section.id,
                      sectionTitle: section.title || '',
                      subsectionId: subsection.id,
                      subsectionTitle: subsection.title || '',
                      item,
                      type: 'item'
                    });
                  }
                  
                  if (item.notes && Array.isArray(item.notes)) {
                    item.notes.forEach((note) => {
                      if (
                        (note.title && note.title.toLowerCase().includes(query)) ||
                        (note.content && note.content.toLowerCase().includes(query))
                      ) {
                        results.push({
                          sectionId: section.id,
                          sectionTitle: section.title || '',
                          subsectionId: subsection.id,
                          subsectionTitle: subsection.title || '',
                          item,
                          note,
                          type: 'note'
                        });
                      }
                    });
                  }
                });
              }
            });
          }
        });
      }
    });

    // Remove duplicates - prioritize notes over items over sections
    const uniqueResults = results.reduce((acc, result) => {
      const key = result.type === 'note' 
        ? `note-${result.note?.id}` 
        : result.type === 'item' 
          ? `item-${result.item?.id}` 
          : result.type === 'subsection'
            ? `subsection-${result.subsectionId}`
            : `section-${result.sectionId}`;
      
      if (!acc[key] || (
        acc[key].type === 'section' || 
        (acc[key].type === 'subsection' && result.type !== 'section') ||
        (acc[key].type === 'item' && result.type === 'note')
      )) {
        acc[key] = result;
      }
      
      return acc;
    }, {} as Record<string, typeof results[0]>);

    console.log("Search results:", Object.values(uniqueResults));
    return Object.values(uniqueResults);
  }, [sections, searchQuery]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    console.log("Search input changed:", value);
    setSearchQuery(value);
    setShowSearchResults(value.trim().length > 0);
  };

  // Handle search result selection
  const handleSelectResult = (result: any) => {
    if (onSearchResultSelect) {
      onSearchResultSelect(result);
      setShowSearchResults(false);
    }
  };

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      localStorage.clear();
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Error during sign out:', error);
      window.location.href = '/';
    }
  };

  return (
    <>
      <div className="h-14 bg-white border-b border-gray-200 flex items-center px-4 justify-between">
        <div className="flex items-center space-x-4">
          {userId && notebooks && notebooks.length > 0 && (
            <NotebookSelector
              notebooks={notebooks}
              selectedNotebook={currentNotebook?.id}
              onSelectNotebook={onSelectNotebook}
              onCreateNotebook={onCreateNotebook}
              onRenameNotebook={onRenameNotebook!}
              onDeleteNotebook={onDeleteNotebook!}
              userId={userId}
            />
          )}

          <div className="relative" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
            />
            
            {/* Clear search button */}
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            
            {/* Search results dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <SearchResults
                  results={searchResults}
                  onSelect={handleSelectResult}
                />
              </div>
            )}
            
            {/* No results message */}
            {showSearchResults && searchQuery.trim() && searchResults.length === 0 && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4 text-center text-gray-500">
                No results found
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {userId && (
            <>
              <Link
                to="/tag/to-read"
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <span>Reading Queue</span>
                {queueCount > 0 && (
                  <span className="inline-block text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5">
                    {queueCount}
                  </span>
                )}
              </Link>
              <Link
                to="/tags"
                state={{ from: location.pathname }}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <Tag className="h-4 w-4" />
                <span>All Tags</span>
              </Link>
              <button
                onClick={() => setShowImportDialog(true)}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <Upload className="h-4 w-4" />
                <span>Import</span>
              </button>
              <button
                onClick={() => setShowExportDialog(true)}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <Database className="h-4 w-4" />
                <span>Export Backup</span>
              </button>
            </>
          )}
          
          {lastSaved instanceof Date && (
            <div className="flex items-center text-sm text-gray-500">
              <Clock className="h-4 w-4 mr-1" />
              Last saved: {lastSaved.toLocaleTimeString()}
            </div>
          )}

          <button
            onClick={onSave}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-600 transition-colors"
          >
            <Save className="h-4 w-4" />
            <span>Save</span>
          </button>

          <button
            disabled={syncing}
            className={`ml-2 rounded px-3 py-1 text-sm text-white ${
              syncing ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500"
            }`}
            onClick={async () => {
              setSyncing(true);
              await toast.promise(
                supabase.functions.invoke("syncNotes"),
                {
                  loading: "Syncing notes…",
                  success: "Notes synced to GitHub!",
                  error: "Sync failed — check console",
                }
              );
              setSyncing(false);
            }}
          >
            {syncing ? "Syncing…" : "Sync Notes"}
          </button>

          <button
            onClick={handleSignOut}
            className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {showImportDialog && userId && (
        <ImportDialog
          userId={userId}
          onClose={() => setShowImportDialog(false)}
          onImportComplete={onImportComplete}
        />
      )}

      {showExportDialog && userId && (
        <ExportBackupDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          userId={userId}
          notebooks={notebooks}
        />
      )}
    </>
  );
}