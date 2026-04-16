import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext, UserProfile, Level } from '../App';
import { sendNotification } from '../services/notificationService';
import { UserPlus, Trash2, Edit3, X, Check, AlertCircle, Shield, Trophy, Search, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';

interface CompetitionType {
  key: string;
  name: string;
}

interface Competition {
  id: string;
  name: string;
  levelKey: string;
}

export default function JudgeManagement() {
  const { isAdmin } = useContext(AuthContext);
  const [judges, setJudges] = useState<UserProfile[]>([]);
  const [competitionTypes, setCompetitionTypes] = useState<CompetitionType[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJudge, setEditingJudge] = useState<UserProfile | null>(null);
  const [search, setSearch] = useState('');
  
  const [formData, setFormData] = useState({
    judgeId: '',
    password: '',
    displayName: '',
    levels: [] as string[],
    assignedCompetitions: [] as string[]
  });
  const [error, setError] = useState('');

  useEffect(() => {
    // Listen to judges
    const qJudges = query(collection(db, 'users'), where('role', '==', 'judge'));
    const unsubJudges = onSnapshot(qJudges, (snapshot) => {
      setJudges(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
      setLoading(false);
    });

    // Listen to competition types
    const unsubTypes = onSnapshot(collection(db, 'competition_types'), (snapshot) => {
      setCompetitionTypes(snapshot.docs.map(doc => doc.data() as CompetitionType));
    });

    // Listen to competitions
    const unsubComps = onSnapshot(collection(db, 'competitions'), (snapshot) => {
      setCompetitions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Competition[]);
    });

    return () => {
      unsubJudges();
      unsubTypes();
      unsubComps();
    };
  }, []);

  const handleOpenModal = (judge?: UserProfile) => {
    if (judge) {
      setEditingJudge(judge);
      setFormData({
        judgeId: judge.judgeId || '',
        password: judge.password || '',
        displayName: judge.displayName || '',
        levels: judge.levels || [],
        assignedCompetitions: judge.assignedCompetitions || []
      });
    } else {
      setEditingJudge(null);
      setFormData({
        judgeId: '',
        password: '',
        displayName: '',
        levels: [],
        assignedCompetitions: []
      });
    }
    setError('');
    setIsModalOpen(true);
  };

  const toggleLevel = (levelKey: string) => {
    setFormData(prev => {
      const newLevels = prev.levels.includes(levelKey)
        ? prev.levels.filter(k => k !== levelKey)
        : [...prev.levels, levelKey];
      
      // If level is removed, also remove its competitions
      const newAssignedComps = prev.assignedCompetitions.filter(compId => {
        const comp = competitions.find(c => c.id === compId);
        return comp && newLevels.includes(comp.levelKey);
      });

      return {
        ...prev,
        levels: newLevels,
        assignedCompetitions: newAssignedComps
      };
    });
  };

  const toggleCompetition = (compId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedCompetitions: prev.assignedCompetitions.includes(compId)
        ? prev.assignedCompetitions.filter(id => id !== compId)
        : [...prev.assignedCompetitions, compId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.judgeId.trim() || !formData.password.trim() || !formData.displayName.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      const uid = editingJudge?.uid || `judge_${formData.judgeId.trim()}`;
      
      // Check if judgeId already exists (only for new judges)
      if (!editingJudge) {
        const q = query(collection(db, 'users'), where('judgeId', '==', formData.judgeId.trim()));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setError('รหัสกรรมการนี้มีอยู่ในระบบแล้ว');
          return;
        }
      }

      await setDoc(doc(db, 'users', uid), {
        uid,
        judgeId: formData.judgeId.trim(),
        password: formData.password.trim(),
        displayName: formData.displayName.trim(),
        role: 'judge',
        levels: formData.levels,
        assignedCompetitions: formData.assignedCompetitions
      }, { merge: true });

      if (!editingJudge) {
        await sendNotification({
          title: 'เพิ่มกรรมการใหม่',
          message: `กรรมการ "${formData.displayName}" ได้รับการเพิ่มเข้าสู่ระบบ`,
          type: 'info',
          targetRole: 'admin'
        });
      } else {
        await sendNotification({
          title: 'อัปเดตการมอบหมายงาน',
          message: `มีการอัปเดตรายการแข่งขันที่รับผิดชอบสำหรับคุณ`,
          type: 'info',
          targetRole: 'judge',
          targetUid: uid
        });
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleDelete = async (uid: string) => {
    if (!window.confirm('คุณต้องการลบกรรมการท่านนี้ใช่หรือไม่?')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
    }
  };

  const filteredJudges = judges.filter(j => 
    j.displayName.toLowerCase().includes(search.toLowerCase()) ||
    j.judgeId?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <UserPlus className="w-8 h-8 text-blue-600" />
            จัดการกรรมการ (Judge Management)
          </h1>
          <p className="text-gray-500 mt-1">เพิ่ม แก้ไข และมอบหมายระดับการแข่งขันให้กรรมการ</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          เพิ่มกรรมการใหม่
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="ค้นหาชื่อกรรมการหรือรหัส..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-bold">
                <th className="px-8 py-4">รหัสกรรมการ</th>
                <th className="px-8 py-4">ชื่อ-นามสกุล</th>
                <th className="px-8 py-4">ระดับที่รับผิดชอบ</th>
                <th className="px-8 py-4 text-right">เครื่องมือ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredJudges.map((judge) => (
                <tr key={judge.uid} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="font-mono font-bold text-blue-600">{judge.judgeId}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="font-bold text-gray-900">{judge.displayName}</div>
                    <div className="text-xs text-gray-400">Password: {judge.password}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap gap-1">
                        {judge.levels?.map(levelKey => {
                          const type = competitionTypes.find(t => t.key === levelKey);
                          return (
                            <span key={levelKey} className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full text-[9px] font-bold uppercase border border-purple-100">
                              {type?.name || levelKey}
                            </span>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {judge.assignedCompetitions?.map(compId => {
                          const comp = competitions.find(c => c.id === compId);
                          return (
                            <span key={compId} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-bold border border-blue-100">
                              {comp?.name || compId}
                            </span>
                          );
                        })}
                      </div>
                      {(!judge.levels || judge.levels.length === 0) && (!judge.assignedCompetitions || judge.assignedCompetitions.length === 0) && (
                        <span className="text-gray-300 text-xs italic">ยังไม่ได้มอบหมาย</span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleOpenModal(judge)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(judge.uid)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredJudges.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-gray-400 italic">
                    ไม่พบข้อมูลกรรมการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingJudge ? 'แก้ไขข้อมูลกรรมการ' : 'เพิ่มกรรมการใหม่'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">รหัสกรรมการ (Judge ID / ID_Ref)</label>
                    <input
                      type="text"
                      value={formData.judgeId}
                      onChange={(e) => setFormData({ ...formData, judgeId: e.target.value })}
                      disabled={!!editingJudge}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-mono disabled:opacity-50"
                      placeholder="เช่น J001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">รหัสผ่าน (Password)</label>
                    <input
                      type="text"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="กำหนดรหัสผ่าน"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">ชื่อ-นามสกุล</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ระบุชื่อ-นามสกุลกรรมการ"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-4">มอบหมายระดับและรายการแข่งขัน</label>
                  <div className="space-y-6">
                    {competitionTypes.map((type) => (
                      <div key={type.key} className="space-y-3">
                        <button
                          type="button"
                          onClick={() => toggleLevel(type.key)}
                          className={cn(
                            "w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left",
                            formData.levels.includes(type.key)
                              ? "border-purple-600 bg-purple-50 text-purple-700"
                              : "border-gray-50 bg-gray-50 text-gray-500 hover:border-gray-200"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Trophy className={cn("w-5 h-5", formData.levels.includes(type.key) ? "text-purple-600" : "text-gray-300")} />
                            <span className="font-bold text-sm">{type.name}</span>
                          </div>
                          {formData.levels.includes(type.key) && <Check className="w-5 h-5" />}
                        </button>

                        {formData.levels.includes(type.key) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4">
                            {competitions.filter(c => c.levelKey === type.key).map(comp => (
                              <button
                                key={comp.id}
                                type="button"
                                onClick={() => toggleCompetition(comp.id)}
                                className={cn(
                                  "flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left text-xs",
                                  formData.assignedCompetitions.includes(comp.id)
                                    ? "border-blue-500 bg-blue-50 text-blue-700 font-bold"
                                    : "border-gray-50 bg-white text-gray-400 hover:border-gray-200"
                                )}
                              >
                                <span>{comp.name}</span>
                                {formData.assignedCompetitions.includes(comp.id) && <Check className="w-4 h-4" />}
                              </button>
                            ))}
                            {competitions.filter(c => c.levelKey === type.key).length === 0 && (
                              <div className="col-span-full text-xs text-gray-400 italic py-2">
                                ยังไม่มีรายการแข่งขันในระดับนี้
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <div className="flex gap-4 pt-4 sticky bottom-0 bg-white pb-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                  >
                    <Check className="w-6 h-6" />
                    บันทึกข้อมูล
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
