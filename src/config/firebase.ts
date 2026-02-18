import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// TODO: Replace with your actual Firebase project config
// Go to Firebase Console > Project Settings > General > Your apps > Web app
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDtsl6sIaPupv_T8JYXKwUuK-_ENo14CaY",
  authDomain: "movistarkoi.firebaseapp.com",
  projectId: "movistarkoi",
  storageBucket: "movistarkoi.firebasestorage.app",
  messagingSenderId: "183863992162",
  appId: "1:183863992162:web:7a2b734cb3230fbd92d63b"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
