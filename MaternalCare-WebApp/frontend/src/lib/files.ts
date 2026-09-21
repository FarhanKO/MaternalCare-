/**
 * Files the API serves behind the session — documents, chat photos,
 * vaccination cards, her avatar — and files the app produces for her to keep:
 * the health report, the account export.
 *
 * In a browser both are simple: an <img> or <object> pointed at the URL
 * carries the session cookie by itself, and a download is an <a download>.
 * Neither works in the app. Its session is a bearer header, which a tag
 * cannot send (only fetch can), and the WebView ignores <a download>
 * outright. So here:
 *
 *   resolveFileUrl / useFileUrl fetch the bytes through the API layer, with
 *   the header, and hand back an object URL for the tag. Fetched once per
 *   path and kept for the session — a thumbnail list re-renders far more
 *   often than its files change.
 *
 *   saveBlob writes the file to the app's cache and opens Android's share
 *   sheet, which is how a phone "downloads": she picks Files, Drive, a PDF
 *   viewer, a message to her partner.
 *
 * Both are plain URLs and plain downloads on the web, so callers never
 * branch on the platform themselves.
 */
import { useEffect, useState } from 'react';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { fileUrl, send } from '@/lib/api';
import { isNative } from '@/lib/native';

/* --------------------------------------------------------- reading */

const cache = new Map<string, Promise<string>>();

/*
 * The server names files by their full path ("/api/documents/12/file");
 * send() already starts from the API base, so the prefix comes off here.
 */
const apiPath = (path: string) => path.replace(/^\/api(?=\/)/, '');

/** A URL a tag can load `path` from: the API URL in a browser, an object URL in the app. */
export function resolveFileUrl(path: string): Promise<string> {
  if (!isNative) return Promise.resolve(fileUrl(path));
  let hit = cache.get(path);
  if (!hit) {
    hit = send(apiPath(path)).then(async (res) => {
      if (!res.ok) throw new Error(`${path} answered ${res.status}`);
      return URL.createObjectURL(await res.blob());
    });
    // a failure is not kept: the next render tries again
    hit.catch(() => cache.delete(path));
    cache.set(path, hit);
  }
  return hit;
}

/**
 * The same, as a hook. `url` is null until the bytes are in (immediately on
 * the web); `failed` is set for a path that could not be fetched — the
 * tag's own onError never fires for a src that was never set, so a caller
 * that shows "could not be displayed" needs telling another way.
 */
export function useFile(path: string | null | undefined): { url: string | null; failed: boolean } {
  // what the last fetch produced, remembered with the path it was for
  const [loaded, setLoaded] = useState<{ path: string; url: string | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (!isNative || !path) return;
    let live = true;
    resolveFileUrl(path)
      .then((url) => { if (live) setLoaded({ path, url, failed: false }); })
      .catch(() => { if (live) setLoaded({ path, url: null, failed: true }); });
    return () => { live = false; };
  }, [path]);

  if (!path) return { url: null, failed: false };
  if (!isNative) return { url: fileUrl(path), failed: false };
  return loaded && loaded.path === path
    ? { url: loaded.url, failed: loaded.failed }
    : { url: null, failed: false };
}

export const useFileUrl = (path: string | null | undefined) => useFile(path).url;

/* ---------------------------------------------------------- saving */

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.readAsDataURL(blob);
  });
}

/**
 * Give her the file.
 *
 * A browser downloads it. The app writes it to its own cache and opens the
 * share sheet with it — the closest thing a phone has to "save as", and the
 * one that also covers "open in a PDF viewer" and "send to my partner".
 */
export async function saveBlob(blob: Blob, filename: string, title = filename): Promise<void> {
  if (!isNative) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // revoked on the next tick so the download has taken the reference
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const written = await Filesystem.writeFile({
    path: filename,
    data: await toBase64(blob),
    directory: Directory.Cache,
  });
  try {
    await Share.share({ title, url: written.uri, dialogTitle: title });
  } catch (err) {
    // closing the sheet without choosing is not a failure of anything
    if (!/cancel/i.test(err instanceof Error ? err.message : String(err))) throw err;
  }
}

/** Fetch a file the API serves and hand it over, as saveBlob does. */
export async function saveFromApi(path: string, filename: string, title = filename): Promise<void> {
  const res = await send(apiPath(path));
  if (!res.ok) throw new Error('This file could not be fetched');
  await saveBlob(await res.blob(), filename, title);
}
