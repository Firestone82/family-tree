import { Injectable } from '@angular/core';

/** The part of the Claude artifact viewer's `downloads` capability this app uses. */
interface DownloadsApi {
  save(request: { filename: string; data: string | Blob }): Promise<{ status: 'saved' | 'delivered' }>;
}

interface ClaudeHost {
  use(name: 'downloads'): Promise<DownloadsApi | null>;
}

export type SaveOutcome = 'saved' | 'declined' | 'unsupported' | 'failed';

/** File types the artifact viewer lets a page save (see its downloads capability). */
const HOSTED_EXTENSIONS = new Set(['gif', 'png', 'jpg', 'jpeg', 'webp', 'txt', 'json', 'md', 'csv', 'html', 'svg', 'pdf', 'zip']);

/**
 * Opening and saving files. In a normal browser this is a file picker and a
 * download link. When the app runs as a published Claude artifact, downloads
 * go through the viewer, which asks the person to confirm and only accepts
 * some file types (not .xml).
 */
@Injectable({ providedIn: 'root' })
export class FileIo {
  private readonly host: ClaudeHost | undefined = typeof window !== 'undefined' ? (window as unknown as { claude?: ClaudeHost }).claude : undefined;
  private readonly downloads: Promise<DownloadsApi | null> | undefined;

  constructor() {
    if (this.host?.use) {
      this.downloads = this.host.use('downloads').catch(() => null);
    }
  }

  /** True when running inside a viewer that controls downloads. */
  get hosted(): boolean {
    return !!this.host?.use;
  }

  canSave(filename: string): boolean {
    if (!this.hosted) return true;
    return HOSTED_EXTENSIONS.has(filename.split('.').pop()?.toLowerCase() ?? '');
  }

  async save(filename: string, data: Blob | string, mime: string): Promise<SaveOutcome> {
    if (this.hosted) {
      const api = await this.downloads;
      if (!api) return 'unsupported';
      try {
        await api.save({ filename, data });
        return 'saved';
      } catch (e) {
        const code = (e as { code?: string } | null)?.code;
        if (code === 'declined') return 'declined';
        if (code === 'rejected_extension' || code === 'extension_not_enabled' || code === 'unavailable' || code === 'not_granted') return 'unsupported';
        return 'failed';
      }
    }
    try {
      const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      return 'saved';
    } catch {
      return 'failed';
    }
  }

  /** Shows the file picker. Must be called from a click or key handler. */
  pick(accept: string): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      let settled = false;
      const done = (file: File | null) => {
        if (settled) return;
        settled = true;
        input.remove();
        resolve(file);
      };
      input.addEventListener('change', () => done(input.files?.[0] ?? null));
      input.addEventListener('cancel', () => done(null));
      document.body.append(input);
      input.click();
    });
  }
}

export function safeFilename(title: string, ext: string): string {
  const base = title
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
  return `${base || 'family-tree'}.${ext}`;
}
