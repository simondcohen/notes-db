import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../utils/error';
import type { Folder } from '../types';

export function useFolders(notebookId?: string, parentFolderId?: string) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableMigrated, setTableMigrated] = useState<boolean | null>(null);

  // Check if the folders table exists
  const checkTableExists = async () => {
    try {
      // Try to fetch from the folders table
      await supabase
        .from('folders')
        .select('*', { count: 'exact', head: true });

      // If the query succeeds (even with error === null), the table exists
      setTableMigrated(true);
    } catch (error) {
      // If there's an error, the table doesn't exist yet
      console.log("Folders table doesn't exist yet");
      setTableMigrated(false);
    }
  };

  useEffect(() => {
    checkTableExists();
  }, []);

  const refresh = async () => {
    if (!tableMigrated) {
      setFolders([]);
      return;
    }

    if (!notebookId && !parentFolderId) {
      setFolders([]);
      return;
    }
    
    try {
      setLoading(true);
      // Query based on whether we're getting root folders or nested folders
      const query = supabase
        .from('folders')
        .select('id, name, position');
      
      if (notebookId) {
        query.eq('notebook_id', notebookId).is('parent_folder_id', null);
      } else if (parentFolderId) {
        query.eq('parent_folder_id', parentFolderId);
      }
      
      const { data, error } = await query.order('position', { ascending: true });

      if (error) throw error;

      const processedFolders = data?.map(folder => ({
        id: folder.id,
        title: folder.name,
        items: [],
        sections: []
      })) || [];

      setFolders(processedFolders);
    } catch (error) {
      console.error('Error loading folders:', error);
      handleError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  const addFolder = async (title: string = 'New Folder', userId: string, specificParentFolderId?: string) => {
    if (!tableMigrated) {
      console.warn("Cannot add folder: folders table doesn't exist yet");
      return false;
    }

    try {
      // If a specific parent folder ID is provided, it overrides the hook-level parentFolderId
      const effectiveParentFolderId = specificParentFolderId || parentFolderId;
      
      if (effectiveParentFolderId) {
        console.log(`Creating subfolder under parent: ${effectiveParentFolderId}`);
      } else {
        console.log(`Creating root-level folder in notebook: ${notebookId}`);
      }
      
      // Get current highest position
      const positionQuery = supabase
        .from('folders')
        .select('position')
        .order('position', { ascending: false })
        .limit(1);
      
      if (notebookId && !effectiveParentFolderId) {
        positionQuery.eq('notebook_id', notebookId).is('parent_folder_id', null);
      } else if (effectiveParentFolderId) {
        positionQuery.eq('parent_folder_id', effectiveParentFolderId);
      }
      
      const { data: positionData } = await positionQuery;
      const position = (positionData?.[0]?.position ?? -1) + 1;
      
      // Create insert object
      const insertData: any = {
        name: title,
        position,
        user_id: userId
      };
      
      if (notebookId && !effectiveParentFolderId) {
        insertData.notebook_id = notebookId;
        console.log("Setting folder in root of notebook:", notebookId);
      } else if (effectiveParentFolderId) {
        insertData.parent_folder_id = effectiveParentFolderId;
        console.log("Setting folder as child of parent folder:", effectiveParentFolderId);
      }
      
      console.log("Inserting folder with data:", insertData);
      
      // Insert the folder
      const { error } = await supabase
        .from('folders')
        .insert(insertData);

      if (error) throw error;
      await refresh();
      return true;
    } catch (error) {
      handleError(error as Error);
      return false;
    }
  };

  const updateFolder = async (folderId: string, title: string) => {
    if (!tableMigrated) {
      console.warn("Cannot update folder: folders table doesn't exist yet");
      return false;
    }

    try {
      const { error } = await supabase
        .from('folders')
        .update({ name: title })
        .eq('id', folderId);

      if (error) throw error;
      await refresh();
      return true;
    } catch (error) {
      handleError(error as Error);
      return false;
    }
  };

  const deleteFolder = async (folderId: string) => {
    if (!tableMigrated) {
      console.warn("Cannot delete folder: folders table doesn't exist yet");
      return false;
    }

    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId);

      if (error) throw error;
      await refresh();
      return true;
    } catch (error) {
      handleError(error as Error);
      return false;
    }
  };

  const reorderFolders = async (reorderedFolders: Folder[]) => {
    if (!tableMigrated) {
      console.warn("Cannot reorder folders: folders table doesn't exist yet");
      return false;
    }

    try {
      await Promise.all(
        reorderedFolders.map((folder, index) =>
          supabase
            .from('folders')
            .update({ position: index })
            .eq('id', folder.id)
        )
      );
      await refresh();
      return true;
    } catch (error) {
      handleError(error as Error);
      return false;
    }
  };

  useEffect(() => {
    if (tableMigrated !== null) {
      refresh();
    }
  }, [notebookId, parentFolderId, tableMigrated]);

  return {
    folders,
    loading,
    refresh,
    addFolder,
    updateFolder,
    deleteFolder,
    reorderFolders,
    tableMigrated
  };
} 