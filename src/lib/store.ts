import { create } from 'zustand';
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';
import type { AppState } from '../types';

interface Store extends AppState {
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  initialize: () => Promise<void>;
  loadNotebooks: (userId: string) => Promise<void>;
  reset: () => void;
}

export const useStore = create<Store>((set, get) => ({
  session: null,
  loading: true,
  initialized: false,
  error: null,
  notebooks: [],
  selectedNotebook: undefined,
  selectedSection: undefined,
  selectedSubsection: undefined,
  selectedItem: undefined,
  selectedNote: undefined,
  lastSaved: undefined,

  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Supabase getSession error:', error);
        set({ error: error.message });
      } else {
        console.log('Got session:', session);
        set({ session });
        if (session?.user?.id) {
          await get().loadNotebooks(session.user.id);
        }
      }
    } catch (err) {
      console.error('Unexpected initialize error:', err);
      set({ error: (err as Error).message });
    }
    // **Always finish**:
    set({ initialized: true, loading: false });
    console.log('✔️ initialize complete:', {
      initialized: get().initialized,
      loading: get().loading,
      session: get().session,
    });
  },

  loadNotebooks: async (userId) => {
    try {
      set({ loading: true, error: null });

      const notebooks = await supabase
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

      if (notebooks.error) throw notebooks.error;

      const processedNotebooks = notebooks.data?.map(notebook => ({
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

      set({
        notebooks: processedNotebooks,
        selectedNotebook: processedNotebooks[0]?.id,
        error: null
      });
    } catch (error) {
      console.error('Error loading notebooks:', error);
      set({ 
        notebooks: [], 
        selectedNotebook: undefined,
        error: (error as Error).message 
      });
    } finally {
      set({ loading: false });
    }
  },

  reset: () => set({
    notebooks: [],
    selectedNotebook: undefined,
    selectedSection: undefined,
    selectedSubsection: undefined,
    selectedItem: undefined,
    selectedNote: undefined,
    lastSaved: undefined,
    error: null
  }),
}));