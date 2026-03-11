
'use client';

import { ref, uploadBytesResumable, getDownloadURL, deleteObject, StorageError } from 'firebase/storage';
import { initializeFirebase } from './init';
import { getAuth } from 'firebase/auth';

/**
 * Global counter for active uploads to allow background services (like SyncManager)
 * to yield bandwidth to high-priority media transfers.
 */
let activeUploadCount = 0;
export const getActiveUploadCount = () => activeUploadCount;

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  pct: number;
}

export interface UploadOptions {
  onProgress?: (p: UploadProgress) => void;
  signal?: AbortSignal;
  timeoutMs?: number;      // Default 120s
  stallMs?: number;        // Default 30s
}

/**
 * Uploads a file to Firebase Storage with resumable support, timeouts, and stall detection.
 * USES OFFICIAL SDK: firebase/storage
 */
export const uploadImageResumable = async (
  file: Blob,
  path: string,
  opts?: UploadOptions
): Promise<{ downloadURL: string; fullPath: string }> => {
  const isDebug = process.env.NEXT_PUBLIC_DEBUG_UPLOADS === '1';
  const STALL_TIMEOUT = opts?.stallMs || 30000;
  const HARD_TIMEOUT = opts?.timeoutMs || 120000;
  const startTime = Date.now();

  // Always increment count at start of task
  activeUploadCount++;
  if (typeof window !== 'undefined') window.__UPLOAD_IN_PROGRESS__ = true;

  try {
    const services = await initializeFirebase();
    const auth = services.auth;

    if (isDebug) console.log(`[UPLOAD] Starting: ${path}`);
    
    // Quick check for existing user
    if (!auth.currentUser) {
      // Give it one short wait
      await auth.authStateReady();
    }

    const user = auth.currentUser;
    if (!user) {
      throw new Error("Authentication required for upload.");
    }

    const storageRef = ref(services.storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    // Watchdog for Stalls and Timeouts
    let lastProgressAt = Date.now();
    const watchdog = setInterval(() => {
      const now = Date.now();
      const elapsedTotal = now - startTime;
      const elapsedSinceProgress = now - lastProgressAt;

      if (opts?.signal?.aborted) {
        clearInterval(watchdog);
        uploadTask.cancel();
        return;
      }

      if (elapsedSinceProgress > STALL_TIMEOUT) {
        clearInterval(watchdog);
        uploadTask.cancel();
        if (isDebug) console.error(`[UPLOAD] Stalled: ${path}`);
      }

      if (elapsedTotal > HARD_TIMEOUT) {
        clearInterval(watchdog);
        uploadTask.cancel();
        if (isDebug) console.error(`[UPLOAD] Hard Timeout: ${path}`);
      }
    }, 5000);

    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed',
        (snapshot) => {
          lastProgressAt = Date.now();
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (opts?.onProgress) {
            opts.onProgress({
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
              pct
            });
          }
        },
        (error: StorageError) => {
          clearInterval(watchdog);
          activeUploadCount = Math.max(0, activeUploadCount - 1);
          if (activeUploadCount === 0 && typeof window !== 'undefined') {
            window.__UPLOAD_IN_PROGRESS__ = false;
          }
          if (isDebug) console.error("[UPLOAD] SDK Error:", error.code);
          reject(error);
        },
        async () => {
          clearInterval(watchdog);
          activeUploadCount = Math.max(0, activeUploadCount - 1);
          if (activeUploadCount === 0 && typeof window !== 'undefined') {
            window.__UPLOAD_IN_PROGRESS__ = false;
          }
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            if (isDebug) console.log(`[UPLOAD] Success: ${downloadURL}`);
            resolve({ downloadURL, fullPath: path });
          } catch (urlError) {
            reject(urlError);
          }
        }
      );
    });

  } catch (error: any) {
    // If we failed before the task observer took over, decrement here
    activeUploadCount = Math.max(0, activeUploadCount - 1);
    if (activeUploadCount === 0 && typeof window !== 'undefined') {
      window.__UPLOAD_IN_PROGRESS__ = false;
    }
    if (isDebug) console.error("[UPLOAD] Pre-task Exception:", error);
    throw error;
  }
};

/**
 * Legacy wrapper for compatibility.
 */
export const uploadImage = async (
  file: Blob,
  path: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  const result = await uploadImageResumable(file, path, {
    onProgress: (p) => onProgress?.(p.pct)
  });
  return result.downloadURL;
};

/**
 * Deletes an image file from Firebase Storage.
 */
export const deleteImage = async (imageUrl: string): Promise<void> => {
  try {
    const services = await initializeFirebase();
    const imageRef = ref(services.storage, imageUrl);
    await deleteObject(imageRef);
  } catch (error: any) {
    if (error.code === 'storage/object-not-found') return;
    throw error;
  }
};
