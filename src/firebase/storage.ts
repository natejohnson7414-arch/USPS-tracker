
'use client';

import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { initializeFirebase } from './init';
import { getAuth, getIdTokenResult } from 'firebase/auth';

/**
 * Uploads an image file to Firebase Storage with resumable support and instrumentation.
 */
export const uploadImage = async (file: Blob, path: string): Promise<string> => {
  const isDebug = process.env.NEXT_PUBLIC_DEBUG_UPLOADS === '1';
  
  try {
    const services = await initializeFirebase();
    const auth = getAuth(services.firebaseApp);
    
    // 1. Ensure Auth is ready
    await auth.authStateReady();
    const user = auth.currentUser;

    if (!user) {
      if (isDebug) console.error("[Storage] Upload blocked: No authenticated user.");
      throw new Error("Authentication required for upload.");
    }

    if (isDebug) {
      const token = await getIdTokenResult(user);
      console.log("[Storage] Starting Upload Debug:", {
        path,
        uid: user.uid,
        claims: token.claims,
        online: navigator.onLine,
        size: file.size,
        type: file.type
      });
    }

    const storageRef = ref(services.storage, path);
    
    // 2. Use Resumable Upload for better reliability in background
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on('state_changed', 
        (snapshot) => {
          if (isDebug) {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`[Storage] Uploading ${path}: ${progress.toFixed(0)}%`);
          }
        }, 
        (error) => {
          if (isDebug) {
            console.error("[Storage] Task Failed:", {
              code: error.code,
              message: error.message,
              serverResponse: error.serverResponse
            });
          }
          reject(error);
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          if (isDebug) console.log("[Storage] Upload Success:", downloadURL);
          resolve(downloadURL);
        }
      );
    });

  } catch (error: any) {
    console.error("[Storage] Critical Upload Error:", error);
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
