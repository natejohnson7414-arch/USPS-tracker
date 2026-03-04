'use client';

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { initializeFirebase } from './init';

/**
 * Uploads an image file to Firebase Storage.
 * @param file The image file to upload.
 * @param path The path where the file should be stored in Firebase Storage.
 * @returns A promise that resolves with the download URL of the uploaded file.
 */
export const uploadImage = async (file: Blob, path: string): Promise<string> => {
  try {
    // initializeFirebase is async and returns a promise of services
    const { storage } = await initializeFirebase();
    if (!storage) {
        throw new Error("Firebase Storage service is not available.");
    }
    const storageRef = ref(storage, path);
    
    // 'file' comes from the Blob or File API
    const snapshot = await uploadBytes(storageRef, file);
    
    // Get the download URL
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
        const { storage } = await initializeFirebase();
        if (!storage) {
            throw new Error("Firebase Storage service is not available.");
        }
        const imageRef = ref(storage, imageUrl);
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
