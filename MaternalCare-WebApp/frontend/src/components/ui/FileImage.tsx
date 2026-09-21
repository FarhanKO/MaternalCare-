import { useEffect, type ImgHTMLAttributes } from 'react';
import { useFile } from '@/lib/files';

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** the API path, as the server gave it — "/api/documents/12/file" */
  path: string;
  /** the file could not be fetched (the app) or drawn (a browser) */
  onFail?: () => void;
}

/**
 * An <img> for a file the API serves behind the session.
 *
 * In a browser it is exactly an <img> with the URL. In the app the bytes
 * are fetched with the session header first (lib/files), and the tag gets
 * an object URL; until then it is an empty box the size its classes give it.
 */
export function FileImage({ path, onFail, onError, ...img }: Props) {
  const { url, failed } = useFile(path);

  useEffect(() => { if (failed) onFail?.(); }, [failed, onFail]);

  if (failed) return null;
  return (
    <img
      {...img}
      src={url ?? undefined}
      onError={(e) => { onError?.(e); onFail?.(); }}
    />
  );
}
