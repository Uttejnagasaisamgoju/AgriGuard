/**
 * Offline-first Photo Upload Queue for AgriGuard Mobile
 * Safely persists photo scans when mobile connectivity is intermittent or offline.
 * Automatically retries upload and enhancement as soon as network returns.
 */

export interface QueuedUpload {
  id: string;
  createdAt: number;
  fileName: string;
  fileBlob: Blob;
  status: 'queued' | 'uploading' | 'completed' | 'failed';
  retryCount: number;
  error?: string;
  previewUrl?: string;
}

const DB_NAME = 'AgriGuardOfflineDB';
const STORE_NAME = 'upload_queue';
const DB_VERSION = 1;

class UploadQueueManager {
  private db: IDBDatabase | null = null;
  private listeners: Array<(queue: QueuedUpload[]) => void> = [];
  private isProcessing = false;
  private customUploader: ((item: QueuedUpload) => Promise<any>) | null = null;

  constructor() {
    this.initDB();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[UploadQueue] Device reconnected to internet. Resuming pending uploads...');
        this.processQueue();
      });
    }
  }

  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB not supported'));
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event: any) => {
        this.db = event.target.result;
        resolve(this.db!);
      };

      request.onerror = (err) => {
        console.error('[UploadQueue] Failed to open IndexedDB:', err);
        reject(err);
      };
    });
  }

  public setUploader(uploader: (item: QueuedUpload) => Promise<any>) {
    this.customUploader = uploader;
  }

  public subscribe(listener: (queue: QueuedUpload[]) => void): () => void {
    this.listeners.push(listener);
    this.getQueue().then(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.getQueue().then((items) => {
      this.listeners.forEach((l) => l(items));
    });
  }

  public async enqueue(file: File): Promise<QueuedUpload> {
    const db = await this.initDB();
    const item: QueuedUpload = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      createdAt: Date.now(),
      fileName: file.name,
      fileBlob: file,
      status: 'queued',
      retryCount: 0,
      previewUrl: URL.createObjectURL(file),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(item);

      req.onsuccess = () => {
        this.notify();
        // If device is online, attempt processing immediately
        if (navigator.onLine) {
          this.processQueue();
        }
        resolve(item);
      };

      req.onerror = () => reject(req.error);
    });
  }

  public async getQueue(): Promise<QueuedUpload[]> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  public async remove(id: string): Promise<void> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => {
          this.notify();
          resolve();
        };
      });
    } catch {}
  }

  public async updateStatus(id: string, updates: Partial<QueuedUpload>): Promise<void> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);

        req.onsuccess = () => {
          const existing = req.result;
          if (existing) {
            const updated = { ...existing, ...updates };
            store.put(updated);
          }
        };

        tx.oncomplete = () => {
          this.notify();
          resolve();
        };
      });
    } catch {}
  }

  public async processQueue(): Promise<void> {
    if (this.isProcessing || !navigator.onLine || !this.customUploader) return;
    this.isProcessing = true;

    try {
      const items = await this.getQueue();
      const pending = items.filter((i) => i.status === 'queued' || i.status === 'failed');

      for (const item of pending) {
        if (!navigator.onLine) break;

        await this.updateStatus(item.id, { status: 'uploading' });

        try {
          await this.customUploader(item);
          // Upload successful, delete from persistent queue
          await this.remove(item.id);
        } catch (err: any) {
          console.warn('[UploadQueue] Retry failed for item:', item.id, err);
          await this.updateStatus(item.id, {
            status: 'failed',
            retryCount: item.retryCount + 1,
            error: err?.message || 'Network error occurred during photo upload',
          });
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

export const uploadQueue = new UploadQueueManager();
