'use client';

import { createContext, useContext, useMemo } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

const FirebaseContext = createContext<{
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
} | null>(null);

export function FirebaseProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: { firebaseApp: FirebaseApp; auth: Auth; firestore: Firestore };
}) {
  const contextValue = useMemo(() => {
    return value;
  }, [value]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

export const useFirebaseApp = () => useFirebase().firebaseApp;
export const useAuth = () => useFirebase().auth;
export const useFirestore = () => useFirebase().firestore;
