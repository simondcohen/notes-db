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
    // 1. Skip server work if nothing changed
    const current = notes.find(n => n.id === noteId);
    if (!current) throw new Error('Note not found (local)');
    if (
      updates.title  === current.title &&
      updates.content === current.content
    ) return true;

    try {
      /* ---------- ONE request to notes --------------- */
      // – updates the row
      // – returns item_id so we can chase the hierarchy
      const { data: noteRow, error: noteErr } = await supabase
        .from('notes')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', noteId)
        .select('item_id')
        .single();
      if (noteErr) throw noteErr;

      /* ---------- Second request: item → section_id ---- */
      const { data: itemRow, error: itemErr } = await supabase
        .from('items')
        .select('section_id')
        .eq('id', noteRow.item_id)
        .single();
      if (itemErr) throw itemErr;

      /* ---------- Third request: section → notebook_id -- */
      const { data: sectRow, error: sectErr } = await supabase
        .from('sections')
        .select('notebook_id')
        .eq('id', itemRow.section_id)
        .single();
      if (sectErr) throw sectErr;

      /* ---------- Final request: bump notebook timestamp - */
      await supabase
        .from('notebooks')
        .update({ last_modified: new Date().toISOString() })
        .eq('id', sectRow.notebook_id);

      /* ---------- Optimistic UI ------------------------ */
      setNotes(prev =>
        prev.map(n => (n.id === noteId ? { ...n, ...updates } : n))
      );
      return true;
    } catch (err) {
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