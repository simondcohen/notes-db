import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Save, Clock, ChevronDown, Upload, LogOut, Download, Tag, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ImportDialog } from './ImportDialog';
import { exportData } from '../utils/exportData';
import { NotebookSelector } from './NotebookSelector';
import { useReadingQueue } from '../hooks/useReadingQueue';
import { SearchResults } from './SearchResults';
import { Section, Item, Note, Notebook } from '../types';

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
  onSearchResultSelect?: (result: { sectionId: string, item: Item, note: Note, subsectionId?: string }) => void;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { count: queueCount } = useReadingQueue(userId || '');

  // Search functionality
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim() || !sections.length) {
      return [];
    }

    const query = searchQuery.toLowerCase();
    const results: Array<{
      sectionId: string;
      sectionTitle: string;
      subsectionId?: string;
      subsectionTitle?: string;
      item: Item;
      note: Note;
    }> = [];

    sections.forEach((section) => {
      // Search in section items
      section.items?.forEach((item) => {
        item.notes?.forEach((note) => {
          if (
            item.title.toLowerCase().includes(query) ||
            note.title?.toLowerCase().includes(query) ||
            (note.content && note.content.toLowerCase().includes(query))
          ) {
            results.push({
              sectionId: section.id,
              sectionTitle: section.title || '',
              item,
              note,
            });
          }
        });
      });

      // Search in subsections if they exist
      section.subsections?.forEach((subsection) => {
        subsection.items?.forEach((item) => {
          item.notes?.forEach((note) => {
            if (
              item.title.toLowerCase().includes(query) ||
              note.title?.toLowerCase().includes(query) ||
              (note.content && note.content.toLowerCase().includes(query))
            ) {
              results.push({
                sectionId: section.id,
                sectionTitle: section.title || '',
                subsectionId: subsection.id,
                subsectionTitle: subsection.title || '',
                item,
                note,
              });
            }
          });
        });
      });
    });

    return results;
  }, [sections, searchQuery]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowSearchResults(e.target.value.trim().length > 0);
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

  const handleExportAll = async () => {
    if (!userId) return;
    try {
      await exportData(userId);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data. Please try again.');
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
                onClick={handleExportAll}
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <Download className="h-4 w-4" />
                <span>Export All</span>
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
    </>
  );
}