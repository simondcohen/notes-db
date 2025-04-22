import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../utils/error';
import type { Item } from '../types';

export function useItems(sectionId?: string) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!sectionId) {
      setItems([]);
      return;
    }
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('items')
        .select('id, title, position')
        .eq('section_id', sectionId)
        .order('position', { ascending: true });

      if (error) throw error;
      setItems(data?.map(item => ({ ...item, notes: [] })) || []);
    } catch (error) {
      console.error('Error loading items:', error);
      handleError(error as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [sectionId]);

  const addItem = async (title: string) => {
    if (!sectionId) return null;
    
    try {
      const { data: existingItems } = await supabase
        .from('items')
        .select('position')
        .eq('section_id', sectionId)
        .order('position', { ascending: false })
        .limit(1);

      const position = (existingItems?.[0]?.position ?? -1) + 1;

      const { data: newItem, error: itemError } = await supabase
        .from('items')
        .insert({
          title,
          section_id: sectionId,
          position
        })
        .select()
        .single();

      if (itemError) throw itemError;

      // Create a default note for the new item
      const { data: newNote, error: noteError } = await supabase
        .from('notes')
        .insert({
          item_id: newItem.id,
          title: 'New Note',
          content: ''
        })
        .select()
        .single();

      if (noteError) throw noteError;

      await refresh();
      return { ...newItem, notes: [newNote] };
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

  return {
    items,
    loading,
    refresh,
    addItem,
    updateItem,
    deleteItem,
    reorderItems
  };
}