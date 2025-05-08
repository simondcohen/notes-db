import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { ResetPassword } from './components/ResetPassword';
import { LoadingSpinner } from './components/LoadingSpinner';
import AppUI from './AppUI';
import { TagNotesView } from './views/TagNotesView';
import { AllTagsView } from './views/AllTagsView';
import { NotebookSelectionView } from './views/NotebookSelectionView';
import { ToastProvider } from './components/ui/Toast';
import { useNotebooks } from './hooks/useNotebooks';
import { Toaster } from "react-hot-toast";

function RouteStateManager() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Save current path to localStorage
    localStorage.setItem('lastPath', location.pathname + location.search);
  }, [location.pathname, location.search]);

  // Remove the comment to enable auto-redirection (now handled elsewhere)
  return null;
}

function NotebookRouter({ session }: { session: Session }) {
  const location = useLocation();
  const navigate = useNavigate();
  const noteToOpen = location.state?.noteToOpen;
  
  const {
    notebooks,
    loading: notebooksLoading,
    addNotebook,
    refresh: refreshNotebooks
  } = useNotebooks(session.user.id);

  const handleCreateNotebook = async () => {
    try {
      const success = await addNotebook('New Notebook');
      if (success && notebooks && notebooks.length > 0) {
        // After creating a notebook, refresh and get the latest notebook (which should be the one we just created)
        await refreshNotebooks();
        const latestNotebook = notebooks[0]; // Assuming notebooks are ordered by last_modified desc
        return latestNotebook?.id || '';
      }
      return '';
    } catch (error) {
      console.error('Error creating notebook:', error);
      return '';
    }
  };

  // In the main router view, we'll check the path
  // If we have a notebookId, we'll render the AppUI
  // Otherwise, we'll render the notebook selection view
  const { notebookId } = useParams<{notebookId?: string}>();
  
  // If we're at the root path but have a note to open, navigate to the notebook
  if (location.pathname === '/' && noteToOpen) {
    return <Navigate to={`/nb/${noteToOpen.notebookId}`} state={{ noteToOpen }} replace />;
  }
  
  // If we're at the root with no notebookId, try to use last saved path first
  if (location.pathname === '/') {
    const lastPath = localStorage.getItem('lastPath');
    // If we have a last path that's not the root and not just a notebook selection path
    if (lastPath && lastPath !== '/' && !lastPath.startsWith('/?') && lastPath.includes('/nb/')) {
      return <Navigate to={lastPath} replace />;
    }
    
    // Otherwise show the notebook selection
    return (
      <NotebookSelectionView 
        notebooks={notebooks || []} 
        loading={notebooksLoading} 
        onCreateNotebook={handleCreateNotebook} 
      />
    );
  }

  // Otherwise render the AppUI with the notebook
  return <AppUI session={session} initialNote={noteToOpen} />;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (error) console.error('getSession error', error);
        setSession(session);
      })
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setNeedsNewPassword(true);
      }
      setSession(session);
    });

    return () => subscription?.unsubscribe();
  }, []);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (needsNewPassword && session) {
    return <ResetPassword onComplete={() => setNeedsNewPassword(false)} />;
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Toaster position="top-right" gutter={8} />
        <RouteStateManager />
        <Routes>
          <Route path="/tag/:tagName" element={<TagNotesView />} />
          <Route path="/tags" element={<AllTagsView />} />
          <Route path="/nb/:notebookId/*" element={<NotebookRouter session={session} />} />
          <Route path="/*" element={<NotebookRouter session={session} />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}