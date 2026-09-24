import { ShieldCheck, Smartphone, type LucideIcon } from 'lucide-react';
import { apiOrigin } from '@/data/sos';

/**
 * The two Android apps, as the website offers them for download (the
 * navbar's "Get the app" menu and the footer).
 *
 * The APKs are files in public/downloads, served by the API server. The link
 * uses apiOrigin() rather than a relative path: in development the page is on
 * Vite's :5173, which has no /downloads and would hand back index.html named
 * ".apk". In a deployment both are the same origin.
 */
export interface AndroidApp {
  icon: LucideIcon;
  label: string;
  note: string;
  file: string;
}

export const ANDROID_APPS: AndroidApp[] = [
  { icon: Smartphone, label: 'MaternalCare+', note: 'For mothers & clinicians', file: 'maternalcare.apk' },
  { icon: ShieldCheck, label: 'Guardian', note: 'For the people she trusts', file: 'guardian.apk' },
];

export const appDownloadUrl = (a: AndroidApp) => `${apiOrigin()}/downloads/${a.file}`;
