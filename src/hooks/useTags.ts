import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../utils/error';

interface Tag {
  id: string;
  name: string;
  noteCount: number;
}

export function useTags(userId: string) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    // Don't attempt to fetch if there's no userId
    if (!userId) {
      setTags([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tags')
        .select(`
          id,
          name,
          note_tags (
            note_id
          )
        `)
        .eq('user_id', userId)
        .order('name');

      if (error) throw error;

      const processedTags = data?.map(tag => ({
        id: tag.id,
        name: tag.name,
        noteCount: tag.note_tags?.length || 0
      })) || [];

      setTags(processedTags);
    } catch (error) {
      handleError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [userId]);

  const addTag = async (name: string) => {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({
          name,
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

  const addTagToNote = async (noteId: string, tagId: string) => {
    if (!userId) return false;

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
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from('note_tags')
        .delete()
        .match({ note_id: noteId, tag_id: tagId });

      if (error) throw error;
      await refresh();
      return true;
    } catch (error) {
      handleError(error as Error);
      return false;
    }
  };

  return {
    tags,
    loading,
    addTag,
    addTagToNote,
    removeTagFromNote,
    refresh
  };
}