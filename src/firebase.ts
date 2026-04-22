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

export async function testConnection() {
  try {
    console.log("Attempting to connect to Firestore...", {
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId || '(default)'
    });
    
    // Check if we can reach the database
    // We use a short timeout to avoid hanging if the project is in a bad state
    const testDoc = doc(db, 'connection_test', 'status');
    const promise = getDocFromServer(testDoc);
    
    // Add a race condition to prevent long hangs
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    );

    await Promise.race([promise, timeoutPromise]);
    
    isFirebaseConnected = true;
    connectionError = null;
    console.log("Firebase connection established successfully.");
    return { isConnected: true, error: null };
  } catch (error) {
    console.error("Detailed Firebase connection error:", error);
    
    if (error instanceof Error) {
      if (error.message.includes('permission-denied')) {
        // This is actually a good sign - it means we CONNECTED, but the rules blocked us.
        isFirebaseConnected = true; 
        connectionError = null;
        console.log("Firebase connected (confirmed via permission-denied).");
        return { isConnected: true, error: null };
      }
      
      isFirebaseConnected = false;
      connectionError = error.message;
      
      if (error.message.includes('the client is offline') || error.message.includes('Connection timeout')) {
        console.error("Firestore client is offline or timed out. This often means the project is not provisioned correctly. Please refresh the page and re-accept Firebase terms if prompted.");
        isFirebaseConnected = false;
        connectionError = "ระบบฐานข้อมูลยังไม่พร้อมใช้งาน (Project desync). กรุณารีเฟรชหน้าจอและกดยอมรับการตั้งค่า Firebase อีกครั้ง";
      } else if (error.message.includes('database was deleted') || error.message.includes('not found')) {
        console.error("The specified database was not found or deleted. Please check your firestoreDatabaseId in firebase-applet-config.json or run set_up_firebase again.");
      }
    }
    return { isConnected: false, error: connectionError };
  }
}
testConnection();

export const getFirebaseStatus = () => ({ isConnected: isFirebaseConnected, error: connectionError });

export default app;
