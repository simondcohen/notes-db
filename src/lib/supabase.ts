import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing environment variables, please configure .env');
}

// Custom storage implementation with better error handling and validation
const customStorage = {
  getItem: (key: string) => {
    try {
      const value = localStorage.getItem(key);
      if (!value) return null;
      
      // Validate JSON structure before returning
      const parsed = JSON.parse(value);
      if (!parsed) return null;
      
      return parsed;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      // Clear invalid data
      localStorage.removeItem(key);
      return null;
    }
  },
  setItem: (key: string, value: any) => {
    try {
      // Validate value before storing
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
        return;
      }
      
      const stringValue = JSON.stringify(value);
      localStorage.setItem(key, stringValue);
    } catch (error) {
      console.error('Error writing to localStorage:', error);
      // Attempt to clean up on error
      try {
        localStorage.removeItem(key);
      } catch (cleanupError) {
        console.error('Error cleaning up localStorage:', cleanupError);
      }
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  }
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: customStorage
  }
});

export async function fetchNotebooks(userId: string) {
  try {
    const { data: notebooks, error } = await supabase
      .from('notebooks')
      .select(`
        id,
        title,
        last_modified,
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

    if (error) throw error;

    return notebooks?.map(notebook => ({
      ...notebook,
      sections: notebook.sections?.map(section => ({
        ...section,
        items: section.items || [],
        groups: section.groups?.map(group => ({
          ...group,
          items: group.items || []
        })) || [],
        subsections: section.subsections?.map(subsection => ({
          ...subsection,
          items: subsection.items || [],
          groups: subsection.groups?.map(group => ({
            ...group,
            items: group.items || []
          })) || []
        })) || []
      })) || []
    })) || [];
  } catch (error) {
    console.error('Error fetching notebooks:', error);
    throw error;
  }
}