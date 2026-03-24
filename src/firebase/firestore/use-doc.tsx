
'use client';

import { useEffect, useState } from 'react';
import {
  onSnapshot,
  type DocumentReference,
  type DocumentData,
} from 'firebase/firestore';
import { emitFirestoreError } from '@/firebase/errors';

export const useDoc = <T extends DocumentData>(
  docRef: DocumentReference<T> | null
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!docRef) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData({ ...snapshot.data(), id: snapshot.id } as T);
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        emitFirestoreError(err, {
          path: docRef.path,
          operation: 'get',
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [docRef]);

  return { data, loading };
};
