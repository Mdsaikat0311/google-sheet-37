import firebaseConfigJson from '../../firebase-applet-config.json';

// Fallback and typed config loader for Firebase Auth
export interface AppFirebaseConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
}

export const getFirebaseConfig = (): AppFirebaseConfig => {
  const envApiKey = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_FIREBASE_API_KEY : undefined;

  if (firebaseConfigJson && firebaseConfigJson.projectId) {
    return {
      projectId: firebaseConfigJson.projectId,
      appId: firebaseConfigJson.appId,
      apiKey: envApiKey || firebaseConfigJson.apiKey || '',
      authDomain: firebaseConfigJson.authDomain,
      storageBucket: firebaseConfigJson.storageBucket,
      messagingSenderId: firebaseConfigJson.messagingSenderId,
    };
  }

  return {
    projectId: '',
    appId: '',
    apiKey: envApiKey || '',
    authDomain: '',
    storageBucket: '',
    messagingSenderId: '',
  };
};
