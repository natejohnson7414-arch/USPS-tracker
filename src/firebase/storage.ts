'use client';

import { ref, uploadBytesResumable, getDownloadURL, deleteObject, type StorageError } from 'firebase/storage';
import { getIdToken } from 'firebase/auth';
import { initializeFirebase } from './init';
import type { PhotoMetadata } from '@/lib/types';

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
  timeoutMs?: number;      // Default 300s
  stallMs?: number;        // Default 60s
}

/**
 * Client-side thumbnail generation using Canvas.
 * Produces a compressed JPEG version of the image.
 */
export async function createThumbnail(file: File | Blob, maxWidth = 400): Promise<Blob> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  
  try {
    return await new Promise((resolve, reject) => {
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas conversion failed'));
        }, 'image/jpeg', 0.7);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image for thumbnail'));
      };
      img.src = url;
    });
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
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
  const STALL_TIMEOUT = opts?.stallMs || 60000;
  const HARD_TIMEOUT = opts?.timeoutMs || 300000;

  // Lifecycle state to prevent double-decrementing global counters
  let taskFinished = false;

  const services = await initializeFirebase();
  const auth = services.auth;

  // Wait for auth to be ready
  if (!auth.currentUser) {
    try {
      await Promise.race([
        auth.authStateReady(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Auth handshake timeout")), 15000))
      ]);
    } catch (e) {
      if (isDebug) console.warn("[UPLOAD] Auth ready check timed out, attempting to proceed.");
    }
  }

  const user = auth.currentUser;
  if (user) {
    try {
      // Force token refresh to ensure Storage SDK picks up the current authenticated state
      await getIdToken(user, true);
    } catch (e) {
      if (isDebug) console.warn("[UPLOAD] Proactive token refresh failed:", e);
    }
  } else if (isDebug) {
    console.warn("[UPLOAD] No current user detected before starting upload.");
  }

  // Increment counter and block background sync
  activeUploadCount++;
  if (typeof window !== 'undefined') window.__UPLOAD_IN_PROGRESS__ = true;

  const finish = () => {
    if (!taskFinished) {
      activeUploadCount = Math.max(0, activeUploadCount - 1);
      if (activeUploadCount === 0 && typeof window !== 'undefined') {
        window.__UPLOAD_IN_PROGRESS__ = false;
      }
      taskFinished = true;
    }
  };

  const startTime = Date.now();

  try {
    if (isDebug) console.log(`[UPLOAD] Initializing: ${path}`);
    
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
        if (isDebug) console.error(`[UPLOAD] Stalled: ${path} after ${elapsedSinceProgress}ms`);
      }

      if (elapsedTotal > HARD_TIMEOUT) {
        clearInterval(watchdog);
        uploadTask.cancel();
        if (isDebug) console.error(`[UPLOAD] Hard Timeout: ${path} after ${elapsedTotal}ms`);
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
          finish();
          if (isDebug) console.error("[UPLOAD] SDK Error:", error.code, error.message);
          reject(error);
        },
        async () => {
          clearInterval(watchdog);
          finish();
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
    finish();
    if (isDebug) console.error("[UPLOAD] Exception:", error);
    throw error;
  }
};

/**
 * Uploads a photo and automatically generates/uploads a thumbnail.
 * Returns both URLs.
 */
export const uploadPhotoWithThumbnail = async (
  file: File | Blob,
  basePath: string,
  fileName: string,
  opts?: UploadOptions
): Promise<PhotoMetadata> => {
  const originalPath = `${basePath}/${fileName}`;
  const thumbnailPath = `${basePath}/thumbnails/${fileName}`;

  // 1. Upload original
  const { downloadURL: originalUrl } = await uploadImageResumable(file, originalPath, opts);

  // 2. Generate and upload thumbnail (fail gracefully to return original if thumb fails)
  try {
    const thumbBlob = await createThumbnail(file);
    const { downloadURL: thumbnailUrl } = await uploadImageResumable(thumbBlob, thumbnailPath, {
      ...opts,
      onProgress: undefined 
    });
    return { url: originalUrl, thumbnailUrl };
  } catch (e) {
    console.warn("[UPLOAD] Thumbnail generation failed, using original only:", e);
    return { url: originalUrl };
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

/**
 * Helper to delete both original and thumbnail if possible.
 */
export const deletePhotoMetadata = async (photo: string | PhotoMetadata): Promise<void> => {
  if (typeof photo === 'string') {
    await deleteImage(photo);
  } else {
    await deleteImage(photo.url);
    if (photo.thumbnailUrl) {
      await deleteImage(photo.thumbnailUrl);
    }
  }
};
