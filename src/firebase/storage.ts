'use client';

import { ref, uploadBytesResumable, getDownloadURL, deleteObject, StorageError } from 'firebase/storage';
import { initializeFirebase } from './init';
import { getAuth, getIdTokenResult } from 'firebase/auth';

/**
 * Uploads an image file to Firebase Storage with resumable support, timeouts, and stall detection.
 * 
 * @param file The file or blob to upload
 * @param path The destination path in storage
 * @param onProgress Optional callback for progress updates (0-100)
 */
export const uploadImage = async (
  file: Blob, 
  path: string, 
  onProgress?: (progress: number) => void
): Promise<string> => {
  const isDebug = process.env.NEXT_PUBLIC_DEBUG_UPLOADS === '1';
  const startTime = Date.now();
  
  try {
    const services = await initializeFirebase();
    const auth = getAuth(services.firebaseApp);
    
    // 1. Ensure Auth is fully hydrated and ready
    if (isDebug) console.log(`[UPLOAD] Initializing: ${path}`);
    await auth.authStateReady();
    const user = auth.currentUser;

    if (!user) {
      if (isDebug) console.error("[UPLOAD] Aborted: No authenticated user.");
      throw new Error("Authentication required for upload.");
    }

    if (isDebug) {
      const token = await getIdTokenResult(user);
      console.log("[UPLOAD] Context:", {
        path,
        uid: user.uid,
        claims: token.claims,
        online: navigator.onLine,
        size: file.size,
        type: file.type
      });
    }

    const storageRef = ref(services.storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);

    // 2. Setup Timeout and Stall Detection
    let lastProgressAt = Date.now();
    const STALL_TIMEOUT = 30000; // 30 seconds of no progress
    const HARD_TIMEOUT = 120000; // 2 minutes total limit

    const watchdog = setInterval(() => {
      const now = Date.now();
      const elapsedTotal = now - startTime;
      const elapsedSinceProgress = now - lastProgressAt;

      if (elapsedSinceProgress > STALL_TIMEOUT) {
        clearInterval(watchdog);
        uploadTask.cancel();
        if (isDebug) console.error(`[UPLOAD] Stalled: No progress for ${STALL_TIMEOUT}ms`);
      }

      if (elapsedTotal > HARD_TIMEOUT) {
        clearInterval(watchdog);
        uploadTask.cancel();
        if (isDebug) console.error(`[UPLOAD] Hard Timeout: Exceeded ${HARD_TIMEOUT}ms`);
      }
    }, 5000);

    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', 
        (snapshot) => {
          lastProgressAt = Date.now();
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          
          if (onProgress) onProgress(pct);
          
          if (isDebug) {
            console.log(`[UPLOAD] Progress: ${pct}% (${snapshot.bytesTransferred}/${snapshot.totalBytes})`);
          }
        }, 
        (error: StorageError) => {
          clearInterval(watchdog);
          if (isDebug) {
            console.error("[UPLOAD] Error:", {
              code: error.code,
              message: error.message,
              serverResponse: error.serverResponse
            });
          }
          reject(error);
        }, 
        async () => {
          clearInterval(watchdog);
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            if (isDebug) console.log(`[UPLOAD] Success in ${duration}s:`, downloadURL);
            resolve(downloadURL);
          } catch (urlError) {
            reject(urlError);
          }
        }
      );
    });

  } catch (error: any) {
    console.error("[UPLOAD] Critical Exception:", error);
    throw error;
  }
};

/**
 * Deletes an image file from Firebase Storage.
 */
export const deleteImage = async (imageUrl: string): Promise<void> => {
    try {
        const services = await initializeFirebase();
        const auth = getAuth(services.firebaseApp);
        await auth.authStateReady();

        const imageRef = ref(services.storage, imageUrl);
        await deleteObject(imageRef);
    } catch (error: any) {
        if (error.code === 'storage/object-not-found') {
            return;
        }
        throw error;
    }
};
