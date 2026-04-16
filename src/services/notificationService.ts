import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type TargetRole = 'all' | 'admin' | 'judge';

export interface NotificationData {
  title: string;
  message: string;
  type: NotificationType;
  targetRole: TargetRole;
  targetUid?: string;
}

export const sendNotification = async (data: NotificationData) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      ...data,
      createdAt: serverTimestamp(),
      readBy: []
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};
