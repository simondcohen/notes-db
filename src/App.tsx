import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import AppUI from './AppUI';
import { TagNotesView } from './views/TagNotesView';
import { AllTagsView } from './views/AllTagsView';
import { NotebookSelectionView } from './views/NotebookSelectionView';
import { ToastProvider } from './components/ui/Toast';
import { useNotebooks } from './hooks/useNotebooks';
import { Toaster } from "react-hot-toast";

function RouteStateManager() {
  const location = useLocation();
  useEffect(() => {
    // Save current path to localStorage
    localStorage.setItem('lastPath', location.pathname + location.search);
  }, [location.pathname, location.search]);

  // Remove the comment to enable auto-redirection (now handled elsewhere)
  return null;
}

const USER_ID = 'local-user';

function NotebookRouter() {
  const location = useLocation();
  const navigate = useNavigate();
  const noteToOpen = location.state?.noteToOpen;
  
  const {
    notebooks,
    loading: notebooksLoading,
    addNotebook,
    refresh: refreshNotebooks
  } = useNotebooks(USER_ID);

  const handleCreateNotebook = async () => {
    try {
      const newNotebookId = await addNotebook('New Notebook');
      if (newNotebookId) {
        navigate(`/nb/${newNotebookId}`);
        return newNotebookId;
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
  const mockSession = { user: { id: USER_ID } } as any;
  return <AppUI session={mockSession} initialNote={noteToOpen} />;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Toaster position="top-right" gutter={8} />
        <RouteStateManager />
        <Routes>
          <Route path="/tag/:tagName" element={<TagNotesView />} />
          <Route path="/tags" element={<AllTagsView />} />
          <Route path="/nb/:notebookId/*" element={<NotebookRouter />} />
          <Route path="/*" element={<NotebookRouter />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}