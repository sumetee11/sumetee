import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, addDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext } from '../App';
import { sendNotification } from '../services/notificationService';
import { Users, Plus, Trash2, Edit3, X, Check, AlertCircle, School, Trophy, Search, UserPlus, FileUp, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';
import * as XLSX from 'xlsx';

interface TeamMember {
  idCard: string;
  name: string;
  birthDate: string;
}

interface Team {
  id: string;
  name: string;
  school: string;
  levelKey: string;
  members: TeamMember[];
}

interface CompetitionType {
  key: string;
  name: string;
}

export default function TeamManagement() {
  const { isAdmin } = useContext(AuthContext);
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitionTypes, setCompetitionTypes] = useState<CompetitionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [search, setSearch] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    school: '',
    levelKey: '',
    members: [{ idCard: '', name: '', birthDate: '' }] as TeamMember[]
  });
  const [error, setError] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState('');

  useEffect(() => {
    const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Team[]);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teams');
    });

    const unsubTypes = onSnapshot(collection(db, 'competition_types'), (snapshot) => {
      const types = snapshot.docs.map(doc => doc.data() as CompetitionType);
      setCompetitionTypes(types);
      if (types.length > 0 && !formData.levelKey) {
        setFormData(prev => ({ ...prev, levelKey: types[0].key }));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'competition_types');
    });

    return () => {
      unsubTeams();
      unsubTypes();
    };
  }, []);

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const handleOpenModal = (team?: Team) => {
    if (team) {
      setEditingTeam(team);
      setFormData({
        name: team.name,
        school: team.school || '',
        levelKey: team.levelKey,
        members: team.members.length > 0 ? team.members : [{ idCard: '', name: '', birthDate: '' }]
      });
    } else {
      setEditingTeam(null);
      setFormData({
        name: '',
        school: '',
        levelKey: competitionTypes[0]?.key || '',
        members: [{ idCard: '', name: '', birthDate: '' }]
      });
    }
    setError('');
    setIsModalOpen(true);
  };

  const addMember = () => {
    setFormData(prev => ({
      ...prev,
      members: [...prev.members, { idCard: '', name: '', birthDate: '' }]
    }));
  };

  const removeMember = (index: number) => {
    setFormData(prev => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index)
    }));
  };

  const updateMember = (index: number, field: keyof TeamMember, value: string) => {
    const newMembers = [...formData.members];
    let processedValue = value;
    
    // Real-time sanitization: only allow numbers for idCard
    if (field === 'idCard') {
      processedValue = value.replace(/\D/g, '');
    }

    newMembers[index] = { ...newMembers[index], [field]: processedValue };
    setFormData({ ...formData, members: newMembers });
  };

  const validateIdCard = (id: string) => {
    return /^\d{13}$/.test(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.levelKey || formData.members.length === 0) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    // Validate members
    const idCards = new Set();
    for (const member of formData.members) {
      if (!member.idCard.trim() || !member.name.trim() || !member.birthDate) {
        setError('กรุณากรอกข้อมูลสมาชิกให้ครบถ้วน (รวมถึงวันเกิด)');
        return;
      }
      if (!validateIdCard(member.idCard)) {
        setError(`เลขบัตรประชาชน ${member.idCard} ไม่ถูกต้อง (ต้องเป็นตัวเลข 13 หลัก)`);
        return;
      }
      if (idCards.has(member.idCard)) {
        setError(`เลขบัตรประชาชน ${member.idCard} ซ้ำกันในทีม`);
        return;
      }
      idCards.add(member.idCard);
    }

    try {
      if (editingTeam) {
        await setDoc(doc(db, 'teams', editingTeam.id), formData);
      } else {
        await addDoc(collection(db, 'teams'), formData);
        await sendNotification({
          title: 'ลงทะเบียนทีมใหม่',
          message: `ทีม "${formData.name}" จากโรงเรียน "${formData.school}" ลงทะเบียนสำเร็จ`,
          type: 'success',
          targetRole: 'all'
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, editingTeam ? OperationType.UPDATE : OperationType.CREATE, editingTeam ? `teams/${editingTeam.id}` : 'teams');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('คุณต้องการลบทีมนี้ใช่หรือไม่?')) return;
    try {
      await deleteDoc(doc(db, 'teams', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `teams/${id}`);
    }
  };

  const handleExportTemplate = () => {
    const templateData = [
      {
        'ชื่อทีม': 'ตัวอย่างทีม A',
        'โรงเรียน': 'โรงเรียนตัวอย่าง',
        'ระดับ (primary/junior_high/senior_high)': 'primary',
        'ชื่อสมาชิก 1': 'นายสมชาย ใจดี',
        'เลขบัตรประชาชน 1': '1234567890123',
        'วันเกิดสมาชิก 1 (YYYY-MM-DD)': '2010-05-15',
        'ชื่อสมาชิก 2': 'นางสาวสมศรี มีสุข',
        'เลขบัตรประชาชน 2': '1234567890124',
        'วันเกิดสมาชิก 2 (YYYY-MM-DD)': '2011-08-20',
        'ชื่อสมาชิก 3': '',
        'เลขบัตรประชาชน 3': '',
        'วันเกิดสมาชิก 3 (YYYY-MM-DD)': ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "team_import_template.xlsx");
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setError('');
    setImportSuccess('');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        throw new Error('ไม่พบข้อมูลในไฟล์');
      }

      let successCount = 0;
      let errorCount = 0;

      for (const row of jsonData) {
        try {
          const teamName = row['ชื่อทีม']?.toString().trim();
          const school = row['โรงเรียน']?.toString().trim();
          const levelKey = row['ระดับ (primary/junior_high/senior_high)']?.toString().trim();

          if (!teamName || !levelKey) continue;

          const members: TeamMember[] = [];
          for (let i = 1; i <= 3; i++) {
            const mName = row[`ชื่อสมาชิก ${i}`]?.toString().trim();
            const mId = row[`เลขบัตรประชาชน ${i}`]?.toString().trim();
            const mBirth = row[`วันเกิดสมาชิก ${i} (YYYY-MM-DD)`]?.toString().trim();
            if (mName && mId && mBirth) {
              members.push({ name: mName, idCard: mId, birthDate: mBirth });
            }
          }

          if (members.length === 0) continue;

          await addDoc(collection(db, 'teams'), {
            name: teamName,
            school: school || '',
            levelKey: levelKey,
            members: members
          });
          successCount++;
        } catch (err) {
          errorCount++;
        }
      }

      setImportSuccess(`นำเข้าสำเร็จ ${successCount} ทีม ${errorCount > 0 ? `(ผิดพลาด ${errorCount} ทีม)` : ''}`);
      await sendNotification({
        title: 'นำเข้าทีมสำเร็จ',
        message: `นำเข้าข้อมูลทีมทั้งหมด ${successCount} ทีมสำเร็จ`,
        type: 'success',
        targetRole: 'admin'
      });
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการนำเข้าไฟล์');
    } finally {
      setImportLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.school?.toLowerCase().includes(search.toLowerCase())
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
            <Users className="w-8 h-8 text-blue-600" />
            จัดการทีม (Team Management)
          </h1>
          <p className="text-gray-500 mt-1">เพิ่ม แก้ไข และจัดการข้อมูลทีมเข้าแข่งขัน</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportTemplate}
            className="bg-white text-gray-600 px-4 py-3 rounded-2xl font-bold border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Template
          </button>
          <label className="bg-white text-blue-600 px-4 py-3 rounded-2xl font-bold border border-blue-200 hover:bg-blue-50 transition-all flex items-center gap-2 cursor-pointer">
            <FileUp className="w-5 h-5" />
            {importLoading ? 'กำลังนำเข้า...' : 'นำเข้า Excel/CSV'}
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleImportFile}
              className="hidden"
              disabled={importLoading}
            />
          </label>
          <button
            onClick={() => handleOpenModal()}
            className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            เพิ่มทีมใหม่
          </button>
        </div>
      </div>

      {(error || importSuccess) && (
        <div className={cn(
          "mb-6 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4",
          error ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
        )}>
          {error ? <AlertCircle className="w-5 h-5" /> : <Check className="w-5 h-5" />}
          <p className="font-bold">{error || importSuccess}</p>
          <button 
            onClick={() => { setError(''); setImportSuccess(''); }}
            className="ml-auto text-current opacity-50 hover:opacity-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="ค้นหาชื่อทีมหรือโรงเรียน..."
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
                <th className="px-8 py-4">ชื่อทีม / โรงเรียน</th>
                <th className="px-8 py-4">ระดับ</th>
                <th className="px-8 py-4">สมาชิก</th>
                <th className="px-8 py-4 text-right">เครื่องมือ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTeams.map((team) => (
                <tr key={team.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="font-bold text-gray-900">{team.name}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                      <School className="w-3 h-3" />
                      {team.school}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase">
                      {competitionTypes.find(t => t.key === team.levelKey)?.name || team.levelKey}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="space-y-2">
                      {team.members.map((m, idx) => {
                        const age = calculateAge(m.birthDate);
                        return (
                          <div key={idx} className="text-sm text-gray-600 flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                              <span className="font-bold">{m.name}</span>
                              <span className="text-[10px] text-gray-400 font-mono">({m.idCard})</span>
                            </div>
                            <div className="pl-3.5 text-[10px] text-gray-400 flex items-center gap-2">
                              <span>เกิด: {m.birthDate || 'N/A'}</span>
                              <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-bold">
                                อายุ: {age !== null ? `${age} ปี` : 'N/A'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleOpenModal(team)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(team.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTeams.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-gray-400 italic">
                    ไม่พบข้อมูลทีม
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
                  {editingTeam ? 'แก้ไขข้อมูลทีม' : 'เพิ่มทีมใหม่'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">ชื่อทีม</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="ระบุชื่อทีม"
                    />
                  </div>
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
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">โรงเรียน</label>
                  <input
                    type="text"
                    value={formData.school}
                    onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ระบุชื่อโรงเรียน"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-bold text-gray-700">สมาชิกในทีม</label>
                    <button
                      type="button"
                      onClick={addMember}
                      className="text-blue-600 text-sm font-bold flex items-center gap-1 hover:text-blue-700"
                    >
                      <UserPlus className="w-4 h-4" />
                      เพิ่มสมาชิก
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {formData.members.map((member, idx) => (
                      <div key={idx} className="flex gap-3 items-start bg-gray-50 p-4 rounded-2xl relative group">
                        <div className="flex-1 space-y-3">
                          <div className="relative">
                            <input
                              type="text"
                              maxLength={13}
                              value={member.idCard}
                              onChange={(e) => updateMember(idx, 'idCard', e.target.value)}
                              className={cn(
                                "w-full px-4 py-2 bg-white border rounded-xl focus:ring-2 outline-none text-sm font-mono transition-all",
                                member.idCard && !validateIdCard(member.idCard) 
                                  ? "border-red-300 focus:ring-red-500 text-red-600" 
                                  : "border-gray-100 focus:ring-blue-500 text-gray-900"
                              )}
                              placeholder="เลขบัตรประชาชน 13 หลัก"
                            />
                            {member.idCard && !validateIdCard(member.idCard) && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
                                <AlertCircle className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <input
                            type="text"
                            value={member.name}
                            onChange={(e) => updateMember(idx, 'name', e.target.value)}
                            className="w-full px-4 py-2 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            placeholder="ชื่อ-นามสกุลสมาชิก"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">วัน/เดือน/ปีเกิด</label>
                              <input
                                type="date"
                                value={member.birthDate}
                                onChange={(e) => updateMember(idx, 'birthDate', e.target.value)}
                                className="w-full px-4 py-2 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">อายุปัจจุบัน</label>
                              <div className="w-full px-4 py-2 bg-gray-100 border border-transparent rounded-xl text-sm font-bold text-gray-600">
                                {calculateAge(member.birthDate) !== null ? `${calculateAge(member.birthDate)} ปี` : '-'}
                              </div>
                            </div>
                          </div>
                        </div>
                        {formData.members.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMember(idx)}
                            className="p-2 text-gray-300 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
                    บันทึกข้อมูลทีม
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
