
'use client';

import { useEffect, useState, useRef } from 'react';
import {
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  startAt,
  endAt,
  type Query,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { emitFirestoreError } from '@/firebase/errors';

export type CollectionOptions = {
  where?: [string, '==', any];
  orderBy?: [string, 'asc' | 'desc'];
  limit?: number;
  startAt?: any;
  endAt?: any;
};

export const useCollection = <T extends DocumentData>(
  collectionQuery: Query<T> | null,
  options?: CollectionOptions
) => {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);

  const optionsRef = useRef(options);

  useEffect(() => {
    if (!collectionQuery) {
      setLoading(false);
      return;
    }

    setLoading(true); // Start loading when query is valid

    let q = collectionQuery;
    const currentOptions = optionsRef.current;

    if (currentOptions?.where) {
      q = query(q, where(...currentOptions.where));
    }
    if (currentOptions?.orderBy) {
      q = query(q, orderBy(...currentOptions.orderBy));
    }
    if (currentOptions?.limit) {
      q = query(q, limit(currentOptions.limit));
    }
    if (currentOptions?.startAt) {
      q = query(q, startAt(currentOptions.startAt));
    }
    if (currentOptions?.endAt) {
      q = query(q, endAt(currentOptions.endAt));
    }

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map(
          (doc) => ({ ...doc.data(), id: doc.id } as T)
        );
        setData(docs);
        setLoading(false);
      },
      (err) => {
        emitFirestoreError(err, {
          path: (q as any)._path?.path, // Internal property but useful
          operation: 'list',
        });
        setData(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionQuery]); // Re-run effect only when the query object itself changes

  return { data, loading };
};
