
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
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'get',
      })
    );
    // Re-throw the error so the caller's catch block can also handle it if needed.
    throw error;
  });
  return promise;
}

/**
 * Initiates a getDocs operation for a collection or query reference.
 * Catches permission errors and emits them globally.
 */
export function getCollectionNonBlocking(queryOrColRef: Query | CollectionReference) {
  const path = (queryOrColRef as any).path ?? (queryOrColRef as any)._query.path.canonicalString();

  const promise = getDocs(queryOrColRef).catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: path,
        operation: 'list',
      })
    );
     // Re-throw the error so the caller's catch block can also handle it if needed.
    throw error;
  });
  return promise;
}
