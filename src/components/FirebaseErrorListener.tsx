
'use client';

import React, { useEffect, useState } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import type { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

// This component is only active in development to avoid exposing detailed errors in production.
export function FirebaseErrorListener() {
  const { toast } = useToast();
  const [permissionError, setPermissionError] =
    useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      console.error('Caught Firestore Permission Error:', error.toJSON());
      setPermissionError(error);
      
      // Optionally show a generic toast to the user
      toast({
        variant: 'destructive',
        title: 'Erreur de permission',
        description: "Vous n'avez pas les droits pour effectuer cette action.",
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  // In development, throw the error to let Next.js display its overlay
  if (process.env.NODE_ENV === 'development' && permissionError) {
    // Throwing the error will be caught by the Next.js error overlay
    throw permissionError;
  }

  // In production, you might render a fallback UI or nothing at all
  return null;
}
