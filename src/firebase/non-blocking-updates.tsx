'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Initiates a setDoc operation for a document reference.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options?: SetOptions) {
  const promise = setDoc(docRef, data, options || {}).catch(error => {
    if (error.code === 'permission-denied' || error.message.includes('permission')) {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: options && 'merge' in options ? 'update' : 'create',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw permissionError;
    }
    throw error;
  });
  return promise;
}

/**
 * Initiates an addDoc operation for a collection reference.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  const promise = addDoc(colRef, data).catch(error => {
    if (error.code === 'permission-denied' || error.message.includes('permission')) {
        const permissionError = new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw permissionError;
    }
    throw error;
  });
  return promise;
}

/**
 * Initiates an updateDoc operation for a document reference.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  const promise = updateDoc(docRef, data).catch(error => {
    if (error.code === 'permission-denied' || error.message.includes('permission')) {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw permissionError;
    }
    throw error;
  });
  return promise;
}

/**
 * Initiates a deleteDoc operation for a document reference.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  const promise = deleteDoc(docRef).catch(error => {
    if (error.code === 'permission-denied' || error.message.includes('permission')) {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw permissionError;
    }
    throw error;
  });
  return promise;
}
