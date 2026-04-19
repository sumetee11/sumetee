import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export let isFirebaseConnected = true;
let connectionError: string | null = null;

async function testConnection() {
  try {
    // Try to get a non-existent doc in the connection_test collection to test connectivity
    await getDocFromServer(doc(db, 'connection_test', 'status'));
    isFirebaseConnected = true;
    connectionError = null;
    console.log("Firebase connection established successfully.");
  } catch (error) {
    console.error("Firebase connection error:", error);
    isFirebaseConnected = false;
    if (error instanceof Error) {
      connectionError = error.message;
      if (error.message.includes('the client is offline')) {
        console.error("Firestore client is offline. Possible causes: Firewall, incorrect Database ID, or Firestore not provisioned.");
      }
    }
  }
}
testConnection();

export const getFirebaseStatus = () => ({ isConnected: isFirebaseConnected, error: connectionError });

export default app;
