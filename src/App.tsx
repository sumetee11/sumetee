import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User as FirebaseUser, signOut, signInWithPopup, GoogleAuthProvider, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, onSnapshot, collection, query, orderBy, where, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { LogIn, LogOut, Trophy, Users, UserPlus, ClipboardCheck, LayoutDashboard, Menu, X, ChevronRight, ShieldCheck, AlertCircle, Bell, Medal, Settings, Check, Eye, EyeOff, Timer, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import CompetitionTypeManagement from './components/CompetitionTypeManagement';
import Dashboard from './components/Dashboard';
import JudgeManagement from './components/JudgeManagement';
import CompetitionManagement from './components/CompetitionManagement';
import TeamManagement from './components/TeamManagement';
import NotificationSystem from './components/NotificationSystem';
import Scoring from './components/Scoring';
import Rankings from './components/Rankings';
import LiveScoreTicker from './components/LiveScoreTicker';
import PendingTeams from './components/PendingTeams';
import Reports from './components/Reports';

// --- Types ---
export type Level = 'primary' | 'junior_high' | 'senior_high';
export type Role = 'admin' | 'judge';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface Member {
  idCard: string;
  nameSname: string;
  birthday: string;
}

export interface Team {
  id?: string;
  teamId?: string;
  name: string;
  school?: string;
  level: Level;
  members: Member[];
  totalScore: number;
  rank: number;
}

export interface UserProfile {
  uid: string;
  judgeId?: string; // ID_Ref for Judges
  adminId?: string; // Login ID for Admins
  password?: string; // Password for Admins
  role: Role;
  levels: string[];
  assignedCompetitions?: string[]; // IDs of specific competitions
  displayName: string;
}

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isJudge: boolean;
  loginJudge: (idRef: string, password: string) => Promise<void>;
  loginAdmin: (adminId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface PopupContextType {
  showPopup: (title: string, message: string, type: 'success' | 'error' | 'confirm', onConfirm?: () => void) => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isJudge: false,
  loginJudge: async () => {},
  loginAdmin: async () => {},
  logout: async () => {},
});

export const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export const PopupContext = createContext<PopupContextType>({
  showPopup: () => {},
});

// --- Components ---

const ToastContainer: React.FC<{ toasts: ToastMessage[]; removeToast: (id: string) => void }> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            className={cn(
              "pointer-events-auto px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px] border",
              toast.type === 'success' ? "bg-white border-green-100 text-green-700" :
              toast.type === 'error' ? "bg-white border-red-100 text-red-700" :
              "bg-white border-blue-100 text-blue-700"
            )}
          >
            {toast.type === 'success' ? <ShieldCheck className="w-6 h-6 text-green-500" /> :
             toast.type === 'error' ? <AlertCircle className="w-6 h-6 text-red-500" /> :
             <Bell className="w-6 h-6 text-blue-500" />}
            <span className="font-bold">{toast.message}</span>
            <button 
              onClick={() => removeToast(toast.id)}
              className="ml-auto text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

const SuccessErrorPopup: React.FC<{ 
  isOpen: boolean; 
  title: string; 
  message: string; 
  type: 'success' | 'error' | 'confirm'; 
  onClose: () => void;
  onConfirm?: () => void;
}> = ({ isOpen, title, message, type, onClose, onConfirm }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-[28px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] max-w-[364px] w-full p-7 text-center"
          >
            <div className={cn(
              "w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center shadow-lg",
              type === 'success' ? "bg-green-100 text-green-600" : 
              type === 'error' ? "bg-red-100 text-red-600" :
              "bg-orange-100 text-orange-600"
            )}>
              {type === 'success' ? <ShieldCheck className="w-10 h-10" /> : 
               type === 'error' ? <AlertCircle className="w-10 h-10" /> :
               <AlertCircle className="w-10 h-10" />}
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-500 mb-8 font-medium">{message}</p>
            
            {type === 'confirm' ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onClose}
                  className="w-full py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold text-lg hover:bg-gray-200 transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => {
                    if (onConfirm) onConfirm();
                    onClose();
                  }}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold text-lg hover:bg-red-700 transition-all shadow-lg shadow-red-100"
                >
                  ยืนยัน
                </button>
              </div>
            ) : (
              <button
                onClick={onClose}
                className={cn(
                  "w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg",
                  type === 'success' 
                    ? "bg-green-600 text-white hover:bg-green-700 shadow-green-100" 
                    : "bg-red-600 text-white hover:bg-red-700 shadow-red-100"
                )}
              >
                เข้าใจแล้ว
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setError(event.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    let displayMessage = error?.message || 'Unknown error';
    let isPermissionError = false;

    try {
      if (displayMessage.startsWith('{')) {
        const errInfo = JSON.parse(displayMessage);
        if (errInfo.error && errInfo.error.includes('permission-denied')) {
          isPermissionError = true;
          displayMessage = `คุณไม่มีสิทธิ์ในการดำเนินการนี้ (${errInfo.operationType} ที่ ${errInfo.path})`;
        }
      }
    } catch (e) {
      // Not a JSON error
    }

    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-red-100">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6 mx-auto">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-red-600 mb-2 text-center">เกิดข้อผิดพลาด</h2>
          <p className="text-gray-600 mb-6 text-center">
            {isPermissionError ? 'สิทธิ์การเข้าถึงไม่ถูกต้อง' : 'ขออภัย ระบบเกิดข้อผิดพลาดบางประการ'}
          </p>
          <div className="bg-gray-50 p-4 rounded-xl text-xs font-mono overflow-auto mb-6 max-h-40 border border-gray-100">
            {displayMessage}
          </div>
          <div className="space-y-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-100"
            >
              โหลดหน้าใหม่
            </button>
            <button 
              onClick={() => {
                localStorage.removeItem('user_profile');
                window.location.href = '/';
              }}
              className="w-full bg-white text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all border border-gray-200"
            >
              กลับหน้าหลัก / ออกจากระบบ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const Navbar = () => {
  const { profile, isAdmin, isJudge, logout } = useContext(AuthContext);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { name: 'แดชบอร์ด', path: '/dashboard', icon: LayoutDashboard, show: !!profile },
    { name: 'บันทึกคะแนน', path: '/scoring', icon: ClipboardCheck, show: !!profile },
    { name: 'ทีมที่ยังไม่ได้แข่ง', path: '/pending-teams', icon: Timer, show: true },
    { name: 'สรุปผลคะแนน', path: '/rankings', icon: Medal, show: true },
    { name: 'รายงานสรุป', path: '/reports', icon: FileText, show: !!profile },
    { name: 'จัดการทีม', path: '/teams', icon: Users, show: isAdmin },
    { name: 'จัดการรายการแข่งขัน', path: '/competitions', icon: ClipboardCheck, show: isAdmin },
    { name: 'จัดการกรรมการ', path: '/judges', icon: UserPlus, show: isAdmin },
    { name: 'ประเภทการแข่งขัน', path: '/competition-types', icon: Trophy, show: isAdmin },
  ];

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-gray-900 hidden sm:block">RobotComp</span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-4">
            {navItems.filter(item => item.show).map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            ))}
            {profile && <NotificationSystem />}
            {profile ? (
              <button
                onClick={handleLogout}
                className="ml-4 flex items-center gap-2 bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                ออกจากระบบ
              </button>
            ) : (
              <Link
                to="/login"
                className="ml-4 flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                เข้าสู่ระบบ
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            {profile && <NotificationSystem />}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-gray-600 p-2"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t border-gray-100 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              {navItems.filter(item => item.show).map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-4 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-xl flex items-center gap-3"
                >
                  <item.icon className="w-5 h-5 text-blue-600" />
                  {item.name}
                </Link>
              ))}
              {profile ? (
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-4 text-base font-medium text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-3"
                >
                  <LogOut className="w-5 h-5" />
                  ออกจากระบบ
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-4 text-base font-medium text-blue-600 hover:bg-blue-50 rounded-xl flex items-center gap-3"
                >
                  <LogIn className="w-5 h-5" />
                  เข้าสู่ระบบ
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// --- Pages ---

const Home = () => {
  const [types, setTypes] = useState<any[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubTypes = onSnapshot(collection(db, 'competition_types'), (snapshot) => {
      setTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubComps = onSnapshot(collection(db, 'competitions'), (snapshot) => {
      setCompetitions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubTypes();
      unsubComps();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white pt-16 pb-24 lg:pt-32 lg:pb-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-600 text-sm font-bold mb-6">
                <Trophy className="w-4 h-4" />
                <span>ยินดีต้อนรับสู่ระบบจัดการการแข่งขัน</span>
              </div>
              <h1 className="text-5xl lg:text-7xl font-black text-gray-900 leading-[1.1] mb-6 tracking-tight">
                Robotic <span className="text-blue-600">Arena</span> Challenge
              </h1>
              <p className="text-xl text-gray-600 mb-10 leading-relaxed max-w-xl">
                แพลตฟอร์มบันทึกคะแนน จัดการทีม และรายงานผลการแข่งขันหุ่นยนต์แบบเรียลไทม์ 
                ที่ช่วยให้การบริหารจัดการการแข่งขันเป็นเรื่องง่ายและแม่นยำ
              </p>
              <div className="flex flex-wrap gap-4">
                <Link 
                  to="/rankings"
                  className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center gap-2"
                >
                  <Medal className="w-5 h-5" />
                  ดูอันดับล่าสุด
                </Link>
                <Link 
                  to="/login"
                  className="bg-white text-gray-900 border-2 border-gray-100 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-gray-50 transition-all flex items-center gap-2"
                >
                  <LogIn className="w-5 h-5" />
                  ลงชื่อเข้าใช้งาน
                </Link>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: 5 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="relative"
            >
              <div className="absolute inset-0 bg-blue-600/5 blur-[100px] rounded-full" />
              <div className="relative bg-white p-4 rounded-[40px] shadow-2xl border border-gray-50 overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=1200&h=800"
                  alt="Robot Arena Hero"
                  className="w-full h-auto rounded-[32px] object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              
              {/* Floating Element 1 */}
              <motion.div
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-10 -right-10 bg-white p-6 rounded-3xl shadow-xl border border-gray-50 hidden md:block"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Status</div>
                    <div className="text-lg font-black text-gray-900">Live Scoring</div>
                  </div>
                </div>
              </motion.div>

              {/* Floating Element 2 */}
              <motion.div
                animate={{ y: [0, 20, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -bottom-10 -left-10 bg-white p-6 rounded-3xl shadow-xl border border-gray-50 hidden md:block"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Teams</div>
                    <div className="text-lg font-black text-gray-900">Ready to Compete</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
        
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[600px] h-[600px] bg-blue-50/50 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-50/50 rounded-full blur-[120px] pointer-events-none" />
      </section>

      {/* Competition Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h2 className="text-3xl font-black text-gray-900 mb-2">ระดับการแข่งขัน</h2>
            <p className="text-gray-500">เลือกดูผลการแข่งขันตามระดับชั้นการศึกษา</p>
          </div>
          <Link to="/rankings" className="text-blue-600 font-bold flex items-center gap-2 hover:gap-3 transition-all">
            ดูตารางสรุปคะแนนทั้งหมด <ChevronRight className="w-5 h-5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {types.map((item, idx) => {
            const firstComp = competitions.find(c => c.levelKey === item.key);
            const themeColor = firstComp?.theme || 'blue';
            
            return (
              <motion.div
                key={item.key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 hover:shadow-2xl hover:-translate-y-2 transition-all group"
              >
                <div className={cn(
                  "w-14 h-14 rounded-2xl mb-8 flex items-center justify-center text-white font-bold text-2xl shadow-lg",
                  themeColor === 'blue' ? 'bg-blue-500 shadow-blue-100' : 
                  themeColor === 'purple' ? 'bg-purple-500 shadow-purple-100' : 
                  themeColor === 'orange' ? 'bg-orange-500 shadow-orange-100' : 
                  themeColor === 'emerald' ? 'bg-emerald-500 shadow-emerald-100' : 
                  'bg-rose-500 shadow-rose-100'
                )}>
                  {idx + 1}
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-4">{item.name}</h3>
                <p className="text-gray-500 mb-10 leading-relaxed font-medium">
                  ร่วมติดตามและให้กำลังใจทีมผู้เข้าแข่งขันในระดับ {item.name} บันทึกคะแนนและรายงานผลสด
                </p>
                <Link 
                  to={`/rankings?level=${item.key}`}
                  className={cn(
                    "inline-flex items-center gap-2 font-bold group-hover:gap-4 transition-all px-6 py-3 rounded-xl",
                    themeColor === 'blue' ? 'bg-blue-50 text-blue-600' : 
                    themeColor === 'purple' ? 'bg-purple-50 text-purple-600' : 
                    themeColor === 'orange' ? 'bg-orange-50 text-orange-600' : 
                    themeColor === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 
                    'bg-rose-50 text-rose-600'
                  )}
                >
                  เปิดหน้ารายงานผล <ChevronRight className="w-5 h-5" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

const Login = () => {
  const { user, profile, loading, loginJudge, loginAdmin } = useContext(AuthContext);
  const navigate = useNavigate();
  const [idRef, setIdRef] = useState('');
  const [judgePassword, setJudgePassword] = useState('');
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginType, setLoginType] = useState<'judge' | 'admin'>('judge');
  const [showPassword, setShowPassword] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryId, setRecoveryId] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');

  useEffect(() => {
    if (user && profile && !loading) navigate('/dashboard');
  }, [user, profile, loading, navigate]);

  const handleJudgeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idRef.trim() || !judgePassword.trim()) return;
    
    setIsLoggingIn(true);
    setError('');
    try {
      await loginJudge(idRef.trim(), judgePassword.trim());
    } catch (err: any) {
      setError(err.message || 'รหัสกรรมการหรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId.trim() || !adminPassword.trim()) return;
    
    setIsLoggingIn(true);
    setError('');
    try {
      await loginAdmin(adminId.trim(), adminPassword.trim());
    } catch (err: any) {
      setError(err.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryId.trim()) return;
    
    // In a real app, this would send an email or log a request
    if (recoveryId === 'sumetee11') {
      setRecoveryMessage('เนื่องจากท่านเป็น Super Admin กรุณาตรวจสอบรหัสผ่านในระบบฐานข้อมูลโดยตรง หรือติดต่อผู้พัฒนาระบบ');
    } else {
      setRecoveryMessage('ระบบได้รับคำขอของท่านแล้ว กรุณาติดต่อ Super Admin (sumetee11) เพื่อขอรีเซ็ตรหัสผ่านของท่าน');
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-gray-50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full border border-gray-100"
      >
        <div className="text-center mb-10">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200">
            <LogIn className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">เข้าสู่ระบบ</h2>
          <p className="text-gray-500 mt-2">สำหรับกรรมการและผู้ดูแลระบบ</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-2xl mb-8">
          <button 
            onClick={() => setLoginType('judge')}
            className={cn(
              "flex-1 py-2 rounded-xl text-sm font-bold transition-all",
              loginType === 'judge' ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            กรรมการ
          </button>
          <button 
            onClick={() => setLoginType('admin')}
            className={cn(
              "flex-1 py-2 rounded-xl text-sm font-bold transition-all",
              loginType === 'admin' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            ผู้ดูแลระบบ
          </button>
        </div>

        <div className="space-y-6">
          {loginType === 'judge' ? (
            <form onSubmit={handleJudgeLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">รหัสกรรมการ (ID_Ref)</label>
                <input
                  type="text"
                  value={idRef}
                  onChange={(e) => setIdRef(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all"
                  placeholder="ระบุรหัส ID_Ref ของท่าน"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">รหัสผ่าน</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={judgePassword}
                    onChange={(e) => setJudgePassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-purple-500 rounded-2xl outline-none transition-all pr-12"
                    placeholder="ระบุรหัสผ่าน"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-purple-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 disabled:opacity-50"
              >
                {isLoggingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบกรรมการ'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">ชื่อผู้ใช้ (Admin ID)</label>
                <input
                  type="text"
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all"
                  placeholder="ระบุ Admin ID"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">รหัสผ่าน</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all pr-12"
                    placeholder="ระบุรหัสผ่าน"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end">
                <button 
                  type="button"
                  onClick={() => setShowRecovery(true)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
              >
                {isLoggingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบผู้ดูแล'}
              </button>
            </form>
          )}
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-red-50 text-red-600 text-sm rounded-xl text-center font-medium"
          >
            {error}
          </motion.div>
        )}

        <p className="text-xs text-center text-gray-400 mt-8">
          * เฉพาะผู้ที่ได้รับอนุญาตเท่านั้นที่สามารถเข้าถึงระบบจัดการได้
        </p>
      </motion.div>

      {/* Recovery Modal */}
      <AnimatePresence>
        {showRecovery && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowRecovery(false); setRecoveryMessage(''); }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">กู้คืนรหัสผ่าน</h2>
                <button onClick={() => { setShowRecovery(false); setRecoveryMessage(''); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {!recoveryMessage ? (
                <form onSubmit={handleRecovery} className="space-y-6">
                  <p className="text-gray-500 text-sm">กรุณาระบุ Admin ID ของท่านเพื่อดำเนินการกู้คืนรหัสผ่าน</p>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Admin ID</label>
                    <input
                      type="text"
                      value={recoveryId}
                      onChange={(e) => setRecoveryId(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="ระบุ Admin ID"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                  >
                    ส่งคำขอ
                  </button>
                </form>
              ) : (
                <div className="text-center py-4">
                  <div className="bg-blue-50 p-6 rounded-2xl mb-6">
                    <AlertCircle className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                    <p className="text-blue-800 font-medium">{recoveryMessage}</p>
                  </div>
                  <button
                    onClick={() => { setShowRecovery(false); setRecoveryMessage(''); }}
                    className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all"
                  >
                    ตกลง
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [popup, setPopup] = useState<{ 
    isOpen: boolean; 
    title: string; 
    message: string; 
    type: 'success' | 'error' | 'confirm';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showPopup = (title: string, message: string, type: 'success' | 'error' | 'confirm', onConfirm?: () => void) => {
    setPopup({ isOpen: true, title, message, type, onConfirm });
  };

  // Check for existing session on mount
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      const savedProfile = localStorage.getItem('user_profile');
      
      if (savedProfile) {
        const p = JSON.parse(savedProfile);
        
        if (firebaseUser) {
          // Verify if mapping exists
          const mappingDoc = await getDoc(doc(db, 'users_auth', firebaseUser.uid));
          if (mappingDoc.exists()) {
            setUser({ uid: p.uid, authUid: firebaseUser.uid, isCustom: true });
            setProfile(p);
          } else {
            // Mapping lost, need re-auth
            localStorage.removeItem('user_profile');
            setUser(null);
            setProfile(null);
          }
        } else {
          // Profile exists but not signed in to Firebase Auth
          try {
            const result = await signInAnonymously(auth);
            // Re-bind mapping if needed (complex, better to re-log if anonymous session lost)
            // For now, if no firebaseUser, we clear session to be safe
            localStorage.removeItem('user_profile');
            setUser(null);
            setProfile(null);
          } catch (e: any) {
            if (e.code === 'auth/configuration-not-found') {
              console.error("Firebase Authentication Error: Anonymous Auth is not enabled in Firebase Console. Please enable it in Build > Authentication > Sign-in method.");
            } else {
              console.error("Auto sign-in failed", e);
            }
          }
        }
      }
      setLoading(false);
    });

    // Bootstrap default admin
    const bootstrapAdmin = async () => {
      try {
        const adminId = 'sumetee11';
        const q = query(collection(db, 'users'), where('adminId', '==', adminId), where('role', '==', 'admin'));
        const snap = await getDocs(q);
        if (snap.empty) {
          await setDoc(doc(db, 'users', 'admin_' + adminId), {
            uid: 'admin_' + adminId,
            adminId: adminId,
            password: '123456789',
            role: 'admin',
            levels: ['primary', 'junior_high', 'senior_high'],
            displayName: 'Super Admin'
          });
        }
      } catch (error) {
        console.error('Bootstrap error', error);
      }
    };
    bootstrapAdmin();
  }, []);

  const loginJudge = async (idRef: string, password: string) => {
    setLoading(true);
    try {
      const userDocId = `judge_${idRef.trim()}`;
      const userDoc = await getDoc(doc(db, 'users', userDocId));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.password === password && data.role === 'judge') {
          const p = { uid: userDoc.id, ...data } as UserProfile;
          
          // 1. Sign in to Firebase Auth anonymously to get a token for Rules
          let authResult;
          try {
            authResult = await signInAnonymously(auth);
          } catch (e: any) {
            if (e.code === 'auth/configuration-not-found') {
              throw new Error('ระบบความปลอดภัยขัดข้อง: กรุณาเปิดใช้งาน Anonymous Auth ใน Firebase Console (Authentication > Sign-in method)');
            }
            throw e;
          }
          
          // 2. Map this session in Rules-accessible collection
          await setDoc(doc(db, 'users_auth', authResult.user.uid), {
            role: 'judge',
            profileUid: p.uid,
            password: password, // Required by rules to verify binding
            createdAt: new Date().toISOString()
          });

          setUser({ uid: p.uid, authUid: authResult.user.uid, isCustom: true });
          setProfile(p);
          localStorage.setItem('user_profile', JSON.stringify(p));
        } else {
          throw new Error('รหัสผ่านไม่ถูกต้อง');
        }
      } else {
        throw new Error('ไม่พบข้อมูลกรรมการ');
      }
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const loginAdmin = async (adminId: string, password: string) => {
    setLoading(true);
    try {
      const userDocId = `admin_${adminId.trim()}`;
      const userDoc = await getDoc(doc(db, 'users', userDocId));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.password === password && data.role === 'admin') {
          const p = { uid: userDoc.id, ...data } as UserProfile;
          
          // 1. Sign in to Firebase Auth anonymously to get a token for Rules
          let authResult;
          try {
            authResult = await signInAnonymously(auth);
          } catch (e: any) {
            if (e.code === 'auth/configuration-not-found') {
              throw new Error('ระบบความปลอดภัยขัดข้อง: กรุณาเปิดใช้งาน Anonymous Auth ใน Firebase Console (Authentication > Sign-in method)');
            }
            throw e;
          }
          
          // 2. Map this session in Rules-accessible collection
          await setDoc(doc(db, 'users_auth', authResult.user.uid), {
            role: 'admin',
            profileUid: p.uid,
            password: password, // Required by rules to verify binding
            createdAt: new Date().toISOString()
          });

          setUser({ uid: p.uid, authUid: authResult.user.uid, isCustom: true });
          setProfile(p);
          localStorage.setItem('user_profile', JSON.stringify(p));
        } else {
          throw new Error('รหัสผ่านไม่ถูกต้อง');
        }
      } else {
        throw new Error('ไม่พบข้อมูลผู้ดูแลระบบ');
      }
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (auth.currentUser) {
        await deleteDoc(doc(db, 'users_auth', auth.currentUser.uid));
      }
    } catch (e) {
      console.error("Logout cleanup failed", e);
    }
    localStorage.removeItem('user_profile');
    setUser(null);
    setProfile(null);
    await signOut(auth);
  };

  const isAdmin = profile?.role === 'admin';
  const isJudge = profile?.role === 'judge';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isJudge, loginJudge, loginAdmin, logout }}>
      <ToastContext.Provider value={{ showToast }}>
        <PopupContext.Provider value={{ showPopup }}>
          <ErrorBoundary>
            <Router>
              <div className="min-h-screen bg-white font-sans text-gray-900">
                <Navbar />
                <LiveScoreTicker />
                <main>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/dashboard" element={profile ? <Dashboard /> : <Navigate to="/login" />} />
                    <Route path="/competition-types" element={isAdmin ? <CompetitionTypeManagement /> : <Navigate to="/login" />} />
                    <Route path="/competitions" element={isAdmin ? <CompetitionManagement /> : <Navigate to="/login" />} />
                    <Route path="/teams" element={isAdmin ? <TeamManagement /> : <Navigate to="/login" />} />
                    <Route path="/scoring" element={profile ? <Scoring /> : <Navigate to="/login" />} />
                    <Route path="/rankings" element={<Rankings />} />
                    <Route path="/pending-teams" element={<PendingTeams />} />
                    <Route path="/reports" element={profile ? <Reports /> : <Navigate to="/login" />} />
                    <Route path="/judges" element={isAdmin ? <JudgeManagement /> : <Navigate to="/login" />} />
                    
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </main>
                <ToastContainer toasts={toasts} removeToast={removeToast} />
                <SuccessErrorPopup 
                  isOpen={popup.isOpen}
                  title={popup.title}
                  message={popup.message}
                  type={popup.type}
                  onConfirm={popup.onConfirm}
                  onClose={() => setPopup(prev => ({ ...prev, isOpen: false }))}
                />
              </div>
            </Router>
          </ErrorBoundary>
        </PopupContext.Provider>
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}
