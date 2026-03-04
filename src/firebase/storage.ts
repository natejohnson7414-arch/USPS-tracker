
'use client';

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { initializeFirebase } from './init';
import { getAuth } from 'firebase/auth';

/**
 * Uploads an image file to Firebase Storage.
 * @param file The image file to upload.
 * @param path The path where the file should be stored in Firebase Storage.
 * @returns A promise that resolves with the download URL of the uploaded file.
 */
export const uploadImage = async (file: Blob, path: string): Promise<string> => {
  try {
    // 1. Ensure Firebase services are initialized
    const services = await initializeFirebase();
    if (!services.storage) {
        throw new Error("Firebase Storage service is not available.");
    }

    // 2. Critical: Wait for Auth to be ready before uploading
    // This ensures request.auth is not null in security rules
    const auth = getAuth(services.firebaseApp);
    await auth.authStateReady();

    const storageRef = ref(services.storage, path);
    
    // 3. Perform upload
    const snapshot = await uploadBytes(storageRef, file);
    
    // 4. Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading image: ", error);
    throw new Error('Image upload failed');
  }
};


/**
 * Deletes an image file from Firebase Storage using its download URL.
 * @param imageUrl The public download URL of the image to delete.
 * @returns A promise that resolves when the file is deleted.
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
         // It's okay if the file doesn't exist, we can ignore that error.
        if (error.code === 'storage/object-not-found') {
            console.warn(`File not found, could not delete from Storage: ${imageUrl}`);
            return;
        }
        console.error("Error deleting image from storage: ", error);
        throw new Error('Image deletion failed');
    }
};
