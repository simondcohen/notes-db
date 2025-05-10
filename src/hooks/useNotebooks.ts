import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../utils/error';
import type { Notebook } from '../types';

export function useNotebooks(userId: string) {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('notebooks')
        .select('id, title, last_modified')
        .eq('user_id', userId)
        .order('last_modified', { ascending: false });

      if (error) throw error;

      // Convert database records to Notebook objects with proper date handling
      const formattedNotebooks = (data || []).map(notebook => ({
        id: notebook.id,
        title: notebook.title,
        sections: [],
        folders: [],
        lastModified: notebook.last_modified ? new Date(notebook.last_modified) : new Date()
      }));

      setNotebooks(formattedNotebooks);
    } catch (error) {
      const message = (error as Error).message;
      console.error('Error loading notebooks:', message);
      setError(message);
      setNotebooks([]);
    } finally {
      setLoading(false);
    }
  };

  const addNotebook = async (title: string) => {
    try {
      const { data, error } = await supabase
        .from('notebooks')
        .insert({
          title,
          user_id: userId,
        })
        .select('id');

      if (error) throw error;
      
      const newNotebookId = data?.[0]?.id;
      await refresh();
      return newNotebookId;
    } catch (error) {
      handleError(error as Error);
      return null;
    }
  };

  const updateNotebook = async (notebookId: string, title: string) => {
    try {
      const { error } = await supabase
        .from('notebooks')
        .update({ 
          title,
          last_modified: new Date().toISOString()
        })
        .eq('id', notebookId);

      if (error) throw error;
      await refresh();
      return true;
    } catch (error) {
      handleError(error as Error);
      return false;
    }
  };

  const deleteNotebook = async (notebookId: string) => {
    try {
      const { error } = await supabase
        .from('notebooks')
        .delete()
        .eq('id', notebookId);

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
  }, [userId]);

  return {
    notebooks,
    loading,
    error,
    refresh,
    addNotebook,
    updateNotebook,
    deleteNotebook
  };
}