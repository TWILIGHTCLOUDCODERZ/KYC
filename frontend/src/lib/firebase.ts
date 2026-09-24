import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { ENV } from '../config/env';

const firebaseApp = initializeApp({
  apiKey: ENV.FIREBASE_API_KEY,
  authDomain: ENV.FIREBASE_AUTH_DOMAIN,
  projectId: ENV.FIREBASE_PROJECT_ID,
  storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
  appId: ENV.FIREBASE_APP_ID,
});

export const auth = getAuth(firebaseApp);
