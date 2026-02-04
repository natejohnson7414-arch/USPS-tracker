'use client';
import {
  Auth, // Import Auth type for type hinting
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  // Assume getAuth and app are initialized elsewhere
} from 'firebase/auth';
import { toast } from '@/hooks/use-toast';


/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  // CRITICAL: Call signInAnonymously directly. Do NOT use 'await signInAnonymously(...)'.
  signInAnonymously(authInstance).catch((error) => {
      toast({
        title: 'Login Failed',
        description: 'Anonymous sign-in failed. Please try again later.',
        variant: 'destructive',
      });
  });
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): void {
  // CRITICAL: Call createUserWithEmailAndPassword directly. Do NOT use 'await createUserWithEmailAndPassword(...)'.
  createUserWithEmailAndPassword(authInstance, email, password)
    .catch((error) => {
        let description = 'An unexpected error occurred during sign-up. Please try again.';
        switch(error.code) {
            case 'auth/email-already-in-use':
                description = 'This email is already in use. Please try logging in or use a different email.';
                break;
            case 'auth/invalid-email':
                description = 'The email address is not valid.';
                break;
            case 'auth/weak-password':
                description = 'The password is too weak. Please use a stronger password.';
                break;
        }
        toast({
            title: 'Sign-up Failed',
            description,
            variant: 'destructive',
        });
    });
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  // CRITICAL: Call signInWithEmailAndPassword directly. Do NOT use 'await signInWithEmailAndPassword(...)'.
  signInWithEmailAndPassword(authInstance, email, password)
    .catch((error) => {
      let description = 'An unexpected error occurred. Please try again.';
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          description = 'Invalid email or password. Please check your credentials and try again.';
          break;
        case 'auth/invalid-email':
          description = 'The email address is not valid.';
          break;
        case 'auth/too-many-requests':
          description = 'Access to this account has been temporarily disabled due to many failed login attempts. You can try again later.';
          break;
        case 'auth/user-disabled':
          description = 'This user account has been disabled.';
          break;
      }
      toast({
        title: 'Login Failed',
        description: description,
        variant: 'destructive',
      });
  });
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}
