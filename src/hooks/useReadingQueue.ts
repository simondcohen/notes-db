import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useReadingQueue(userId: string) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!userId) {
      setCount(0);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notes')
        .select(`
          id,
          tags!note_tags!inner (
            id,
            name
          )
        `)
        .eq('tags.name', 'to-read');

      if (error) throw error;
      setCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching reading queue:', error);
      setCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [userId]);

  return { count, loading, refresh };
}