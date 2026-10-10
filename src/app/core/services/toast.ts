import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
  action?: { label: string; run: () => void };
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(text: string, options: { tone?: Toast['tone']; action?: Toast['action']; duration?: number } = {}): void {
    const toast: Toast = { id: ++this.seq, text, tone: options.tone ?? 'info', action: options.action };
    this.toasts.update((list) => [...list.slice(-2), toast]);
    const duration = options.duration ?? (options.action ? 6000 : 3500);
    setTimeout(() => this.dismiss(toast.id), duration);
  }

  error(text: string): void {
    this.show(text, { tone: 'error', duration: 6000 });
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
