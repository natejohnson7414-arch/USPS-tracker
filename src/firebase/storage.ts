
'use client';

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { initializeFirebase } from './init';
import { getAuth } from 'firebase/auth';

/**
 * Uploads an image file to Firebase Storage.
 * @param file The image file to upload.
 * @param path The path where the file should be stored.
 * @returns A promise that resolves with the download URL.
 */
export const uploadImage = async (file: Blob, path: string): Promise<string> => {
  try {
    const services = await initializeFirebase();
    if (!services.storage) {
        throw new Error("Firebase Storage service is not available.");
    }

    const auth = getAuth(services.firebaseApp);
    
    // CRITICAL: Ensure Auth state is resolved
    await auth.authStateReady();
    
    if (!auth.currentUser) {
      console.error("[Storage] Upload attempted while unauthenticated.");
      throw new Error("Authentication required for upload.");
    }

    console.log(`[Storage] Starting upload to: ${path}`, {
      uid: auth.currentUser.uid,
      size: file.size,
      type: file.type
    });

    const storageRef = ref(services.storage, path);
    
    // Perform upload
    const snapshot = await uploadBytes(storageRef, file);
    
    console.log(`[Storage] Upload successful: ${path}`);
    
    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error: any) {
    console.error("[Storage] Upload failed:", {
      code: error.code,
      message: error.message,
      path: path
    });
    throw error;
  }
};

/**
 * Deletes an image file from Firebase Storage.
 */
export const deleteImage = async (imageUrl: string): Promise<void> => {
    try {
        const services = await initializeFirebase();
        if (!services.storage) {
            throw new Error("Firebase Storage service is not available.");
        }
        
        const auth = getAuth(services.firebaseApp);
        await auth.authStateReady();

        const imageRef = ref(services.storage, imageUrl);
        await deleteObject(imageRef);
    } catch (error: any) {
        if (error.code === 'storage/object-not-found') {
            console.warn(`[Storage] File not found for deletion: ${imageUrl}`);
            return;
        }
        console.error("[Storage] Deletion failed:", error);
        throw error;
    }
};
