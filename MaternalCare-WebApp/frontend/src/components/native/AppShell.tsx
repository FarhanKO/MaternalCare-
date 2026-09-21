/**
 * What the app does differently from the site, in two small pieces.
 *
 * Both are mounted only when lib/native says this is the app; in a browser
 * neither exists.
 */
import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { useAuth } from '@/lib/auth';
import { onReminderTap } from '@/lib/localReminders';

/**
 * Where the app opens.
 *
 * The site opens on its landing page; the app has nothing to sell and opens
 * on her portal — or the sign-in screen, when there is no one to open it for.
 * Nothing is rendered while the session is still being checked, for the same
 * reason RequireAuth renders nothing: the alternative is a flash of the
 * wrong screen.
 */
export function AppHome() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/signin" replace />;
  return <Navigate to={user.role === 'mother' ? '/mother' : '/doctor'} replace />;
}

/* the screens the app opens on; from these, back means "close the app" */
const ROOTS = new Set(['/', '/signin', '/mother', '/doctor']);

/**
 * The hardware back button.
 *
 * Android hands it to the app rather than the WebView, so without this it
 * closes the app from any screen. Inside the app it goes back a page, as a
 * browser would; on the screens the app opens on, it closes the app, which
 * is what every other app on the phone does.
 */
export function BackButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // a tapped reminder notification opens the reminders tab
  useEffect(() => onReminderTap((url) => navigate(url)), [navigate]);

  useEffect(() => {
    const handle = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (ROOTS.has(pathname) || !canGoBack) void CapacitorApp.exitApp();
      else navigate(-1);
    });
    return () => { void handle.then((h) => h.remove()); };
  }, [pathname, navigate]);

  return null;
}
