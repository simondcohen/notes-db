import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../utils/error';
import type { Section, Item } from '../types';

export function useSections(notebookId?: string, folderId?: string) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFolderColumn, setHasFolderColumn] = useState<boolean | null>(null);

  // Check if folder_id column exists in sections table
  const checkFolderColumnExists = async () => {
    try {
      // Try to fetch a section with a folder_id check to see if the column exists
      await supabase
        .from('sections')
        .select('id')
        .is('folder_id', null)
        .limit(1);
      
      setHasFolderColumn(true);
    } catch (error) {
      // If this errors, the folder_id column doesn't exist yet
      console.log("folder_id column doesn't exist yet");
      setHasFolderColumn(false);
    }
  };

  useEffect(() => {
    checkFolderColumnExists();
  }, []);

  const refresh = async () => {
    if (!notebookId) {
      setSections([]);
      return;
    }
    
    try {
      setLoading(true);
      let query = supabase
        .from('sections')
        .select('id, title, position, folder_id, items ( id, title, position )')
        .eq('notebook_id', notebookId);
      
      // The folderId parameter to the hook will no longer filter the main list of sections.
      // SectionsColumn will handle displaying the hierarchy.
      // We retain the folderId parameter for the hook as addSection uses it.

      console.log(`Fetching all sections for notebook: ${notebookId}`);

      const { data, error } = await query.order('position', { ascending: true });

      if (error) throw error;

      console.log(`Loaded ${data?.length || 0} sections for notebook ${notebookId}`);
      if (data && data.length > 0) {
        console.log("Section data:", data);
      }

      const processedSections = data?.map(section => ({
        id: section.id,
        title: section.title,
        folderId: section.folder_id,
        items: (section.items || []).map(item => ({
          id: item.id,
          title: item.title,
          notes: []
        } as Item)),
        groups: [],
        subsections: []
      })) as Section[];

      setSections(processedSections);
    } catch (error) {
      console.error('Error loading sections:', error);
      handleError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  const addSection = async (userId: string, title: string = 'New Section', specificFolderId?: string) => {
    if (!notebookId) return null;

    // Use the specific folder ID if provided, otherwise use the hook-level folder ID
    const effectiveFolderId = specificFolderId || folderId;
    console.log("Adding section with effective folder ID:", effectiveFolderId);

    try {
      // Get max position for current folder context
      const positionQuery = supabase
        .from('sections')
        .select('position')
        .order('position', { ascending: false })
        .limit(1);
      
      if (hasFolderColumn) {
        if (effectiveFolderId) {
          console.log("Using folder_id for position query:", effectiveFolderId);
          positionQuery.eq('folder_id', effectiveFolderId);
        } else {
          console.log("Using notebook root level for position query:", notebookId);
          positionQuery.eq('notebook_id', notebookId).is('folder_id', null);
        }
      } else {
        positionQuery.eq('notebook_id', notebookId);
      }
      
      const { data: existingSections } = await positionQuery;
      const position = (existingSections?.[0]?.position ?? -1) + 1;
      console.log("New section position:", position);

      // Generate a unique title if creating in a folder to avoid slug conflicts
      let sectionTitle = title;
      if (effectiveFolderId && title === 'New Section') {
        // Add a timestamp to make the title unique
        sectionTitle = `${title} ${new Date().getTime().toString().slice(-4)}`;
      }

      // Get parent folder info if we're dealing with a subfolder
      let parentNotebookId = notebookId;
      if (effectiveFolderId) {
        // Check if this is a subfolder by getting its parent_folder_id
        const { data: folderData } = await supabase
          .from('folders')
          .select('notebook_id, parent_folder_id')
          .eq('id', effectiveFolderId)
          .single();
          
        if (folderData) {
          // If folder has notebook_id, use that; otherwise use the hook's notebookId
          parentNotebookId = folderData.notebook_id || notebookId;
          console.log("Using parent notebook ID for section:", parentNotebookId);
        }
      }

      // Create insert data
      const insertData: any = {
        notebook_id: parentNotebookId,
        title: sectionTitle,
        position,
        user_id: userId
      };
      
      // Add folder_id if provided and the column exists
      if (effectiveFolderId && hasFolderColumn) {
        console.log("Setting folder_id in insert data:", effectiveFolderId);
        insertData.folder_id = effectiveFolderId;
      }

      console.log("Inserting section with data:", insertData);
      const { data, error } = await supabase
        .from('sections')
        .insert(insertData)
        .select();

      if (error) {
        console.error("Error inserting section:", error);
        // If we get a duplicate key error, retry with a more unique title
        if (error.code === '23505') {
          console.log("Duplicate key error, retrying with more unique title");
          const retryTitle = `${title} ${Math.random().toString(36).substring(2, 7)}`;
          insertData.title = retryTitle;
          
          const { error: retryError } = await supabase
            .from('sections')
            .insert(insertData);
            
          if (retryError) {
            console.error("Retry also failed:", retryError);
            throw retryError;
          }
        } else {
          throw error;
        }
      } else {
        console.log("Section created successfully:", data);
      }
      
      await refresh();
      return true;
    } catch (error) {
      console.error("Complete error in addSection:", error);
      handleError(error as Error);
      return false;
    }
  };

  const updateSection = async (sectionId: string, title: string) => {
    try {
      const { error } = await supabase
        .from('sections')
        .update({ title })
        .eq('id', sectionId);

      if (error) throw error;
      await refresh();
      return true;
    } catch (error) {
      handleError(error as Error);
      return false;
    }
  };

  const deleteSection = async (sectionId: string) => {
    try {
      const { error } = await supabase
        .from('sections')
        .delete()
        .eq('id', sectionId);

      if (error) throw error;
      await refresh();
      return true;
    } catch (error) {
      handleError(error as Error);
      return false;
    }
  };

  const moveToFolder = async (sectionId: string, targetFolderId: string | null) => {
    if (!hasFolderColumn) {
      console.warn("Cannot move to folder: folder_id column doesn't exist yet");
      return false;
    }
    
    try {
      const { error } = await supabase
        .from('sections')
        .update({ folder_id: targetFolderId })
        .eq('id', sectionId);

      if (error) throw error;
      await refresh();
      return true;
    } catch (error) {
      handleError(error as Error);
      return false;
    }
  };

  const reorderSections = async (reorderedSections: Section[]) => {
    try {
      await Promise.all(
        reorderedSections.map((section, index) =>
          supabase
            .from('sections')
            .update({ position: index })
            .eq('id', section.id)
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
      console.log("useSections: refreshing with notebookId:", notebookId, "(folderId parameter is no longer used for filtering main list)");
      refresh();
    }
  }, [notebookId, hasFolderColumn]); // Remove folderId from dependencies for refresh, as it doesn't filter the list anymore

  // Monitor selectedFolder changes (folderId prop of the hook)
  useEffect(() => {
    if (folderId) {
      console.log("useSections: folder ID changed to:", folderId);
    }
  }, [folderId]);

  return {
    sections,
    loading,
    refresh,
    addSection,
    updateSection,
    deleteSection,
    moveToFolder,
    reorderSections,
    hasFolderColumn
  };
}