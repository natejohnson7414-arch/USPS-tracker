
/**
 * @fileOverview Barrel file for Firebase functionality.
 * Optimized to serve as a pass-through for client boundary modules.
 * Explicit named exports are used to prevent module resolution loops in Next.js 15.
 */

export { initializeFirebase } from './init';
export { 
  FirebaseProvider, 
  useFirebase, 
  useAuth, 
  useFirestore, 
  useFirebaseApp, 
  useMemoFirebase, 
  useUser 
} from './provider';
export { FirebaseClientProvider } from './client-provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { 
  setDocumentNonBlocking, 
  addDocumentNonBlocking, 
  updateDocumentNonBlocking, 
  deleteDocumentNonBlocking 
} from './non-blocking-updates';
export { 
  initiateAnonymousSignIn, 
  initiateEmailSignUp, 
  initiateEmailSignIn 
} from './non-blocking-login';
export { 
  getDocumentNonBlocking, 
  getCollectionNonBlocking 
} from './non-blocking-reads';
export { FirestorePermissionError } from './errors';
export { errorEmitter } from './error-emitter';
