import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../utils/error';
import type { Item } from '../types';

export function useItems(sectionId?: string, folderId?: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFolderColumn, setHasFolderColumn] = useState<boolean | null>(null);

  // Check if folder_id column exists in items table
  const checkFolderColumnExists = async () => {
    try {
      // Try to fetch an item with a folder_id check to see if the column exists
      await supabase
        .from('items')
        .select('id')
        .is('folder_id', null)
        .limit(1);
      
      setHasFolderColumn(true);
    } catch (error) {
      // If this errors, the folder_id column doesn't exist yet
      console.log("folder_id column doesn't exist yet in items table");
      setHasFolderColumn(false);
    }
  };

  useEffect(() => {
    checkFolderColumnExists();
  }, []);

  const refresh = async () => {
    // If neither sectionId nor folderId is provided, reset items
    if (!sectionId && !folderId) {
      setItems([]);
      return;
    }
    
    try {
      setLoading(true);
      const query = supabase.from('items').select('id, title, position');
      
      // Only filter by folder if the folder_id column exists
      if (sectionId) {
        query.eq('section_id', sectionId);
      } else if (folderId && hasFolderColumn) {
        query.eq('folder_id', folderId);
      } else if (!sectionId && !hasFolderColumn) {
        // If no section ID and folder column doesn't exist, we can't load any items
        setItems([]);
        setLoading(false);
        return;
      }
      
      const { data, error } = await query.order('position', { ascending: true });

      if (error) throw error;

      const processedItems = data?.map(item => ({
        id: item.id,
        title: item.title,
        notes: []
      })) || [];

      setItems(processedItems);
    } catch (error) {
      console.error('Error loading items:', error);
      handleError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (userId: string, title: string = 'New Item', specificFolderId?: string) => {
    // Use the specific folder ID if provided, otherwise use the hook-level folder ID
    const effectiveFolderId = specificFolderId || folderId;
    
    // If we're trying to add to a folder but the column doesn't exist yet, fail
    if (effectiveFolderId && !hasFolderColumn) {
      console.warn("Cannot add item to folder: folder_id column doesn't exist yet");
      return null;
    }

    // At least one of sectionId or effectiveFolderId must be provided
    if (!sectionId && !(effectiveFolderId && hasFolderColumn)) return null;

    try {
      // Get max position for the current context
      const positionQuery = supabase
        .from('items')
        .select('position')
        .order('position', { ascending: false })
        .limit(1);
      
      if (sectionId && !effectiveFolderId) {
        positionQuery.eq('section_id', sectionId);
      } else if (effectiveFolderId && hasFolderColumn) {
        positionQuery.eq('folder_id', effectiveFolderId);
      }
      
      const { data: existingItems } = await positionQuery;
      const position = (existingItems?.[0]?.position ?? -1) + 1;

      // Create insert data
      const insertData: any = {
        title,
        position,
        user_id: userId
      };
      
      if (sectionId && !effectiveFolderId) {
        insertData.section_id = sectionId;
      } else if (effectiveFolderId && hasFolderColumn) {
        insertData.folder_id = effectiveFolderId;
      }

      const { data: newItem, error } = await supabase
        .from('items')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      
      // Create a default note for the new item
      const { data: newNote, error: noteError } = await supabase
        .from('notes')
        .insert({
          item_id: newItem.id,
          title: 'New Note',
          content: '',
          user_id: userId
        })
        .select()
        .single();
        
      if (noteError) throw noteError;

      await refresh();
      
      // Return the new item with its note
      return {
        id: newItem.id,
        title: newItem.title,
        notes: [{
          id: newNote.id,
          title: newNote.title,
          content: newNote.content,
          tags: [],
          lastModified: new Date(newNote.updated_at || newNote.created_at)
        }]
      };
    } catch (error) {
      handleError(error as Error);
      return null;
    }
  };

  const updateItem = async (itemId: string, title: string) => {
    try {
      const { error } = await supabase
        .from('items')
        .update({ title })
        .eq('id', itemId);

      if (error) throw error;
      await refresh();
      return true;
    } catch (error) {
      handleError(error as Error);
      return false;
    }
  };

  const moveToFolder = async (itemId: string, targetFolderId: string | null) => {
    if (!hasFolderColumn) {
      console.warn("Cannot move to folder: folder_id column doesn't exist yet");
      return false;
    }

    try {
      const updateData: any = { folder_id: targetFolderId };
      
      // Clear other parent fields when moving to a folder
      if (targetFolderId) {
        updateData.section_id = null;
        updateData.subsection_id = null;
        updateData.group_id = null;
      }
      
      const { error } = await supabase
        .from('items')
        .update(updateData)
        .eq('id', itemId);

      if (error) throw error;
      await refresh();
      return true;
    } catch (error) {
      handleError(error as Error);
      return false;
    }
  };

  const deleteItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      await refresh();
      return true;
    } catch (error) {
      handleError(error as Error);
      return false;
    }
  };

  const reorderItems = async (reorderedItems: Item[]) => {
    try {
      await Promise.all(
        reorderedItems.map((item, index) =>
          supabase
            .from('items')
            .update({ position: index })
            .eq('id', item.id)
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
    if (hasFolderColumn !== null) {
      refresh();
    }

    // Set up a subscription to refresh when items change in the database
    const channel = supabase
      .channel('item_changes') // Unique channel name
      .on(
        'postgres_changes',
        { 
          event: '*', // Listen to all events: INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'items' 
        },
        (payload) => {
          console.log('Change received for items table!', payload);
          refresh(); // Re-fetch items
        }
      )
      .subscribe();

    // Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sectionId, folderId, hasFolderColumn]); // Dependencies for initial refresh and subscription setup

  return {
    items,
    loading,
    refresh,
    addItem,
    updateItem,
    deleteItem,
    moveToFolder,
    reorderItems,
    hasFolderColumn
  };
}