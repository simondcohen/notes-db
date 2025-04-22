import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../utils/error';
import type { Section } from '../types';

export function useSections(notebookId?: string) {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!notebookId) {
      setSections([]);
      return;
    }
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sections')
        .select('id, title, position, items ( id, title, position )')
        .eq('notebook_id', notebookId)
        .order('position', { ascending: true });

      if (error) throw error;

      const processedSections = data?.map(section => ({
        ...section,
        items: section.items || [],
        groups: [],
        subsections: []
      })) || [];

      setSections(processedSections);
    } catch (error) {
      console.error('Error loading sections:', error);
      handleError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  const addSection = async (userId: string) => {
    if (!notebookId) return null;

    try {
      const { data: existingSections } = await supabase
        .from('sections')
        .select('position')
        .eq('notebook_id', notebookId)
        .order('position', { ascending: false })
        .limit(1);

      const position = (existingSections?.[0]?.position ?? -1) + 1;

      const { error } = await supabase
        .from('sections')
        .insert({
          notebook_id: notebookId,
          title: 'New Section',
          position,
          user_id: userId
        });

      if (error) throw error;
      await refresh();
      return true;
    } catch (error) {
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
    refresh();
  }, [notebookId]);

  return {
    sections,
    loading,
    refresh,
    addSection,
    updateSection,
    deleteSection,
    reorderSections
  };
}