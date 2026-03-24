'use client';

import {
  type FirebaseApp,
  getApp,
  getApps,
  initializeApp,
} from 'firebase/app';
import { type Auth, getAuth } from 'firebase/auth';
import { type Firestore, getFirestore, initializeFirestore, persistentLocalCache } from 'firebase/firestore';

import { getFirebaseConfig } from '@/firebase/config';

export function initializeFirebase(): {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
} {
  const firebaseConfig = getFirebaseConfig();
  if (getApps().length === 0) {
    const firebaseApp = initializeApp(firebaseConfig);
    const auth = getAuth(firebaseApp);
    let firestore: Firestore;
    if (typeof window !== 'undefined') {
      firestore = initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache()
      });
    } else {
      firestore = getFirestore(firebaseApp);
    }
    return { firebaseApp, auth, firestore };
  } else {
    const firebaseApp = getApp();
    const auth = getAuth(firebaseApp);
    const firestore = getFirestore(firebaseApp);
    return { firebaseApp, auth, firestore };
  }
}

export * from '@/firebase/provider';
export * from '@/firebase/auth/use-user';
export * from '@/firebase/firestore/use-collection';
export * from '@/firebase/firestore/use-doc';
