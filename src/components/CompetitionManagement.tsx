import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext, ToastContext } from '../App';
import { sendNotification } from '../services/notificationService';
import { ClipboardCheck, Plus, Trash2, Edit3, X, Check, AlertCircle, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';

interface CustomMission {
  id: string;
  name: string;
  points: number;
  type: 'count' | 'toggle';
}

interface Competition {
  id: string;
  name: string;
  levelKey: string;
  theme?: 'blue' | 'purple' | 'orange' | 'emerald' | 'rose';
  maxScore?: number;
  missions?: CustomMission[];
}

interface CompetitionType {
  key: string;
  name: string;
}

export default function CompetitionManagement() {
  const { isAdmin } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionTypes, setCompetitionTypes] = useState<CompetitionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingComp, setEditingComp] = useState<Competition | null>(null);
  const [formData, setFormData] = useState<Omit<Competition, 'id'>>({ 
    name: '', 
    levelKey: '',
    theme: 'blue',
    maxScore: 100,
    missions: []
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubComps = onSnapshot(collection(db, 'competitions'), (snapshot) => {
      setCompetitions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Competition[]);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'competitions');
    });

    const unsubTypes = onSnapshot(collection(db, 'competition_types'), (snapshot) => {
      setCompetitionTypes(snapshot.docs.map(doc => doc.data() as CompetitionType));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'competition_types');
    });

    return () => {
      unsubComps();
      unsubTypes();
    };
  }, []);

  const handleOpenModal = (comp?: Competition) => {
    if (comp) {
      setEditingComp(comp);
      setFormData({ 
        name: comp.name, 
        levelKey: comp.levelKey,
        theme: comp.theme || 'blue',
        maxScore: comp.maxScore || 100,
        missions: comp.missions || []
      });
    } else {
      setEditingComp(null);
      setFormData({ 
        name: '', 
        levelKey: competitionTypes[0]?.key || '',
        theme: 'blue',
        maxScore: 100,
        missions: [
          { id: Math.random().toString(36).substr(2, 9), name: 'วางกระป๋อง', points: 10, type: 'count' }
        ]
      });
    }
    setError('');
    setIsModalOpen(true);
  };

  const addMission = () => {
    setFormData({
      ...formData,
      missions: [
        ...(formData.missions || []),
        { id: Math.random().toString(36).substr(2, 9), name: '', points: 10, type: 'count' }
      ]
    });
  };

  const removeMission = (id: string) => {
    setFormData({
      ...formData,
      missions: (formData.missions || []).filter(m => m.id !== id)
    });
  };

  const updateMission = (id: string, updates: Partial<CustomMission>) => {
    setFormData({
      ...formData,
      missions: (formData.missions || []).map(m => m.id === id ? { ...m, ...updates } : m)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.levelKey) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      if (editingComp) {
        await setDoc(doc(db, 'competitions', editingComp.id), formData);
        showToast('อัปเดตรายการแข่งขันสำเร็จ', 'success');
      } else {
        await addDoc(collection(db, 'competitions'), formData);
        showToast('เพิ่มรายการแข่งขันใหม่สำเร็จ', 'success');
        await sendNotification({
          title: 'รายการแข่งขันใหม่',
          message: `มีการเพิ่มรายการแข่งขัน "${formData.name}" ในระบบ`,
          type: 'success',
          targetRole: 'all'
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, editingComp ? OperationType.UPDATE : OperationType.CREATE, editingComp ? `competitions/${editingComp.id}` : 'competitions');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('คุณต้องการลบรายการแข่งขันนี้ใช่หรือไม่?')) return;
    try {
      await deleteDoc(doc(db, 'competitions', id));
      showToast('ลบรายการแข่งขันสำเร็จ', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `competitions/${id}`);
      showToast('ไม่สามารถลบรายการแข่งขันได้', 'error');
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-blue-600" />
            จัดการรายการแข่งขัน
          </h1>
          <p className="text-gray-500 mt-1">กำหนดหัวข้อการแข่งขันในแต่ละระดับ</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          เพิ่มรายการใหม่
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {competitionTypes.map(type => (
          <div key={type.key} className="space-y-4">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 px-2">
              <Trophy className="w-4 h-4" />
              {type.name}
            </h2>
            <div className="space-y-3">
              {competitions.filter(c => c.levelKey === type.key).map(comp => (
                <motion.div
                  key={comp.id}
                  layout
                  className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center group hover:shadow-md transition-all"
                >
                  <div className="font-bold text-gray-900">{comp.name}</div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenModal(comp)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(comp.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
              {competitions.filter(c => c.levelKey === type.key).length === 0 && (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100 text-gray-400 text-sm italic">
                  ยังไม่มีรายการแข่งขัน
                </div>
              )}
            </div>
          </div>
        ))}
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
              className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 my-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingComp ? 'แก้ไขรายการแข่งขัน' : 'เพิ่มรายการแข่งขัน'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">ระดับการแข่งขัน</label>
                    <select
                      value={formData.levelKey}
                      onChange={(e) => setFormData({ ...formData, levelKey: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                    >
                      {competitionTypes.map(type => (
                        <option key={type.key} value={type.key}>{type.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">ชื่อรายการแข่งขัน</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="เช่น หุ่นยนต์เดินตามเส้น"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">ธีมสี</label>
                    <div className="flex gap-3">
                      {(['blue', 'purple', 'orange', 'emerald', 'rose'] as const).map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setFormData({ ...formData, theme: color })}
                          className={cn(
                            "w-10 h-10 rounded-full transition-all border-4",
                            color === 'blue' ? "bg-blue-500" :
                            color === 'purple' ? "bg-purple-500" :
                            color === 'orange' ? "bg-orange-500" :
                            color === 'emerald' ? "bg-emerald-500" :
                            "bg-rose-500",
                            formData.theme === color ? "border-gray-200 scale-110" : "border-transparent"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">คะแนนเต็มสูงสุด</label>
                    <input
                      type="number"
                      value={formData.maxScore}
                      onChange={(e) => setFormData({ ...formData, maxScore: parseInt(e.target.value) })}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="เช่น 100"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">รายการภารกิจและการให้คะแนน</h3>
                    <button
                      type="button"
                      onClick={addMission}
                      className="text-blue-600 hover:text-blue-700 text-sm font-bold flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      เพิ่มภารกิจ
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {formData.missions?.map((mission, index) => (
                      <div key={mission.id} className="p-4 bg-gray-50 rounded-2xl space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-gray-400 uppercase tracking-widest">ภารกิจที่ {index + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeMission(mission.id)}
                            className="text-red-400 hover:text-red-600 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-1">
                            <label className="block text-[10px] font-bold text-gray-500 mb-1">ชื่อภารกิจ</label>
                            <input
                              type="text"
                              value={mission.name}
                              onChange={(e) => updateMission(mission.id, { name: e.target.value })}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              placeholder="เช่น วางกระป๋อง"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1">คะแนนต่อหน่วย</label>
                            <input
                              type="number"
                              value={mission.points}
                              onChange={(e) => updateMission(mission.id, { points: parseInt(e.target.value) })}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1">รูปแบบ</label>
                            <select
                              value={mission.type}
                              onChange={(e) => updateMission(mission.id, { type: e.target.value as 'count' | 'toggle' })}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            >
                              <option value="count">ตัวเลข (จำนวน)</option>
                              <option value="toggle">เปิด/ปิด (สำเร็จ)</option>
                            </select>
                          </div>
                        </div>
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

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    บันทึก
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
