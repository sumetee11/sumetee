import React, { useState, useEffect, useContext } from 'react';
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, addDoc, where, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { AuthContext, ToastContext } from '../App';
import { sendNotification } from '../services/notificationService';
import { Trophy, ClipboardCheck, Plus, Trash2, Edit3, X, Check, AlertCircle, Search, User, School, History, ChevronDown, ChevronUp, Clock, Weight, RotateCcw, Target, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';

interface Score {
  id: string;
  teamId: string;
  competitionId: string;
  judgeId: string;
  judgeName?: string;
  score: number;
  round: number;
  note: string;
  createdAt: any;
  details?: {
    checkpointCount?: number;
    canPlacementCount?: number;
    returnToStart?: boolean;
    returnToFinish?: boolean;
    retryCount?: number;
    timeUsed?: string;
    robotWeight?: string | number;
    acknowledgment?: string;
  };
}

interface Team {
  id: string;
  name: string;
  school: string;
  levelKey: string;
}

interface Competition {
  id: string;
  name: string;
  levelKey: string;
  theme?: 'blue' | 'purple' | 'orange' | 'emerald' | 'rose';
  maxScore?: number;
  missions?: CustomMission[];
}

interface CustomMission {
  id: string;
  name: string;
  points: number;
  type: 'count' | 'toggle';
}

export default function Scoring() {
  const { profile, isJudge, isAdmin } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedCompId, setSelectedCompId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [scoreValue, setScoreValue] = useState('');
  const [round, setRound] = useState('1');
  const [note, setNote] = useState('');

  // Robot Competition Specific Fields
  const [missionValues, setMissionValues] = useState<Record<string, number | boolean>>({});
  const [robotDetails, setRobotDetails] = useState({
    retryCount: 0,
    timeUsed: '',
    robotWeight: '',
    acknowledgment: ''
  });
  
  const [expandedScoreId, setExpandedScoreId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    // Listen to teams
    const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Team[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teams');
    });

    // Listen to competitions
    const unsubComps = onSnapshot(collection(db, 'competitions'), (snapshot) => {
      const allComps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Competition[];
      // If judge, filter by assigned competitions
      if (isJudge && profile?.assignedCompetitions) {
        setCompetitions(allComps.filter(c => profile.assignedCompetitions?.includes(c.id)));
      } else {
        setCompetitions(allComps);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'competitions');
    });

    return () => {
      unsubTeams();
      unsubComps();
    };
  }, [profile, isJudge]);

  // Listen to scores for selected competition in real-time
  useEffect(() => {
    let q = query(collection(db, 'scores'), orderBy('createdAt', 'desc'));
    
    if (selectedCompId) {
      q = query(
        collection(db, 'scores'), 
        where('competitionId', '==', selectedCompId), 
        orderBy('createdAt', 'desc')
      );
    }

    const unsubScores = onSnapshot(q, (snapshot) => {
      setScores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Score[]);
    }, (error) => {
      console.error("Error listening to scores:", error);
      // If filtered query fails (likely missing index), fallback to client-side filtering
      if (selectedCompId) {
        const qFallback = query(collection(db, 'scores'), orderBy('createdAt', 'desc'));
        onSnapshot(qFallback, (snapshot) => {
          const allScores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Score[];
          setScores(allScores.filter(s => s.competitionId === selectedCompId));
        }, (err) => {
          handleFirestoreError(err, OperationType.LIST, 'scores');
        });
      } else {
        handleFirestoreError(error, OperationType.LIST, 'scores');
      }
    });

    return () => unsubScores();
  }, [selectedCompId]);

  const handleExportCSV = () => {
    if (scores.length === 0) return;

    const headers = ["Team Name", "School", "Competition Name", "Score", "Round", "Judge Name", "Timestamp"];
    const rows = scores.map(s => {
      const team = teams.find(t => t.id === s.teamId);
      const comp = competitions.find(c => c.id === s.competitionId);
      const timestamp = s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString('th-TH') : '';
      
      return [
        `"${team?.name || 'Unknown Team'}"`,
        `"${team?.school || 'Unknown School'}"`,
        `"${comp?.name || 'Unknown Competition'}"`,
        s.score,
        s.round,
        `"${(s as any).judgeName || 'Unknown Judge'}"`,
        `"${timestamp}"`
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `scores_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedComp = competitions.find(c => c.id === selectedCompId);
  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  const levelConfig = React.useMemo(() => {
    if (!selectedComp) return null;
    // Now criteria is directly on the competition object
    return {
      theme: selectedComp.theme || 'blue',
      maxScore: selectedComp.maxScore || 100,
      missions: selectedComp.missions || []
    };
  }, [selectedComp]);

  // Calculate score automatically
  useEffect(() => {
    if (!levelConfig) return;

    let total = 0;
    levelConfig.missions?.forEach(mission => {
      const val = missionValues[mission.id];
      if (mission.type === 'count') {
        total += (Number(val) || 0) * mission.points;
      } else if (mission.type === 'toggle' && val === true) {
        total += mission.points;
      }
    });
    setScoreValue(total.toString());
  }, [missionValues, levelConfig]);

  const validateForm = () => {
    const errors: string[] = [];
    if (!selectedCompId) errors.push('กรุณาเลือกรายการแข่งขัน');
    if (!selectedTeamId) errors.push('กรุณาเลือกทีมเข้าแข่งขัน');
    
    if (levelConfig) {
      if (!robotDetails.timeUsed.trim()) {
        errors.push('กรุณาระบุเวลาที่ใช้ (MM.SS)');
      } else {
        const [mm, ss] = robotDetails.timeUsed.split('.').map(Number);
        if (isNaN(mm) || isNaN(ss) || mm > 3 || (mm === 3 && ss > 0)) {
          errors.push('เวลาที่ใช้ต้องไม่เกิน 03.00 นาที');
        }
      }
      if (!robotDetails.robotWeight) errors.push('กรุณาระบุน้ำหนักหุ่นยนต์');
      if (!robotDetails.acknowledgment.trim()) errors.push('กรุณาระบุชื่อผู้รับทราบคะแนน');
    } else {
      if (!scoreValue) errors.push('กรุณาระบุคะแนน');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setShowConfirm(true);
    }
  };

  const handleSubmit = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const scoreData: any = {
        teamId: selectedTeamId,
        competitionId: selectedCompId,
        judgeId: profile?.uid,
        judgeName: profile?.displayName,
        score: Number(scoreValue),
        round: Number(round),
        note: note.trim(),
        createdAt: serverTimestamp()
      };

      if (levelConfig) {
        scoreData.details = {
          ...robotDetails,
          missionValues,
          robotWeight: Number(robotDetails.robotWeight)
        };
      }

      await addDoc(collection(db, 'scores'), scoreData);

      showToast('บันทึกคะแนนสำเร็จ', 'success');
      
      await sendNotification({
        title: 'บันทึกคะแนนใหม่',
        message: `บันทึกคะแนน ${scoreValue} ให้กับทีม "${selectedTeam?.name}" ในรายการ "${selectedComp?.name}"`,
        type: 'success',
        targetRole: 'admin'
      });

      setSuccess('บันทึกคะแนนสำเร็จ');
      setScoreValue('');
      setNote('');
      setMissionValues({});
      setRobotDetails({
        retryCount: 0,
        timeUsed: '',
        robotWeight: '',
        acknowledgment: ''
      });
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'scores');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteScore = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm('คุณต้องการลบคะแนนนี้ใช่หรือไม่?')) return;
    try {
      await deleteDoc(doc(db, 'scores', id));
      showToast('ลบคะแนนสำเร็จ', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `scores/${id}`);
      showToast('ไม่สามารถลบคะแนนได้', 'error');
    }
  };

  const filteredTeams = teams.filter(t => {
    return selectedComp ? t.levelKey === selectedComp.levelKey : false;
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
      <div className="mb-10">
        <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
          <Trophy className="w-8 h-8 text-yellow-500" />
          ระบบบันทึกคะแนน
        </h1>
        <p className="text-gray-500 mt-1">บันทึกคะแนนการแข่งขันสำหรับทีมที่ได้รับมอบหมาย</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Scoring Form */}
        <div className="lg:col-span-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 sticky top-24">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              บันทึกคะแนนใหม่
            </h2>

            <form onSubmit={handlePreSubmit} className="space-y-5">
              <div>
                <label className="block text-base font-bold text-gray-700 mb-2">รายการแข่งขัน</label>
                <select
                  value={selectedCompId}
                  onChange={(e) => {
                    setSelectedCompId(e.target.value);
                    setSelectedTeamId('');
                  }}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none text-lg font-medium"
                >
                  <option value="">เลือกรายการแข่งขัน</option>
                  {competitions.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-base font-bold text-gray-700 mb-2">ทีมเข้าแข่งขัน</label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  disabled={!selectedCompId}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none disabled:opacity-50 text-lg font-medium"
                >
                  <option value="">เลือกทีม</option>
                  {filteredTeams.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.school})</option>
                  ))}
                </select>
                {selectedTeam && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">สมาชิกในทีม</div>
                    <div className="grid grid-cols-1 gap-2">
                      {selectedTeam.members.map((m: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-base text-gray-600">
                          <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-[10px] font-bold border border-gray-100">{i + 1}</div>
                          {m.name}
                        </div>
                      ))}
                      {selectedTeam.members.length === 0 && <div className="text-sm text-gray-400 italic">ไม่มีข้อมูลสมาชิก</div>}
                    </div>
                  </div>
                )}
              </div>
              {levelConfig && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-100">
                        <History className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-bold text-gray-900">รอบการแข่งขัน</span>
                    </div>
                    <div className="flex gap-2">
                      {['1', '2'].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRound(r)}
                          className={cn(
                            "w-12 h-12 rounded-xl font-bold transition-all",
                            round === r 
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
                              : "bg-white text-gray-400 hover:bg-gray-100"
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Missions */}
                  <div className="space-y-4">
                    {levelConfig.missions?.map((mission) => (
                      <div key={mission.id} className="p-6 bg-gray-50 rounded-3xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg",
                              levelConfig.theme === 'blue' ? 'bg-blue-500 shadow-blue-100' : 
                              levelConfig.theme === 'purple' ? 'bg-purple-500 shadow-purple-100' : 
                              levelConfig.theme === 'orange' ? 'bg-orange-500 shadow-orange-100' : 
                              levelConfig.theme === 'emerald' ? 'bg-emerald-500 shadow-emerald-100' : 
                              'bg-rose-500 shadow-rose-100'
                            )}>
                              <Target className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-900">{mission.name}</p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-widest">{mission.points} แต้ม / หน่วย</p>
                            </div>
                          </div>
                          {mission.type === 'toggle' ? (
                            <button
                              type="button"
                              onClick={() => setMissionValues({ ...missionValues, [mission.id]: !missionValues[mission.id] })}
                              className={cn(
                                "w-12 h-6 rounded-full transition-all relative",
                                missionValues[mission.id] ? "bg-green-500" : "bg-gray-300"
                              )}
                            >
                              <div className={cn(
                                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                                missionValues[mission.id] ? "left-7" : "left-1"
                              )} />
                            </button>
                          ) : (
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setMissionValues({ ...missionValues, [mission.id]: Math.max(0, (Number(missionValues[mission.id]) || 0) - 1) })}
                                className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
                              >
                                <ChevronDown className="w-5 h-5" />
                              </button>
                              <input
                                type="number"
                                value={missionValues[mission.id] || 0}
                                onChange={(e) => setMissionValues({ ...missionValues, [mission.id]: parseInt(e.target.value) || 0 })}
                                className="w-16 text-center bg-transparent border-none text-xl font-black text-gray-900 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setMissionValues({ ...missionValues, [mission.id]: (Number(missionValues[mission.id]) || 0) + 1 })}
                                className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
                              >
                                <ChevronUp className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-gray-50 rounded-3xl space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-100">
                          <RotateCcw className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">จำนวนการ Retry</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest">นับจำนวนครั้งที่เริ่มใหม่</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-4">
                        <button
                          type="button"
                          onClick={() => setRobotDetails({ ...robotDetails, retryCount: Math.max(0, robotDetails.retryCount - 1) })}
                          className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
                        >
                          <ChevronDown className="w-6 h-6" />
                        </button>
                        <span className="text-3xl font-black text-gray-900 w-12 text-center">{robotDetails.retryCount}</span>
                        <button
                          type="button"
                          onClick={() => setRobotDetails({ ...robotDetails, retryCount: robotDetails.retryCount + 1 })}
                          className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
                        >
                          <ChevronUp className="w-6 h-6" />
                        </button>
                      </div>
                    </div>

                    <div className="p-6 bg-gray-50 rounded-3xl space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">เวลาที่ใช้</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest">รูปแบบ MM.SS (ไม่เกิน 03.00)</p>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={robotDetails.timeUsed}
                        onChange={(e) => setRobotDetails({ ...robotDetails, timeUsed: e.target.value })}
                        placeholder="00.00"
                        className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-center text-2xl font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-gray-50 rounded-3xl space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-100">
                          <Weight className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">น้ำหนักหุ่นยนต์</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest">หน่วยเป็นกรัม</p>
                        </div>
                      </div>
                      <input
                        type="number"
                        value={robotDetails.robotWeight}
                        onChange={(e) => setRobotDetails({ ...robotDetails, robotWeight: e.target.value })}
                        placeholder="0"
                        className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-center text-2xl font-black text-gray-900 focus:ring-2 focus:ring-rose-500 outline-none transition-all"
                      />
                    </div>

                    <div className="p-6 bg-gray-50 rounded-3xl space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-100">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">ผู้รับทราบคะแนน</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest">ชื่อตัวแทนทีม</p>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={robotDetails.acknowledgment}
                        onChange={(e) => setRobotDetails({ ...robotDetails, acknowledgment: e.target.value })}
                        placeholder="ระบุชื่อ"
                        className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-center text-xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className={cn(
                    "pt-6 border-t-4 border-dashed",
                    levelConfig.theme === 'blue' ? "border-blue-100" :
                    levelConfig.theme === 'purple' ? "border-purple-100" :
                    levelConfig.theme === 'orange' ? "border-orange-100" :
                    levelConfig.theme === 'emerald' ? "border-emerald-100" :
                    "border-rose-100"
                  )}>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-sm font-bold text-gray-500 mb-1">คะแนนรวมที่คำนวณได้</p>
                        <p className="text-xs text-gray-400">คำนวณอัตโนมัติตามเกณฑ์ที่กำหนด</p>
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          "text-5xl font-black",
                          levelConfig.theme === 'blue' ? "text-blue-600" :
                          levelConfig.theme === 'purple' ? "text-purple-600" :
                          levelConfig.theme === 'orange' ? "text-orange-600" :
                          levelConfig.theme === 'emerald' ? "text-emerald-600" :
                          "text-rose-600"
                        )}>{scoreValue}</span>
                        <span className="text-lg font-bold text-gray-400 ml-2">
                          / {levelConfig.maxScore || 100} แต้ม
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!levelConfig && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-base font-bold text-gray-700 mb-2">คะแนน</label>
                    <input
                      type="number"
                      value={scoreValue}
                      onChange={(e) => setScoreValue(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-lg font-medium"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-base font-bold text-gray-700 mb-2">รอบที่</label>
                    <input
                      type="number"
                      value={round}
                      onChange={(e) => setRound(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-lg font-medium"
                      placeholder="1"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-base font-bold text-gray-700 mb-2">หมายเหตุ (ถ้ามี)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24 text-lg"
                  placeholder="รายละเอียดเพิ่มเติม..."
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {success && (
                <div className="p-4 bg-green-50 text-green-600 text-sm rounded-xl flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกคะแนน'}
              </button>
            </form>
          </div>
        </div>

        {/* Score History */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-purple-600" />
                  ประวัติบันทึก
                </div>
                <span className="text-[10px] text-gray-400 font-normal">รายการล่าสุด</span>
              </h2>
              {isAdmin && (
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-bold hover:bg-emerald-100 transition-all"
                >
                  <Download className="w-3 h-3" />
                  ส่งออก CSV
                </button>
              )}
            </div>

            <div className="space-y-3">
              {scores.map((s) => {
                const team = teams.find(t => t.id === s.teamId);
                const comp = competitions.find(c => c.id === s.competitionId);
                return (
                  <motion.div
                    key={s.id}
                    layout
                    className={cn(
                      "p-3 rounded-xl bg-gray-50 border border-gray-100 flex flex-col gap-2 group relative cursor-pointer hover:bg-white hover:shadow-md transition-all",
                      expandedScoreId === s.id && "bg-white shadow-md ring-1 ring-blue-100"
                    )}
                    onClick={() => setExpandedScoreId(expandedScoreId === s.id ? null : s.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-[8px] font-black text-blue-600 uppercase tracking-wider bg-blue-50 px-1 py-0.5 rounded">
                            R{s.round}
                          </span>
                          <h3 className="text-xs font-bold text-gray-900 truncate">{team?.name || 'N/A'}</h3>
                        </div>
                        <div className="text-[9px] text-gray-500 truncate">
                          {team?.school}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-black text-gray-900">{s.score}</div>
                        {expandedScoreId === s.id ? (
                          <ChevronUp className="w-3 h-3 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-gray-400" />
                        )}
                      </div>
                    </div>

                    <AnimatePresence>
                      {expandedScoreId === s.id && s.details && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 mt-1">
                            {s.details.checkpointCount !== undefined && s.details.checkpointCount > 0 && (
                              <div className="flex items-center gap-1 text-[9px] text-gray-600">
                                <Target className="w-2.5 h-2.5 text-blue-500" />
                                <span>CP: {s.details.checkpointCount}</span>
                              </div>
                            )}
                            {s.details.canPlacementCount !== undefined && (
                              <div className="flex items-center gap-1 text-[9px] text-gray-600">
                                <div className="w-2.5 h-2.5 bg-orange-400 rounded-sm" />
                                <span>กระป๋อง: {s.details.canPlacementCount}</span>
                              </div>
                            )}
                            {s.details.retryCount !== undefined && (
                              <div className="flex items-center gap-1 text-[9px] text-gray-600">
                                <RotateCcw className="w-2.5 h-2.5 text-purple-500" />
                                <span>Retry: {s.details.retryCount}</span>
                              </div>
                            )}
                            {s.details.timeUsed && (
                              <div className="flex items-center gap-1 text-[9px] text-gray-600">
                                <Clock className="w-2.5 h-2.5 text-green-500" />
                                <span>เวลา: {s.details.timeUsed}</span>
                              </div>
                            )}
                            {s.details.robotWeight && (
                              <div className="flex items-center gap-1 text-[9px] text-gray-600">
                                <Weight className="w-2.5 h-2.5 text-gray-500" />
                                <span>น้ำหนัก: {s.details.robotWeight}g</span>
                              </div>
                            )}
                            {s.details.acknowledgment && (
                              <div className="col-span-2 flex items-center gap-1 text-[9px] text-gray-500 italic mt-1">
                                <User className="w-2.5 h-2.5" />
                                <span className="truncate">ผู้รับทราบ: {s.details.acknowledgment}</span>
                              </div>
                            )}
                          </div>
                          {s.note && (
                            <div className="mt-2 text-[9px] text-gray-500 bg-gray-100 p-1.5 rounded-lg border border-gray-200">
                              <span className="font-bold">หมายเหตุ:</span> {s.note}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex items-center justify-between text-[8px] text-gray-400 border-t border-gray-100 pt-2">
                      <span className="truncate max-w-[60px]">{comp?.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[7px] text-gray-300">
                          {s.createdAt?.toDate ? new Date(s.createdAt.toDate()).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteScore(s.id);
                            }}
                            className="text-gray-300 hover:text-red-600 transition-all p-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              {scores.length === 0 && (
                <div className="p-6 text-center text-[10px] text-gray-400 italic">
                  ไม่มีข้อมูล
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Validation Errors Modal */}
      <AnimatePresence>
        {validationErrors.length > 0 && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setValidationErrors([])}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">บันทึกข้อมูลไม่ครบถ้วน</h3>
              <div className="space-y-2 mb-8">
                {validationErrors.map((err, i) => (
                  <p key={i} className="text-gray-600 text-sm flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                    {err}
                  </p>
                ))}
              </div>
              <button
                onClick={() => setValidationErrors([])}
                className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all"
              >
                รับทราบและแก้ไข
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-8">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ClipboardCheck className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-2 text-center">ยืนยันการบันทึกคะแนน</h3>
                <p className="text-gray-500 text-sm mb-8 text-center">
                  กรุณาตรวจสอบความถูกต้องของข้อมูลทั้งหมดก่อนกดยืนยัน
                </p>

                <div className="space-y-4 mb-8">
                  <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                      <span className="text-sm font-bold text-gray-500">ทีม</span>
                      <span className="text-sm font-black text-gray-900">{selectedTeam?.name}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                      <span className="text-sm font-bold text-gray-500">รายการแข่งขัน</span>
                      <span className="text-sm font-black text-gray-900">{selectedComp?.name}</span>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                      <span className="text-sm font-bold text-gray-500">รอบที่</span>
                      <span className="text-sm font-black text-gray-900">{round}</span>
                    </div>
                    
                    {levelConfig && (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="bg-white p-3 rounded-xl border border-gray-100">
                          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">เวลาที่ใช้</div>
                          <div className="text-sm font-black text-gray-900">{robotDetails.timeUsed} น.</div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-100">
                          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Retry</div>
                          <div className="text-sm font-black text-gray-900">{robotDetails.retryCount} ครั้ง</div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-100">
                          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">น้ำหนัก</div>
                          <div className="text-sm font-black text-gray-900">{robotDetails.robotWeight} กรัม</div>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-gray-100">
                          <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">ผู้รับทราบ</div>
                          <div className="text-sm font-black text-gray-900 truncate">{robotDetails.acknowledgment}</div>
                        </div>
                      </div>
                    )}

                    <div className="pt-3 flex justify-between items-center">
                      <span className="text-lg font-black text-gray-900">คะแนนรวมสุทธิ</span>
                      <span className="text-3xl font-black text-blue-600">{scoreValue} <span className="text-sm text-gray-400">แต้ม</span></span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                  >
                    ยืนยันบันทึก
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

