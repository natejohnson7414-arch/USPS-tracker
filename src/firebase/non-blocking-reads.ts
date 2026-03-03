'use client';

import {
  getDoc,
  getDocs,
  CollectionReference,
  DocumentReference,
  Query,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Initiates a getDoc operation for a document reference.
 * Catches permission errors and emits them globally.
 */
export function getDocumentNonBlocking(docRef: DocumentReference) {
  const promise = getDoc(docRef).catch(error => {
    if (error.code === 'permission-denied' || error.message.includes('permission')) {
        errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
                path: docRef.path,
                operation: 'get',
            })
        );
    }
    throw error;
  });
  return promise;
}

/**
 * Initiates a getDocs operation for a collection or query reference.
 * Catches permission errors and emits them globally.
 */
export function getCollectionNonBlocking(queryOrColRef: Query | CollectionReference) {
  const promise = getDocs(queryOrColRef).catch(error => {
    if (error.code === 'permission-denied' || error.message.includes('permission')) {
        let path: string;
        try {
            path = (queryOrColRef as any).path || (queryOrColRef as any)._query?.path?.canonicalString() || "unknown/collection";
        } catch (e) {
            path = "unknown/collection";
        }

        errorEmitter.emit(
            'permission-error',
            new FirestorePermissionError({
                path: path,
                operation: 'list',
            })
        );
    }
    throw error;
  });
  return promise;
}
