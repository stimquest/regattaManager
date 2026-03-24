
'use client';

import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

import { useAuth } from '@/firebase/provider';

export function useUser() {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      // This can happen in certain testing environments or if Firebase isn't initialized.
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          // User is signed in.
          setUser(user);
          setLoading(false);
        } else {
          // No user, sign in anonymously.
          // The loading state will be set to false by the next onAuthStateChanged event.
          signInAnonymously(auth).catch((error) => {
             console.error('Anonymous sign-in error', error);
             setUser(null);
             setLoading(false); // Stop loading on error
          });
        }
      },
      (error) => {
        console.error('Auth state change error', error);
        setUser(null);
        setLoading(false);
      }
    );
    
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [auth]);

  return { user, loading };
}
