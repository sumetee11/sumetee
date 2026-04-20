import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// Initialize Firestore with better defaults
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

export let isFirebaseConnected = true;
let connectionError: string | null = null;

async function testConnection() {
  try {
    console.log("Attempting to connect to Firestore...", {
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId || '(default)'
    });
    
    // Use a very short timeout for the connection test to fail fast during dev
    const testDoc = doc(db, 'connection_test', 'status');
    const snapshot = await getDocFromServer(testDoc);
    
    isFirebaseConnected = true;
    connectionError = null;
    console.log("Firebase connection established successfully.");
  } catch (error) {
    console.error("Detailed Firebase connection error:", error);
    isFirebaseConnected = false;
    
    if (error instanceof Error) {
      connectionError = error.message;
      if (error.message.includes('the client is offline')) {
        console.error("Firestore client is offline. This usually means the Firestore API is not enabled in your project, the Database ID is incorrect, or your network is blocking the connection.");
      } else if (error.message.includes('permission-denied')) {
        // This is actually a good sign - it means we CONNECTED, but the rules blocked us.
        isFirebaseConnected = true; 
        connectionError = null;
        console.log("Firebase connected (confirmed via permission-denied).");
      }
    }
  }
}
testConnection();

export const getFirebaseStatus = () => ({ isConnected: isFirebaseConnected, error: connectionError });

export default app;
