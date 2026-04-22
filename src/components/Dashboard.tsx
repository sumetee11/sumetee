import React, { useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, getDocs, writeBatch, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext, ToastContext } from '../App';
import { Trophy, ShieldCheck, User, LayoutDashboard, ChevronRight, AlertCircle, ClipboardCheck, Medal, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { profile, isAdmin, isJudge } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const [competitionTypes, setCompetitionTypes] = useState<any[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const unsubTypes = onSnapshot(collection(db, 'competition_types'), (snapshot) => {
      setCompetitionTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

  const handleResetScores = async () => {
    setIsResetting(true);
    try {
      const scoresSnap = await getDocs(collection(db, 'scores'));
      if (scoresSnap.empty) {
        showToast('ไม่มีข้อมูลคะแนนให้รีเซ็ต', 'info');
        setShowResetConfirm(false);
        return;
      }

      // Batch delete scores
      const batchSize = 500;
      const docs = scoresSnap.docs;
      
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + batchSize);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      // Log the reset
      await addDoc(collection(db, 'notifications'), {
        title: 'ระบบมีการรีเซ็ตคะแนน',
        message: `คะแนนทั้งหมดถูกรีเซ็ตโดยผู้ดูแลระบบ (${profile?.displayName}). เริ่มต้นรอบการแข่งขันใหม่`,
        type: 'warning',
        targetRole: 'all',
        createdAt: serverTimestamp(),
        readBy: []
      });

      showToast('รีเซ็ตคะแนนทั้งหมดเรียบร้อยแล้ว', 'success');
      setShowResetConfirm(false);
    } catch (error: any) {
      console.error('Error resetting scores:', error);
      showToast('เกิดข้อผิดพลาดในการรีเซ็ตคะแนน', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-blue-600" />
          แผงควบคุม (Dashboard)
        </h1>
        <p className="text-gray-500 mt-1">ยินดีต้อนรับกลับมา, {profile?.displayName}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex flex-col items-center text-center">
              <div className={cn(
                "w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-lg",
                isAdmin ? "bg-blue-600 shadow-blue-100" : "bg-purple-600 shadow-purple-100"
              )}>
                {isAdmin ? <ShieldCheck className="w-10 h-10 text-white" /> : <User className="w-10 h-10 text-white" />}
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{profile?.displayName}</h2>
              <p className="text-gray-500 font-medium uppercase tracking-wider text-xs mt-1">
                {isAdmin ? 'ผู้ดูแลระบบ (Administrator)' : 'กรรมการ (Judge)'}
              </p>
              
              <div className="w-full mt-8 pt-8 border-t border-gray-50 space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">ID:</span>
                  <span className="font-mono font-bold text-gray-700">{isAdmin ? profile?.adminId : profile?.judgeId}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">สถานะ:</span>
                  <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full font-bold text-[10px] uppercase">Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          {isJudge && (
            <div className="space-y-8">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-purple-600" />
                  ระดับการแข่งขันที่รับผิดชอบ
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profile?.levels.map((levelKey) => {
                    const type = competitionTypes.find(t => t.key === levelKey);
                    return (
                      <div key={levelKey} className="p-6 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between group hover:bg-purple-50 hover:border-purple-100 transition-all">
                        <div>
                          <div className="font-bold text-gray-900">{type?.name || levelKey}</div>
                          <div className="text-xs text-gray-400 font-mono uppercase mt-1">{levelKey}</div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-purple-500 transition-colors" />
                      </div>
                    );
                  })}
                  {(!profile?.levels || profile.levels.length === 0) && (
                    <div className="col-span-full p-8 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                      <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 italic">ยังไม่ได้รับมอบหมายระดับการแข่งขัน</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-blue-600" />
                  รายการแข่งขันที่ได้รับมอบหมาย
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {profile?.assignedCompetitions?.map((compId) => {
                    const comp = competitions.find(c => c.id === compId);
                    const type = competitionTypes.find(t => t.key === comp?.levelKey);
                    return (
                      <div key={compId} className="p-6 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between group hover:bg-blue-50 hover:border-blue-100 transition-all">
                        <div>
                          <div className="font-bold text-gray-900">{comp?.name || compId}</div>
                          <div className="text-[10px] text-blue-600 font-bold uppercase mt-1 bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                            {type?.name || comp?.levelKey}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                      </div>
                    );
                  })}
                  {(!profile?.assignedCompetitions || profile.assignedCompetitions.length === 0) && (
                    <div className="col-span-full p-8 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                      <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 italic">ยังไม่ได้รับมอบหมายรายการแข่งขันเฉพาะ</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  ภาพรวมระบบ (System Overview)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl bg-blue-50 border border-blue-100">
                    <div className="text-blue-600 font-black text-3xl mb-1">{competitionTypes.length}</div>
                    <div className="text-sm font-bold text-blue-800">ประเภทการแข่งขัน</div>
                  </div>
                  <Link to="/rankings" className="p-6 rounded-2xl bg-yellow-50 border border-yellow-100 group hover:bg-yellow-100 transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-yellow-600 font-black text-3xl mb-1">
                          <Medal className="w-8 h-8" />
                        </div>
                        <div className="text-sm font-bold text-yellow-800">ดูอันดับคะแนน</div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-yellow-400 group-hover:text-yellow-600 transition-colors" />
                    </div>
                  </Link>
                </div>
              </div>

              <div className="bg-red-50 p-8 rounded-3xl border border-red-100">
                <div className="flex items-start gap-4">
                  <div className="bg-red-100 p-3 rounded-2xl">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-red-900">พื้นที่อันตราย (Danger Zone)</h4>
                    <p className="text-red-700 text-sm mt-1">การรีเซ็ตคะแนนจะลบข้อมูลการบันทึกคะแนนทั้งหมดในระบบเพื่อเริ่มการแข่งขันรอบใหม่</p>
                    <button
                      onClick={() => setShowResetConfirm(true)}
                      className="mt-4 flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                    >
                      <Trash2 className="w-4 h-4" />
                      รีเซ็ตคะแนนทั้งหมด
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isResetting && setShowResetConfirm(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 overflow-hidden"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">ยืนยันการรีเซ็ตคะแนน?</h2>
                <p className="text-gray-500 mt-2">
                  ข้อมูลการบันทึกคะแนนทั้งหมดจะถูกลบอย่างถาวร 
                  การดำเนินการนี้ไม่สามารถย้อนกลับได้
                </p>
              </div>

              <div className="space-y-3">
                <button
                  disabled={isResetting}
                  onClick={handleResetScores}
                  className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50"
                >
                  {isResetting ? 'กำลังลบข้อมูล...' : 'ใช่, ต้องการรีเซ็ตทั้งหมด'}
                </button>
                <button
                  disabled={isResetting}
                  onClick={() => setShowResetConfirm(false)}
                  className="w-full bg-gray-50 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-100 transition-all"
                >
                  ยกเลิก
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
