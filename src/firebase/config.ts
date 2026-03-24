// The value of `firebaseConfig` is provided by the Firebase tooling.
const firebaseConfig = {
  apiKey: "AIzaSyBcivESQKZamzFsH7wTqtSC8hJt-MZp86A",
  authDomain: "studio-1999493155-7f8d2.firebaseapp.com",
  projectId: "studio-1999493155-7f8d2",
  storageBucket: "studio-1999493155-7f8d2.firebasestorage.app",
  messagingSenderId: "160459304733",
  appId: "1:160459304733:web:d8f0a0225c6b6e7f87bbf4"
};

export function getFirebaseConfig() {
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    throw new Error(
      "No Firebase configuration object provided." +
        "Add your web app's configuration object to src/firebase/config.ts"
    );
  }
  return firebaseConfig;
}
