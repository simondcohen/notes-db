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
import { ToastProvider } from './components/ui/Toast';

function RouteStateManager() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('lastPath', location.pathname + location.search);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const lastPath = localStorage.getItem('lastPath');
    if (location.pathname === '/' && lastPath && lastPath !== '/') {
      navigate(lastPath, { replace: true });
    }
  }, []);

  return null;
}

function MainApp({ session }: { session: Session }) {
  const location = useLocation();
  const noteToOpen = location.state?.noteToOpen;

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
        <RouteStateManager />
        <Routes>
          <Route path="/tag/:tagName" element={<TagNotesView />} />
          <Route path="/tags" element={<AllTagsView />} />
          <Route path="/nb/:notebookId/*" element={<MainApp session={session} />} />
          <Route path="/*" element={<MainApp session={session} />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}