import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, addDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext, ToastContext, PopupContext } from '../App';
import { sendNotification } from '../services/notificationService';
import { Users, Plus, Trash2, Edit3, X, Check, AlertCircle, School, Trophy, Search, UserPlus, FileUp, Download, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';
import * as XLSX from 'xlsx';

interface TeamMember {
  idCard: string;
  name: string;
  birthDate: string;
  role: 'advisor' | 'student';
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
  minStudents?: number;
  maxStudents?: number;
}

export default function TeamManagement() {
  const { isAdmin } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const { showPopup } = useContext(PopupContext);
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitionTypes, setCompetitionTypes] = useState<CompetitionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [search, setSearch] = useState('');
  const [searchBy, setSearchBy] = useState<'name' | 'school' | 'member'>('name');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('all');
  
  const [formData, setFormData] = useState({
    name: '',
    school: '',
    levelKey: '',
    members: [
      { idCard: '', name: '', birthDate: '', role: 'advisor' },
      { idCard: '', name: '', birthDate: '', role: 'student' },
      { idCard: '', name: '', birthDate: '', role: 'student' }
    ] as TeamMember[]
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
    setIsSubmitted(false);
    if (team) {
      setEditingTeam(team);
      setFormData({
        name: team.name,
        school: team.school || '',
        levelKey: team.levelKey,
        members: team.members.length > 0 ? team.members.map(m => ({ ...m, role: m.role || 'student' })) : [
          { idCard: '', name: '', birthDate: '', role: 'advisor' },
          { idCard: '', name: '', birthDate: '', role: 'student' },
          { idCard: '', name: '', birthDate: '', role: 'student' }
        ]
      });
    } else {
      setEditingTeam(null);
      const defaultType = competitionTypes[0];
      const defaultMinS = defaultType?.minStudents ?? 2;
      const initialMembers: TeamMember[] = [{ idCard: '', name: '', birthDate: '', role: 'advisor' }];
      for (let i = 0; i < defaultMinS; i++) {
        initialMembers.push({ idCard: '', name: '', birthDate: '', role: 'student' });
      }

      setFormData({
        name: '',
        school: '',
        levelKey: defaultType?.key || '',
        members: initialMembers
      });
    }
    setError('');
    setIsModalOpen(true);
  };

  const addMember = () => {
    setFormData(prev => ({
      ...prev,
      members: [...prev.members, { idCard: '', name: '', birthDate: '', role: 'student' }]
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
    
    if (field === 'idCard') {
      processedValue = value.replace(/\D/g, '');
    }

    newMembers[index] = { ...newMembers[index], [field]: processedValue };
    setFormData({ ...formData, members: newMembers });
  };

  const validateIdCard = (id: string) => {
    return /^\d{13}$/.test(id);
  };

  const checkDuplicateIdCard = (idCard: string, currentTeamId?: string) => {
    for (const team of teams) {
      if (currentTeamId && team.id === currentTeamId) continue;
      if (team.members?.some(m => m.idCard === idCard)) {
        return team;
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitted(true);

    if (!formData.name.trim() || !formData.levelKey) {
      setError('กรุณากรอกข้อมูลทีมให้ครบถ้วน');
      return;
    }

    const students = formData.members.filter(m => m.role === 'student');
    const advisors = formData.members.filter(m => m.role === 'advisor');

    const selectedType = competitionTypes.find(t => t.key === formData.levelKey);
    const minS = selectedType?.minStudents ?? 2;
    const maxS = selectedType?.maxStudents ?? 3;

    if (students.length < minS) {
      setError(`ทีมระดับนี้ต้องมีนักเรียนอย่างน้อย ${minS} คน`);
      return;
    }

    if (students.length > maxS) {
      setError(`ทีมระดับนี้มีนักเรียนได้สูงสุด ${maxS} คน`);
      return;
    }

    if (advisors.length < 1) {
      setError('ทีมต้องมีครูที่ปรึกษาอย่างน้อย 1 คน');
      return;
    }

    const currentIdCards = new Set();
    for (const member of formData.members) {
      if (!member.idCard.trim() || !member.name.trim() || !member.birthDate || !member.role) {
        setError('กรุณากรอกข้อมูลสมาชิกทุกคนให้ครบถ้วน');
        return;
      }
      if (!validateIdCard(member.idCard)) {
        setError(`เลขบัตรประชาชน ${member.idCard} ไม่ถูกต้อง (13 หลัก)`);
        return;
      }
      if (currentIdCards.has(member.idCard)) {
        setError(`เลขบัตรประชาชน ${member.idCard} ซ้ำกันในทีม`);
        return;
      }

      const duplicateTeam = checkDuplicateIdCard(member.idCard, editingTeam?.id);
      if (duplicateTeam) {
        setError(`เลขบัตรประชาชน ${member.idCard} ถูกใช้งานแล้วโดยทีม "${duplicateTeam.name}" (${duplicateTeam.levelKey})`);
        return;
      }
      currentIdCards.add(member.idCard);
    }

    try {
      if (editingTeam) {
        await setDoc(doc(db, 'teams', editingTeam.id), formData);
        showPopup('บันทึกสำเร็จ!', `แก้ไขข้อมูลทีม "${formData.name}" เรียบร้อยแล้ว`, 'success');
        showToast('แก้ไขข้อมูลทีมสำเร็จ', 'success');
      } else {
        await addDoc(collection(db, 'teams'), formData);
        showPopup('บันทึกสำเร็จ!', `ลงทะเบียนทีม "${formData.name}" เรียบร้อยแล้ว`, 'success');
        showToast('ลงทะเบียนทีมใหม่สำเร็จ', 'success');
        await sendNotification({
          title: 'ลงทะเบียนทีมใหม่',
          message: `ทีม "${formData.name}" ลงทะเบียนสำเร็จ`,
          type: 'success',
          targetRole: 'all'
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, editingTeam ? OperationType.UPDATE : OperationType.CREATE, editingTeam ? `teams/${editingTeam.id}` : 'teams');
      showPopup('บันทึกไม่สำเร็จ', 'ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง', 'error');
      showToast('ไม่สามารถบันทึกข้อมูลได้', 'error');
    }
  };

  const handleDelete = (id: string) => {
    showPopup(
      'ยืนยันการลบทีม',
      'คุณต้องการลบทีมนี้ใช่หรือไม่? ข้อมูลการบันทึกคะแนนทั้งหมดของทีมนี้จะหายไป',
      'confirm',
      async () => {
        try {
          await deleteDoc(doc(db, 'teams', id));
          showToast('ลบทีมสำเร็จ', 'success');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `teams/${id}`);
          showToast('ไม่สามารถลบทีมได้', 'error');
        }
      }
    );
  };

  const handleExportTemplate = () => {
    const templateData = [
      {
        'ชื่อทีม': 'ตัวอย่างทีม A',
        'โรงเรียน': 'โรงเรียนตัวอย่าง',
        'ระดับการแข่งขัน (ใส่ Key เช่น primary, junior_high, senior_high)': 'primary',
        'ชื่อสมาชิก 1': 'นายสมชาย ใจดี',
        'เลขบัตรประชาชน 1': '1234567890123',
        'วันเกิดสมาชิก 1 (ปี-เดือน-วัน เช่น 2010-05-15)': '2010-05-15',
        'สถานะสมาชิก 1 (advisor หรือ student)': 'advisor',
        'ชื่อสมาชิก 2': 'นางสาวสมศรี มีสุข',
        'เลขบัตรประชาชน 2': '1234567890124',
        'วันเกิดสมาชิก 2 (ปี-เดือน-วัน)': '2011-08-20',
        'สถานะสมาชิก 2 (advisor หรือ student)': 'student',
        'ชื่อสมาชิก 3': 'เด็กชายมานะ อดทน',
        'เลขบัตรประชาชน 3': '1234567890125',
        'วันเกิดสมาชิก 3 (ปี-เดือน-วัน)': '2012-01-10',
        'สถานะสมาชิก 3 (advisor หรือ student)': 'student',
        'ชื่อสมาชิก 4': '',
        'เลขบัตรประชาชน 4': '',
        'วันเกิดสมาชิก 4': '',
        'สถานะสมาชิก 4': '',
        'ชื่อสมาชิก 5': '',
        'เลขบัตรประชาชน 5': '',
        'วันเกิดสมาชิก 5': '',
        'สถานะสมาชิก 5': '',
        'ชื่อสมาชิก 6': '',
        'เลขบัตรประชาชน 6': '',
        'วันเกิดสมาชิก 6': '',
        'สถานะสมาชิก 6': ''
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

      if (jsonData.length === 0) throw new Error('ไม่พบข้อมูลในไฟล์');

      let successCount = 0;
      let errorCount = 0;
      let duplicateCount = 0;

      for (const row of jsonData) {
        try {
          const teamName = row['ชื่อทีม']?.toString().trim();
          const school = row['โรงเรียน']?.toString().trim();
          let levelKey = row['ระดับการแข่งขัน (ใส่ Key เช่น primary, junior_high, senior_high)']?.toString().trim();
          
          if (!levelKey) {
            levelKey = row['ระดับ (primary/junior_high/senior_high)']?.toString().trim();
          }

          if (!teamName || !levelKey) continue;

          const members: TeamMember[] = [];
          let hasDuplicate = false;
          
          // Support up to 10 members just in case, but template has 6
          for (let i = 1; i <= 10; i++) {
            const mName = row[`ชื่อสมาชิก ${i}`]?.toString().trim();
            const mId = row[`เลขบัตรประชาชน ${i}`]?.toString().trim();
            let mBirth = row[`วันเกิดสมาชิก ${i} (ปี-เดือน-วัน เช่น 2010-05-15)`]?.toString().trim();
            
            if (!mBirth) {
              mBirth = row[`วันเกิดสมาชิก ${i} (YYYY-MM-DD)`]?.toString().trim();
            }
            if (!mBirth) {
              mBirth = row[`วันเกิดสมาชิก ${i}`]?.toString().trim();
            }

            let mRoleRaw = row[`สถานะสมาชิก ${i} (advisor หรือ student)`]?.toString().trim().toLowerCase();
            if (!mRoleRaw) {
              mRoleRaw = row[`สถานะสมาชิก ${i} (advisor/student)`]?.toString().trim().toLowerCase();
            }
            
            const mRole = mRoleRaw === 'advisor' ? 'advisor' : 'student';
            
            if (mName && mId) {
              if (checkDuplicateIdCard(mId)) {
                hasDuplicate = true;
                break;
              }
              members.push({ 
                name: mName, 
                idCard: mId, 
                birthDate: mBirth || '', 
                role: mRole 
              });
            }
          }

          if (hasDuplicate) {
            duplicateCount++;
            continue;
          }

          const studentsCount = members.filter(m => m.role === 'student').length;
          const advisorsCount = members.filter(m => m.role === 'advisor').length;

          const selectedType = competitionTypes.find(t => t.key === levelKey);
          const minS = selectedType?.minStudents ?? 2;
          const maxS = selectedType?.maxStudents ?? 3;

          if (studentsCount < minS || studentsCount > maxS || advisorsCount < 1) continue; // Dynamic requirements

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

      const msg = `นำเข้าสำเร็จ ${successCount} ทีม ${duplicateCount > 0 ? `(ซ้ำ ${duplicateCount} ทีม)` : ''} ${errorCount > 0 ? `(ผิดพลาด ${errorCount} ทีม)` : ''}`;
      setImportSuccess(msg);
      showToast(msg, 'success');
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการนำเข้าไฟล์');
      showToast('นำเข้าไฟล์ไม่สำเร็จ', 'error');
    } finally {
      setImportLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const filteredTeams = teams.filter(t => {
    // Level filter
    if (selectedLevelFilter !== 'all' && t.levelKey !== selectedLevelFilter) return false;

    const searchLower = search.toLowerCase();
    if (!searchLower) return true;
    
    switch (searchBy) {
      case 'name':
        return t.name.toLowerCase().includes(searchLower);
      case 'school':
        return t.school?.toLowerCase().includes(searchLower);
      case 'member':
        return t.members.some(m => m.name.toLowerCase().includes(searchLower));
      default:
        return true;
    }
  });

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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-6 bg-white rounded-[32px] border border-gray-100 shadow-sm">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 font-mono">Total Participation</div>
          <div className="text-3xl font-black text-gray-900">{teams.length} <span className="text-sm text-gray-400">ทีม</span></div>
        </div>
        {competitionTypes.map(type => {
          const count = teams.filter(t => t.levelKey === type.key).length;
          return (
            <div key={type.key} className="p-6 bg-white rounded-[32px] border border-gray-100 shadow-sm border-l-4 border-l-blue-500">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 truncate font-mono" title={type.name}>{type.name}</div>
              <div className="text-3xl font-black text-blue-600">{count} <span className="text-sm text-blue-200">ทีม</span></div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative w-full sm:w-48">
              <select
                value={selectedLevelFilter}
                onChange={(e) => setSelectedLevelFilter(e.target.value)}
                className="w-full pl-4 pr-10 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none appearance-none font-bold text-gray-600 cursor-pointer"
              >
                <option value="all">ทุกระดับ</option>
                {competitionTypes.map(type => (
                  <option key={type.key} value={type.key}>{type.name}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
            <div className="relative w-full sm:w-48">
              <select
                value={searchBy}
                onChange={(e) => setSearchBy(e.target.value as any)}
                className="w-full pl-4 pr-10 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none appearance-none font-bold text-gray-600 cursor-pointer"
              >
                <option value="name">ชื่อทีม</option>
                <option value="school">โรงเรียน</option>
                <option value="member">ชื่อสมาชิก</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder={`ค้นหาตาม${searchBy === 'name' ? 'ชื่อทีม' : searchBy === 'school' ? 'ชื่อโรงเรียน' : 'ชื่อสมาชิก'}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none"
              />
            </div>
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
                    <div className="space-y-3">
                      {team.members.map((m, idx) => {
                        const age = calculateAge(m.birthDate);
                        return (
                          <div key={idx} className="text-sm text-gray-600 flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                                m.role === 'advisor' ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
                              )}>
                                {m.role === 'advisor' ? 'ครูที่ปรึกษา' : 'นักเรียน'}
                              </span>
                              <span className="font-bold">{m.name}</span>
                              <span className="text-[10px] text-gray-400 font-mono">({m.idCard})</span>
                            </div>
                            <div className="pl-0 text-[10px] text-gray-400 flex items-center gap-2">
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
                      className={cn(
                        "w-full px-4 py-3 bg-gray-50 border-2 rounded-2xl focus:ring-2 outline-none transition-all",
                        isSubmitted && !formData.name.trim() ? "border-red-300 focus:ring-red-500 shadow-sm shadow-red-50" : "border-transparent focus:ring-blue-500"
                      )}
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
                    className={cn(
                      "w-full px-4 py-3 bg-gray-50 border-2 rounded-2xl focus:ring-2 outline-none transition-all",
                      isSubmitted && !formData.school.trim() ? "border-red-300 focus:ring-red-500 shadow-sm shadow-red-50" : "border-transparent focus:ring-blue-500"
                    )}
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
                      <div key={idx} className={cn(
                        "flex gap-3 items-start p-5 rounded-2xl relative group border-2 transition-all",
                        isSubmitted && (!member.name.trim() || !member.idCard.trim() || !member.birthDate)
                          ? "bg-red-50/30 border-red-100" 
                          : "bg-gray-50 border-transparent"
                      )}>
                        <div className="flex-1 space-y-4">
                          <div className="flex flex-wrap gap-4 items-center mb-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`role-${idx}`}
                                value="student"
                                checked={member.role === 'student' || !member.role}
                                onChange={(e) => updateMember(idx, 'role', e.target.value)}
                                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm font-bold text-gray-700">นักเรียน</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={`role-${idx}`}
                                value="advisor"
                                checked={member.role === 'advisor'}
                                onChange={(e) => updateMember(idx, 'role', e.target.value)}
                                className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                              />
                              <span className="text-sm font-bold text-gray-700">ครูที่ปรึกษา</span>
                            </label>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">เลขบัตรประชาชน</label>
                              <input
                                type="text"
                                maxLength={13}
                                value={member.idCard}
                                onChange={(e) => updateMember(idx, 'idCard', e.target.value)}
                                className={cn(
                                  "w-full px-4 py-2 bg-white border rounded-xl focus:ring-2 outline-none text-sm font-mono transition-all",
                                  (member.idCard && !validateIdCard(member.idCard)) || (isSubmitted && !member.idCard)
                                    ? "border-red-300 focus:ring-red-500 text-red-600 shadow-sm shadow-red-50" 
                                    : "border-gray-100 focus:ring-blue-500 text-gray-900"
                                )}
                                placeholder="เลขบัตรประชาชน 13 หลัก"
                              />
                              {member.idCard && !validateIdCard(member.idCard) && (
                                <div className="absolute right-3 bottom-2 text-red-500">
                                  <AlertCircle className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">ชื่อ-นามสกุล</label>
                              <input
                                type="text"
                                value={member.name}
                                onChange={(e) => updateMember(idx, 'name', e.target.value)}
                                className={cn(
                                  "w-full px-4 py-2 bg-white border rounded-xl focus:ring-2 outline-none text-sm transition-all",
                                  isSubmitted && !member.name.trim() 
                                    ? "border-red-300 focus:ring-red-500 shadow-sm shadow-red-50" 
                                    : "border-gray-100 focus:ring-blue-500 text-gray-900"
                                )}
                                placeholder="ชื่อ-นามสกุลสมาชิก"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">วัน/เดือน/ปีเกิด</label>
                              <input
                                type="date"
                                value={member.birthDate}
                                onChange={(e) => updateMember(idx, 'birthDate', e.target.value)}
                                className={cn(
                                  "w-full px-4 py-2 bg-white border rounded-xl focus:ring-2 outline-none text-sm transition-all",
                                  isSubmitted && !member.birthDate 
                                    ? "border-red-300 focus:ring-red-500 shadow-sm shadow-red-50" 
                                    : "border-gray-100 focus:ring-blue-500 text-gray-900"
                                )}
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
                        {formData.members.length > 3 && (
                          <button
                            type="button"
                            onClick={() => removeMember(idx)}
                            className="p-2 text-gray-300 hover:text-red-600 transition-colors mt-8"
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
