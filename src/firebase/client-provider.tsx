
'use client';

import { initializeFirebase } from '@/firebase';
import { FirebaseProvider, useUser } from '@/firebase';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import Loading from '@/app/loading';

// This component handles waiting for the user to be authenticated.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading } = useUser();

  if (loading) {
    return <Loading />;
  }

  return <>{children}</>;
}


export default function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { firebaseApp, auth, firestore } = initializeFirebase();

  return (
    <FirebaseProvider value={{ firebaseApp, auth, firestore }}>
      <AuthGate>
        {children}
      </AuthGate>
      <FirebaseErrorListener />
    </FirebaseProvider>
  );
}
