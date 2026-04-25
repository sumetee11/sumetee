import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext, ToastContext, PopupContext } from '../App';
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
  const { showPopup } = useContext(PopupContext);
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
        showPopup('อัปเดตสำเร็จ!', `แก้ไขข้อมูลรายการ "${formData.name}" เรียบร้อยแล้ว`, 'success');
        showToast('อัปเดตรายการแข่งขันสำเร็จ', 'success');
      } else {
        await addDoc(collection(db, 'competitions'), formData);
        showPopup('บันทึกสำเร็จ!', `เพิ่มรายการแข่งขัน "${formData.name}" เรียบร้อยแล้ว`, 'success');
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
      showPopup('บันทึกไม่สำเร็จ', 'เกิดข้อผิดพลาดในการบันทึกข้อมูลรายการแข่งขัน', 'error');
    }
  };

  const handleDelete = (id: string) => {
    showPopup(
      'ยืนยันการลบ',
      'คุณต้องการลบรายการแข่งขันนี้ใช่หรือไม่? ข้อมูลการแข่งขันและคะแนนที่เกี่ยวข้องอาจได้รับผลกระทบ',
      'confirm',
      async () => {
        try {
          await deleteDoc(doc(db, 'competitions', id));
          showToast('ลบรายการแข่งขันสำเร็จ', 'success');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `competitions/${id}`);
          showToast('ไม่สามารถลบรายการแข่งขันได้', 'error');
        }
      }
    );
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {competitions.length === 0 ? (
          <div className="col-span-full p-20 text-center bg-white rounded-[40px] border-2 border-dashed border-gray-100">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <ClipboardCheck className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">ยังไม่มีรายการแข่งขัน</h3>
            <p className="text-gray-500">เริ่มต้นโดยการกดปุ่ม "เพิ่มรายการใหม่" ด้านบนเพื่อกำหนดหัวข้อการแข่งขัน</p>
          </div>
        ) : (
          [...competitions]
            .sort((a, b) => {
              const levelA = competitionTypes.findIndex(t => t.key === a.levelKey);
              const levelB = competitionTypes.findIndex(t => t.key === b.levelKey);
              if (levelA !== levelB) return levelA - levelB;
              return a.name.localeCompare(b.name);
            })
            .map((comp) => {
            const level = competitionTypes.find(t => t.key === comp.levelKey);
            const themeColor = comp.theme || 'blue';
            
            const themeClasses = {
              blue: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-600', shadow: 'shadow-blue-100', border: 'border-blue-100' },
              purple: { bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-600', shadow: 'shadow-purple-100', border: 'border-purple-100' },
              orange: { bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-600', shadow: 'shadow-orange-100', border: 'border-orange-100' },
              emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-600', shadow: 'shadow-emerald-100', border: 'border-emerald-100' },
              rose: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-600', shadow: 'shadow-rose-100', border: 'border-rose-100' },
            }[themeColor];

            return (
              <motion.div
                key={comp.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden flex flex-col group hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className={cn("h-4", themeClasses.dot)} />
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                      themeClasses.bg, themeClasses.text
                    )}>
                      {level?.name || comp.levelKey}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                      <div className={cn("w-2 h-2 rounded-full", themeClasses.dot)} />
                      MAX {comp.maxScore || 100}
                    </div>
                  </div>

                  <h3 className="text-xl font-black text-gray-900 mb-2 leading-tight">
                    {comp.name}
                  </h3>
                  
                  <div className="mt-2 space-y-2 flex-1">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Check className="w-3.5 h-3.5" />
                      {comp.missions?.length || 0} ภารกิจย่อยในรายการ
                    </div>
                  </div>

                  <div className="mt-8 grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleOpenModal(comp)}
                      className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-50 text-gray-600 rounded-2xl font-bold hover:bg-blue-50 hover:text-blue-600 transition-all border border-transparent hover:border-blue-100"
                    >
                      <Edit3 className="w-4 h-4" />
                      แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(comp.id)}
                      className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-50 text-gray-600 rounded-2xl font-bold hover:bg-red-50 hover:text-red-600 transition-all border border-transparent hover:border-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                      ลบออก
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
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
