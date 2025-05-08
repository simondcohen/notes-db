import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Folder, FolderOpen, ChevronDown, ChevronRight, Trash2, FolderPlus, FileText } from 'lucide-react';
import type { Folder as FolderType, Item as ItemType } from '../types';
import { supabase } from '../lib/supabase';
import { useItems } from '../hooks/useItems';

interface FolderItemProps {
  folder: FolderType;
  isActive: boolean;
  selectedFolder?: string;
  selectedItem?: string;
  onSelect: (folderId: string) => void;
  onRename: (folderId: string, title: string) => void;
  onDelete: (folderId: string) => void;
  onAddSubfolder?: (parentFolderId: string) => void;
  onSelectItem?: (itemId: string) => void;
  children?: React.ReactNode;
}

// Create a hook to get subfolders
export function useSubfolders(parentFolderId: string) {
  const [subfolders, setSubfolders] = useState<FolderType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMounted = useRef(true);
  const fetchInProgress = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  
  // Use useCallback to ensure the function reference is stable
  const fetchSubfolders = useCallback(async () => {
    // Prevent multiple simultaneous fetches
    if (fetchInProgress.current) return;
    if (!parentFolderId) {
      setSubfolders([]);
      return;
    }
    
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    try {
      fetchInProgress.current = true;
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('folders')
        .select('id, name')
        .eq('parent_folder_id', parentFolderId)
        .order('position', { ascending: true });
        
      if (error) throw error;
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        const processedFolders = data?.map((folder: { id: string; name: string }) => ({
          id: folder.id,
          title: folder.name,
          items: [],
          sections: [],
          parentFolderId: parentFolderId
        })) || [];
        
        setSubfolders(processedFolders);
      }
    } catch (error) {
      console.error('Error loading subfolders:', error);
      if (isMounted.current) {
        setError(error as Error);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
      // Release the lock after a short delay to prevent rapid consecutive fetches
      setTimeout(() => {
        fetchInProgress.current = false;
      }, 200);
    }
  }, [parentFolderId]);
  
  // Debounced refresh function to prevent multiple rapid calls
  const debouncedRefresh = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      fetchSubfolders();
    }, 300) as unknown as number;
  }, [fetchSubfolders]);
  
  useEffect(() => {
    // Set up the isMounted ref
    isMounted.current = true;
    
    // Initial fetch
    fetchSubfolders();
    
    // Set up a subscription to refresh when folders change
    const subscription = supabase
      .channel('folder_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'folders' 
      }, () => {
        debouncedRefresh();
      })
      .subscribe();
      
    return () => {
      // Clean up
      isMounted.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      subscription.unsubscribe();
    };
  }, [parentFolderId, fetchSubfolders, debouncedRefresh]);
  
  return { 
    subfolders, 
    loading, 
    error,
    refresh: debouncedRefresh 
  };
}

export function FolderItem({
  folder,
  isActive,
  selectedFolder,
  selectedItem,
  onSelect,
  onRename,
  onDelete,
  onAddSubfolder,
  onSelectItem,
  children
}: FolderItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(folder.title);
  const [showOptions, setShowOptions] = useState(false);
  const refreshRequestedRef = useRef(false);
  const hasChildrenRef = useRef<boolean>(false);
  
  // Get items directly within this folder
  const { items: folderItems, loading: itemsLoading, refresh: refreshFolderItems } = useItems(undefined, folder.id);

  // Check if there are children when the component renders
  useEffect(() => {
    hasChildrenRef.current = Boolean(children);
    console.log(`Folder ${folder.title} has children: ${hasChildrenRef.current}`);
  }, [children, folder.title]);
  
  // Get subfolders for this folder
  const { subfolders, refresh: refreshSubfolders } = useSubfolders(folder.id);

  // Auto-open the folder when it's selected
  useEffect(() => {
    if (isActive && !isOpen) {
      setIsOpen(true);
    }
  }, [isActive]);

  // Only refresh subfolders when isOpen changes to true
  useEffect(() => {
    if (isOpen && !refreshRequestedRef.current) {
      refreshRequestedRef.current = true;
      refreshSubfolders();
      refreshFolderItems();
      // Reset the flag after a delay
      setTimeout(() => {
        refreshRequestedRef.current = false;
      }, 1000);
    }
  }, [isOpen, refreshSubfolders, refreshFolderItems]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
    console.log(`Toggled folder ${folder.title} to ${!isOpen ? 'open' : 'closed'}`);
  };

  const handleSelect = () => {
    // Make sure we correctly pass the ID of this folder to the parent
    console.log(`FolderItem: Selected folder ${folder.title} (${folder.id})`);
    onSelect(folder.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setIsEditing(false);
      onRename(folder.id, title);
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setTitle(folder.title);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (title !== folder.title) {
      onRename(folder.id, title);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Remove the confirmation dialog as it's already handled in the SectionsColumn component
    onDelete(folder.id);
  };

  const handleAddSubfolder = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddSubfolder) {
      onAddSubfolder(folder.id);
      // Auto-open the folder when adding a subfolder
      setIsOpen(true);
      // Set a timeout before refreshing to avoid multiple rapid calls
      setTimeout(refreshSubfolders, 800);
    }
  };

  return (
    <div className="folder-container">
      <div 
        className={`flex items-center p-2 text-sm rounded-md cursor-pointer hover:bg-gray-100 relative ${isActive ? 'bg-blue-100 text-blue-800 font-medium' : ''}`}
        onClick={handleSelect}
        onMouseEnter={() => setShowOptions(true)}
        onMouseLeave={() => setShowOptions(false)}
      >
        <div 
          className="mr-1 cursor-pointer" 
          onClick={handleToggle}
        >
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </div>
        
        {isOpen ? (
          <FolderOpen className="w-5 h-5 mr-2 text-yellow-500" />
        ) : (
          <Folder className="w-5 h-5 mr-2 text-yellow-500" />
        )}
        
        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="flex-1 bg-white border rounded px-1"
            autoFocus
          />
        ) : (
          <span 
            className={`flex-1 truncate ${isActive ? 'font-medium' : ''}`}
            onDoubleClick={handleDoubleClick}
          >
            {folder.title}
          </span>
        )}
        
        {showOptions && !isEditing && (
          <div className="flex items-center">
            {onAddSubfolder && (
              <button 
                onClick={handleAddSubfolder}
                className="p-1 text-gray-400 hover:text-blue-500 mr-1" 
                title="Add Subfolder"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={handleDelete}
              className="p-1 text-gray-400 hover:text-red-500" 
              title="Delete Folder"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      
      {isOpen && (
        <div className="pl-5 mt-1 border-l ml-3 border-gray-200">
          {/* Always show sections within this folder when open, regardless of selection state */}
          <div className="sections-container py-1">
            {/* Show a label to indicate this is the expanded view */}
            <div className="text-xs font-medium text-gray-400 mb-1 flex items-center">
              <span className="mr-1">Contents</span>
              <div className="h-px flex-grow bg-gray-200"></div>
            </div>
            
            {/* Show a hint when not selected but expanded */}
            {!isActive && (
              <div className="bg-blue-50 text-xs p-1 rounded mb-2 text-blue-600 flex items-center">
                <span className="mr-1">⚡</span> Quick view mode. <button onClick={handleSelect} className="text-blue-700 hover:underline ml-1">Open folder</button>
              </div>
            )}
            
            {/* Directly render children (sections) without extra wrapping */}
            {children ? (
              <div className="folder-sections-wrapper">
                {children}
              </div>
            ) : (
              <div className="text-xs text-gray-400 italic px-2 py-1">
                No sections available in this folder
              </div>
            )}

            {/* Display items directly in this folder */}
            {itemsLoading && <div className="text-xs text-gray-400 px-2 py-1">Loading items...</div>}
            {folderItems && folderItems.length > 0 && (
              <div className="folder-direct-items-container pt-1 mt-2 border-t border-gray-200">
                <div className="text-xs font-medium text-gray-400 mb-1 flex items-center mt-1">
                  <span className="mr-1">Items in this folder</span>
                  <div className="h-px flex-grow bg-gray-200"></div>
                </div>
                {folderItems.map(item => (
                  <div 
                    key={item.id} 
                    className={`flex items-center p-1 text-sm rounded-md cursor-pointer ${selectedItem === item.id ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}
                    onClick={() => onSelectItem && onSelectItem(item.id)}
                  >
                    <FileText className="w-4 h-4 mr-2 ${selectedItem === item.id ? 'text-blue-600' : 'text-blue-500'}" />
                    <span className="truncate">{item.title}</span>
                  </div>
                ))}
              </div>
            )}
            {folderItems && folderItems.length === 0 && !children && (
               <div className="text-xs text-gray-400 italic px-2 py-1">
                 This folder is empty.
               </div>
            )}
          </div>
          
          {/* Display subfolders */}
          {subfolders.length > 0 && (
            <div className="subfolders-container pt-1">
              <div className="text-xs font-medium text-gray-400 mb-1 flex items-center">
                <span className="mr-1">Subfolders</span>
                <div className="h-px flex-grow bg-gray-200"></div>
              </div>
              {subfolders.map(subfolder => (
                <FolderItem
                  key={subfolder.id}
                  folder={subfolder}
                  isActive={selectedFolder === subfolder.id}
                  selectedFolder={selectedFolder}
                  onSelect={onSelect}
                  onRename={onRename}
                  onDelete={onDelete}
                  onAddSubfolder={onAddSubfolder}
                  selectedItem={selectedItem}
                  onSelectItem={onSelectItem}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 