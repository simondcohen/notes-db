import { supabase } from '../lib/supabase';
import type { Notebook } from '../types';

export async function exportData(userId: string, notebookId?: string) {
  try {
    const query = supabase
      .from('notebooks')
      .select(`
        id,
        title,
        sections (
          id,
          title,
          position,
          items (
            id,
            title,
            position,
            notes (
              id,
              title,
              content
            )
          ),
          groups (
            id,
            title,
            position,
            items (
              id,
              title,
              position,
              notes (
                id,
                title,
                content
              )
            )
          ),
          subsections (
            id,
            title,
            position,
            items (
              id,
              title,
              position,
              notes (
                id,
                title,
                content
              )
            ),
            groups (
              id,
              title,
              position,
              items (
                id,
                title,
                position,
                notes (
                  id,
                  title,
                  content
                )
              )
            )
          )
        )
      `)
      .eq('user_id', userId)
      .order('last_modified', { ascending: false });

    if (notebookId) {
      query.eq('id', notebookId);
    }

    const { data: notebooks, error } = await query;

    if (error) throw error;

    // Create a Blob containing the data
    const blob = new Blob([JSON.stringify({ notebooks }, null, 2)], {
      type: 'application/json',
    });

    // Create a download link and trigger the download
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = notebookId 
      ? `notebook_${notebooks[0]?.title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`
      : `notes_export_${new Date().toISOString().split('T')[0]}.json`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}