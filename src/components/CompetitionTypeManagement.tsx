import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext, ToastContext, PopupContext } from '../App';
import { Trophy, Plus, Trash2, Edit3, X, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';

interface CompetitionType {
  id: string;
  key: string;
  name: string;
  minStudents?: number;
  maxStudents?: number;
}

export default function CompetitionTypeManagement() {
  const { isAdmin } = useContext(AuthContext);
  const { showPopup } = useContext(PopupContext);
  const { showToast } = useContext(ToastContext);
  const [types, setTypes] = useState<CompetitionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<CompetitionType | null>(null);
  const [formData, setFormData] = useState({ key: '', name: '', minStudents: 2, maxStudents: 3 });
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'competition_types'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTypes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CompetitionType[]);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleOpenModal = (type?: CompetitionType) => {
    if (type) {
      setEditingType(type);
      setFormData({ 
        key: type.key, 
        name: type.name, 
        minStudents: type.minStudents ?? 2, 
        maxStudents: type.maxStudents ?? 3 
      });
    } else {
      setEditingType(null);
      setFormData({ key: '', name: '', minStudents: 2, maxStudents: 3 });
    }
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.key.trim() || !formData.name.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      const typeRef = doc(db, 'competition_types', formData.key.trim());
      await setDoc(typeRef, {
        key: formData.key.trim(),
        name: formData.name.trim(),
        minStudents: Number(formData.minStudents),
        maxStudents: Number(formData.maxStudents)
      });
      showPopup('บันทึกสำเร็จ!', `ประเภทการแข่งขัน "${formData.name}" เรียบร้อยแล้ว`, 'success');
      setIsModalOpen(false);
    } catch (err) {
      showPopup('บันทึกไม่สำเร็จ', 'เกิดข้อผิดพลาดในการบันทึกประเภทการแข่งขัน', 'error');
      setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleDelete = (id: string) => {
    showPopup(
      'ยืนยันการลบประเภทการแข่งขัน',
      'คุณต้องการลบประเภทการแข่งขันนี้ใช่หรือไม่? ข้อมูลการแข่งขันและทีมที่อยู่ในระดับนี้ทั้งหมดอาจได้รับผลกระทบ',
      'confirm',
      async () => {
        try {
          await deleteDoc(doc(db, 'competition_types', id));
          showToast('ลบประเภทการแข่งขันสำเร็จ', 'success');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `competition_types/${id}`);
          showToast('ไม่สามารถลบประเภทการแข่งขันได้', 'error');
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
            <Trophy className="w-8 h-8 text-blue-600" />
            จัดการประเภทการแข่งขัน
          </h1>
          <p className="text-gray-500 mt-1">กำหนดระดับหรือประเภทของการแข่งขันในระบบ</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          เพิ่มประเภทใหม่
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {types.map((type) => (
          <motion.div
            key={type.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="bg-blue-50 p-3 rounded-2xl">
                <Trophy className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleOpenModal(type)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(type.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-1">{type.name}</h3>
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-3">{type.key}</p>
            <div className="flex gap-2 text-xs font-bold">
              <div className="px-2 py-1 bg-green-50 text-green-600 rounded-lg">
                นักเรียน: {type.minStudents || 2}-{type.maxStudents || 3} คน
              </div>
            </div>
          </motion.div>
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
              className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingType ? 'แก้ไขประเภทการแข่งขัน' : 'เพิ่มประเภทการแข่งขัน'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">รหัสอ้างอิง (Key)</label>
                  <input
                    type="text"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    disabled={!!editingType}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-mono disabled:opacity-50"
                    placeholder="เช่น primary, junior_high"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">ชื่อประเภท (ภาษาไทย)</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="เช่น ระดับประถมศึกษา"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">นร. ขั้นต่ำ</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.minStudents}
                      onChange={(e) => setFormData({ ...formData, minStudents: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">นร. สูงสุด</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.maxStudents}
                      onChange={(e) => setFormData({ ...formData, maxStudents: parseInt(e.target.value) || 1 })}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
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
