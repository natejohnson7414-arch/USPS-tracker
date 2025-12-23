
'use client';

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, Storage } from 'firebase/storage';
import { initializeFirebase } from './index';

// Initialize Firebase once and get all services
const services = initializeFirebase();
const storage: Storage = services.storage;

/**
 * Uploads an image file to Firebase Storage.
 * @param file The image file to upload.
 * @param path The path where the file should be stored in Firebase Storage.
 * @returns A promise that resolves with the download URL of the uploaded file.
 */
export const uploadImage = async (file: Blob, path: string): Promise<string> => {
  const storageRef = ref(storage, path);
  
  try {
    // 'file' comes from the Blob or File API
    const snapshot = await uploadBytes(storageRef, file);
    console.log('Uploaded a blob or file!', snapshot);

    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading image: ", error);
    // Depending on your error handling strategy, you might want to re-throw the error
    // or return a specific error message.
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
        const imageRef = ref(storage, imageUrl);
        await deleteObject(imageRef);
        console.log('File deleted successfully');
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
