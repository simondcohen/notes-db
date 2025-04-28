import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../utils/error';
import type { Note } from '../types';

export function useNotes(itemId?: string) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!itemId) {
      setNotes([]);
      return;
    }
    
    try {
      setLoading(true);
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
        .eq('item_id', itemId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const notesWithTags = data?.map(note => ({
        ...note,
        tags: note.tags?.map(tag => ({
          id: tag.id,
          name: tag.name
        })) || [],
        lastModified: new Date(note.updated_at)
      })) || [];

      setNotes(notesWithTags);
    } catch (error) {
      console.error('Error loading notes:', error);
      handleError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  const addNote = async (title: string) => {
    if (!itemId) return null;
    
    try {
      // Get the current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('User must be authenticated to create notes');
      const userId = session.user.id;

      const { data, error } = await supabase
        .from('notes')
        .insert({
          item_id: itemId,
          title,
          content: '',
          user_id: userId
        })
        .select()
        .single();

      if (error) throw error;
      await refresh();
      return data;
    } catch (error) {
      handleError(error as Error);
      return null;
    }
  };

  const updateNote = async (
    noteId: string,
    updates: Partial<{ title: string; content: string }>
  ) => {
    /* ---------- optimistic UI first ---------- */
    setNotes(prev =>
      prev.map(n => (n.id === noteId ? { ...n, ...updates, lastModified: new Date() } : n))
    );

    try {
      /* ---------- 1. update the note + get item_id ---------- */
      const { data: noteRow, error: noteErr } = await supabase
        .from('notes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', noteId)
        .select('item_id')
        .single();
      if (noteErr) throw noteErr;

      /* ---------- 2. item → section_id (may be missing) ----- */
      const { data: itemRow } = await supabase
        .from('items')
        .select('section_id')
        .eq('id', noteRow.item_id)
        .maybeSingle();           // returns null if item was deleted

      /* ---------- 3. section → notebook_id (may be missing) - */
      if (itemRow?.section_id) {
        const { data: sectionRow } = await supabase
          .from('sections')
          .select('notebook_id')
          .eq('id', itemRow.section_id)
          .maybeSingle();

        /* ---------- 4. bump notebook timestamp -------------- */
        if (sectionRow?.notebook_id) {
          await supabase
            .from('notebooks')
            .update({ last_modified: new Date().toISOString() })
            .eq('id', sectionRow.notebook_id);
        }
      }

      return true;                // success
    } catch (err) {
      console.error('Error saving note:', err);
      await refresh();            // rollback optimistic UI with fresh data
      handleError(err as Error);
      return false;
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      await refresh();
      return true;
    } catch (error) {
      handleError(error as Error);
      return false;
    }
  };

  const addTagToNote = async (noteId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from('note_tags')
        .insert({ note_id: noteId, tag_id: tagId });

      if (error) throw error;
      await refresh();
      return true;
    } catch (error) {
      handleError(error as Error);
      return false;
    }
  };

  const removeTagFromNote = async (noteId: string, tagId: string) => {
    try {
      const { error } = await supabase
        .from('note_tags')
        .delete()
        .eq('note_id', noteId)
        .eq('tag_id', tagId);

      if (error) throw error;
      await refresh();
      return true;
    } catch (error) {
      handleError(error as Error);
      return false;
    }
  };

  useEffect(() => {
    refresh();
  }, [itemId]);

  return {
    notes,
    loading,
    refresh,
    addNote,
    updateNote,
    deleteNote,
    addTagToNote,
    removeTagFromNote
  };
}