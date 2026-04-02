import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { fetchOfflineDownloadStatus } from './offlineDownloadEntitlement';

export interface OfflineSongMeta {
  songId: string;
  title: string;
  artist: string;
  coverImageUrl?: string | null;
  durationSeconds?: number | null;
}

interface OfflineIndexEntry extends OfflineSongMeta {
  /** Relative path within Directory.Data */
  path: string;
  /** Native file URI (e.g. file://...) */
  fileUri: string;
  /** WebView-playable URL (via Capacitor.convertFileSrc) */
  webviewUrl: string;
  /** Original network URL (debug / provenance) */
  sourceUrl: string;
  sizeBytes: number;
  downloadedAt: string; // ISO
}

const OFFLINE_INDEX_KEY = 'offline_audio_index_v1';
const OFFLINE_DIR = 'offline-audio';
const OFFLINE_EVENT = 'offlineDownloadsChanged';

let indexCache: Record<string, OfflineIndexEntry> | null = null;
let indexLoadPromise: Promise<Record<string, OfflineIndexEntry>> | null = null;

function isAndroidNative(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

function dispatchChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent(OFFLINE_EVENT));
  } catch {
    // ignore
  }
}

async function ensureIndexLoaded(): Promise<Record<string, OfflineIndexEntry>> {
  if (indexCache) return indexCache;
  if (indexLoadPromise) return indexLoadPromise;
  indexLoadPromise = (async () => {
    try {
      const { value } = await Preferences.get({ key: OFFLINE_INDEX_KEY });
      const parsed = value ? (JSON.parse(value) as Record<string, OfflineIndexEntry>) : {};
      indexCache = parsed && typeof parsed === 'object' ? parsed : {};
      return indexCache;
    } catch {
      indexCache = {};
      return indexCache;
    } finally {
      indexLoadPromise = null;
    }
  })();
  return indexLoadPromise;
}

async function saveIndex(next: Record<string, OfflineIndexEntry>): Promise<void> {
  indexCache = next;
  await Preferences.set({ key: OFFLINE_INDEX_KEY, value: JSON.stringify(next) });
}

function inferExtension(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').pop() || '';
    const dot = last.lastIndexOf('.');
    const ext = dot !== -1 ? last.slice(dot + 1).toLowerCase() : '';
    if (!ext) return 'mp3';
    // Keep conservative list; unknown types still saved as bin.
    if (['mp3', 'm4a', 'aac', 'wav', 'ogg', 'flac'].includes(ext)) return ext;
    return 'bin';
  } catch {
    return 'mp3';
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  // Convert in chunks to avoid call stack limits.
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function ensureOfflineDir(): Promise<void> {
  try {
    await Filesystem.mkdir({ directory: Directory.Data, path: OFFLINE_DIR, recursive: true });
  } catch {
    // ignore if exists / not supported
  }
}

export async function isOfflineAvailable(songId: string): Promise<boolean> {
  if (!isAndroidNative()) return false;
  const index = await ensureIndexLoaded();
  return !!index[songId];
}

export async function getOfflinePlaybackUrl(songId: string): Promise<string | null> {
  if (!isAndroidNative()) return null;
  const index = await ensureIndexLoaded();
  const entry = index[songId];
  if (!entry?.path) return null;

  try {
    // Verify the file still exists; if not, drop stale index entry.
    await Filesystem.stat({ directory: Directory.Data, path: entry.path });
    if (entry.webviewUrl) return entry.webviewUrl;
    // Backward compat: compute and persist if missing.
    const uri = await Filesystem.getUri({ directory: Directory.Data, path: entry.path });
    const webviewUrl = Capacitor.convertFileSrc(uri.uri);
    const next = { ...index, [songId]: { ...entry, fileUri: uri.uri, webviewUrl } };
    try {
      await saveIndex(next);
    } catch {
      // ignore
    }
    return webviewUrl;
  } catch {
    const next = { ...index };
    delete next[songId];
    try {
      await saveIndex(next);
    } catch {
      // ignore
    }
    return null;
  }
}

export async function downloadOfflineSong(meta: OfflineSongMeta, audioUrl: string): Promise<void> {
  if (!isAndroidNative()) {
    throw new Error('Offline downloads are only supported on Android native builds.');
  }
  if (!audioUrl?.startsWith('https://')) {
    throw new Error('Audio URL must be an https:// URL.');
  }

  const entitlement = await fetchOfflineDownloadStatus();
  if (!entitlement.active) {
    throw new Error(
      'Offline downloads require an active monthly Treat subscription. Open the paywall from the download button.'
    );
  }

  await ensureOfflineDir();
  const index = await ensureIndexLoaded();

  // Fetch bytes.
  const res = await fetch(audioUrl, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }
  const buffer = await res.arrayBuffer();
  if (!buffer || buffer.byteLength < 1024) {
    // Avoid saving tiny error pages as “audio”.
    throw new Error('Downloaded file is too small to be valid audio.');
  }

  const ext = inferExtension(audioUrl);
  const filename = `${meta.songId}.${ext}`;
  const relPath = `${OFFLINE_DIR}/${filename}`;
  const base64 = arrayBufferToBase64(buffer);

  await Filesystem.writeFile({
    directory: Directory.Data,
    path: relPath,
    data: base64,
  });

  const uri = await Filesystem.getUri({ directory: Directory.Data, path: relPath });
  const webviewUrl = Capacitor.convertFileSrc(uri.uri);

  const next: Record<string, OfflineIndexEntry> = {
    ...index,
    [meta.songId]: {
      ...meta,
      path: relPath,
      fileUri: uri.uri,
      webviewUrl,
      sourceUrl: audioUrl,
      sizeBytes: buffer.byteLength,
      downloadedAt: new Date().toISOString(),
    },
  };
  await saveIndex(next);
  dispatchChanged();
}

export async function deleteOfflineSong(songId: string): Promise<void> {
  if (!isAndroidNative()) return;
  const index = await ensureIndexLoaded();
  const entry = index[songId];
  if (!entry) return;

  try {
    await Filesystem.deleteFile({ directory: Directory.Data, path: entry.path });
  } catch {
    // ignore: file might already be gone
  }

  const next = { ...index };
  delete next[songId];
  await saveIndex(next);
  dispatchChanged();
}

export async function listOfflineDownloads(): Promise<OfflineIndexEntry[]> {
  if (!isAndroidNative()) return [];
  const index = await ensureIndexLoaded();
  return Object.values(index).sort((a, b) => {
    const aTs = new Date(a.downloadedAt).getTime();
    const bTs = new Date(b.downloadedAt).getTime();
    return bTs - aTs;
  });
}

export function subscribeOfflineDownloadsChanged(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(OFFLINE_EVENT, handler as EventListener);
  return () => window.removeEventListener(OFFLINE_EVENT, handler as EventListener);
}

