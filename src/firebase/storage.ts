
'use client';

import { getStorage, ref, uploadBytes, getDownloadURL, Storage } from 'firebase/storage';
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
export const uploadImage = async (file: File, path: string): Promise<string> => {
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
