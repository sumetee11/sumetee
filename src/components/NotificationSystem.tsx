import React, { useState, useEffect, useContext } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, arrayUnion, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../App';
import { Bell, X, Info, CheckCircle, AlertTriangle, AlertCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  targetRole: 'all' | 'admin' | 'judge';
  targetUid?: string;
  createdAt: any;
  readBy: string[];
}

export default function NotificationSystem() {
  const { profile } = useContext(AuthContext);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'notifications'),
      where('targetRole', 'in', ['all', profile.role]),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];

      // Filter for specific targetUid if present
      const filtered = fetchedNotifications.filter(n => !n.targetUid || n.targetUid === profile.uid);
      
      setNotifications(filtered);
      setUnreadCount(filtered.filter(n => !n.readBy.includes(profile.uid)).length);
    });

    return unsubscribe;
  }, [profile]);

  const markAsRead = async (id: string) => {
    if (!profile) return;
    const notification = notifications.find(n => n.id === id);
    if (notification && !notification.readBy.includes(profile.uid)) {
      await updateDoc(doc(db, 'notifications', id), {
        readBy: arrayUnion(profile.uid)
      });
    }
  };

  const markAllAsRead = async () => {
    if (!profile) return;
    const unread = notifications.filter(n => !n.readBy.includes(profile.uid));
    for (const n of unread) {
      await markAsRead(n.id);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short'
    }).format(date);
  };

  if (!profile) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-[60]" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-gray-100 z-[70] overflow-hidden"
            >
              <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-600" />
                  การแจ้งเตือน
                </h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    อ่านทั้งหมด
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={cn(
                          "p-4 hover:bg-gray-50 transition-colors cursor-pointer flex gap-4",
                          !n.readBy.includes(profile.uid) && "bg-blue-50/30"
                        )}
                      >
                        <div className="mt-1">{getIcon(n.type)}</div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="text-sm font-bold text-gray-900 leading-tight">{n.title}</h4>
                            <div className="text-[10px] text-gray-400 flex items-center gap-1 whitespace-nowrap">
                              <Clock className="w-3 h-3" />
                              {formatTime(n.createdAt)}
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 mt-1 leading-relaxed">{n.message}</p>
                        </div>
                        {!n.readBy.includes(profile.uid) && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center">
                    <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Bell className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-400 text-sm italic">ไม่มีการแจ้งเตือนในขณะนี้</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
