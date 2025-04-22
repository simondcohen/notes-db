import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../utils/error';
import type { Note, Tag } from '../types';

interface NoteWithContext extends Note {
  notebookId: string;
  sectionId: string;
  subsectionId?: string;
  itemId: string;
  tags: Tag[];
}

export function useNotesByTag(tagName: string) {
  const [notes, setNotes] = useState<NoteWithContext[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchNotes = async () => {
      if (!tagName) return;

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
            item_id,
            items!inner (
              id,
              section_id,
              subsection_id,
              group_id,
              sections!inner (
                id,
                notebook_id
              )
            ),
            tags!note_tags!inner (
              id,
              name
            )
          `)
          .eq('tags.name', tagName)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        const processedNotes = data.map(note => ({
          id: note.id,
          title: note.title,
          content: note.content,
          notebookId: note.items.sections.notebook_id,
          sectionId: note.items.section_id,
          subsectionId: note.items.subsection_id,
          itemId: note.items.id,
          tags: note.tags.map((tag: Tag) => ({
            id: tag.id,
            name: tag.name
          })),
          lastModified: new Date(note.updated_at)
        }));

        setNotes(processedNotes);
      } catch (error) {
        handleError(error as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [tagName]);

  return { notes, loading };
}