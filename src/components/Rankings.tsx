import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Trophy, Medal, School, Target, ChevronRight, Search, Filter, FileText, Download, Timer, RotateCcw, Box, ArrowUpRight, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface Score {
  teamId: string;
  competitionId: string;
  score: number;
  round: number;
  details?: {
    timeUsed?: string;
    retryCount?: number;
    robotWeight?: string | number;
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
}

interface CompetitionType {
  key: string;
  name: string;
}

const ScoreUpdateEffect = ({ value }: { value: number | string }) => {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -10, scale: 1.2 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="inline-block"
    >
      {value}
    </motion.span>
  );
};

export default function Rankings() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionTypes, setCompetitionTypes] = useState<CompetitionType[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const certificateRef = useRef<HTMLDivElement>(null);
  const [certData, setCertData] = useState<{ team: string, school: string, competition: string, rank: string } | null>(null);
  
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedComp, setSelectedComp] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Team[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teams');
    });

    const unsubComps = onSnapshot(collection(db, 'competitions'), (snapshot) => {
      setCompetitions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Competition[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'competitions');
    });

    const unsubTypes = onSnapshot(collection(db, 'competition_types'), (snapshot) => {
      setCompetitionTypes(snapshot.docs.map(doc => doc.data() as CompetitionType));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'competition_types');
    });

    const unsubScores = onSnapshot(collection(db, 'scores'), (snapshot) => {
      setScores(snapshot.docs.map(doc => doc.data() as Score));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'scores');
    });

    return () => {
      unsubTeams();
      unsubComps();
      unsubTypes();
      unsubScores();
    };
  }, []);

  const getRankings = () => {
    const isBetter = (s1: Score, s2: Score) => {
      if (s1.score !== s2.score) return s1.score > s2.score;
      
      const t1 = parseFloat(s1.details?.timeUsed || "999.99");
      const t2 = parseFloat(s2.details?.timeUsed || "999.99");
      if (t1 !== t2) return t1 < t2;

      const r1 = s1.details?.retryCount || 0;
      const r2 = s2.details?.retryCount || 0;
      if (r1 !== r2) return r1 < r2;

      const w1 = parseFloat(s1.details?.robotWeight?.toString() || "99999");
      const w2 = parseFloat(s2.details?.robotWeight?.toString() || "99999");
      return w1 < w2;
    };

    const teamBestScores: Record<string, Score> = {};
    const teamRoundScores: Record<string, Record<number, Score>> = {};
    
    scores.forEach(s => {
      const key = `${s.teamId}_${s.competitionId}`;
      if (!teamBestScores[key] || isBetter(s, teamBestScores[key])) {
        teamBestScores[key] = s;
      }

      if (!teamRoundScores[key]) teamRoundScores[key] = {};
      if (s.round === 1 || s.round === 2) {
        if (!teamRoundScores[key][s.round] || isBetter(s, teamRoundScores[key][s.round])) {
          teamRoundScores[key][s.round] = s;
        }
      }
    });

    let results = teams.map(team => {
      const relevantScores = Object.entries(teamBestScores)
        .filter(([key]) => key.startsWith(`${team.id}_`))
        .map(([_, scoreObj]) => scoreObj);

      const totalScore = relevantScores.reduce((sum, s) => sum + s.score, 0);

      return {
        ...team,
        totalScore,
        relevantScores,
        bestScoreObj: relevantScores[0],
        roundScores: teamRoundScores
      };
    });

    if (selectedLevel !== 'all') {
      results = results.filter(r => r.levelKey === selectedLevel);
    }

    if (selectedComp !== 'all') {
      results = results.filter(r => r.relevantScores.some(s => s.competitionId === selectedComp));
      results = results.map(r => {
        const compScore = r.relevantScores.find(s => s.competitionId === selectedComp);
        return {
          ...r,
          totalScore: compScore?.score || 0,
          bestScoreObj: compScore
        };
      });
    }

    if (search) {
      results = results.filter(r => 
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.school.toLowerCase().includes(search.toLowerCase())
      );
    }

    return results.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      
      if (a.bestScoreObj && b.bestScoreObj) {
        const t1 = parseFloat(a.bestScoreObj.details?.timeUsed || "999.99");
        const t2 = parseFloat(b.bestScoreObj.details?.timeUsed || "999.99");
        if (t1 !== t2) return t1 - t2;

        const r1 = a.bestScoreObj.details?.retryCount || 0;
        const r2 = b.bestScoreObj.details?.retryCount || 0;
        if (r1 !== r2) return r1 - r2;

        const w1 = parseFloat(a.bestScoreObj.details?.robotWeight?.toString() || "99999");
        const w2 = parseFloat(b.bestScoreObj.details?.robotWeight?.toString() || "99999");
        return w1 - w2;
      }
      
      return 0;
    });
  };

  const handleGenerateCertificate = async (team: any, index: number) => {
    const compName = competitions.find(c => c.id === selectedComp)?.name || '';
    const rankTitle = index === 0 ? 'ชนะเลิศ (1st Place)' : index === 1 ? 'รองชนะเลิศอันดับ 1 (2nd Place)' : 'รองชนะเลิศอันดับ 2 (3rd Place)';
    
    setCertData({
      team: team.name,
      school: team.school,
      competition: compName,
      rank: rankTitle
    });
    setGeneratingId(team.id);

    setTimeout(async () => {
      if (certificateRef.current) {
        try {
          const canvas = await html2canvas(certificateRef.current, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
          });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [canvas.width, canvas.height]
          });
          
          pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
          pdf.save(`Certificate_${team.name.replace(/\s+/g, '_')}.pdf`);
        } catch (error) {
          console.error('Error generating PDF:', error);
        } finally {
          setGeneratingId(null);
          setCertData(null);
        }
      }
    }, 100);
  };

  const rankings = getRankings();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black text-gray-900 flex items-center gap-4">
            <div className="bg-yellow-100 p-2 rounded-2xl">
              <Trophy className="w-10 h-10 text-yellow-600" />
            </div>
            สรุปผลคะแนนและอันดับ
          </h1>
          <p className="text-gray-500 mt-2 text-lg">Leaderboard สำหรับสรุปผลการแข่งขันแบบ Real-time</p>
        </div>

        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">จำนวนทีมทั้งหมด</div>
              <div className="text-2xl font-black text-gray-900">{teams.length} ทีม</div>
            </div>
            {competitionTypes.map(type => {
              const count = teams.filter(t => t.levelKey === type.key).length;
              const scoresInLevel = scores.filter(s => {
                const team = teams.find(t => t.id === s.teamId);
                return team?.levelKey === type.key;
              });
              const completedCount = new Set(scoresInLevel.filter(s => s.round === 1).map(s => s.teamId)).size;
              const isPending = completedCount < count;

              return (
                <div key={type.key} className={cn(
                  "p-4 rounded-2xl border transition-all relative overflow-hidden",
                  isPending 
                    ? "bg-red-50 border-red-200 shadow-[0_0_10px_rgba(239,68,68,0.05)]" 
                    : "bg-blue-50/50 border-blue-100/50"
                )}>
                  {isPending && (
                    <div className="absolute top-0 right-0 p-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                    </div>
                  )}
                  <div className={cn(
                    "text-[10px] font-black uppercase tracking-widest mb-1 truncate",
                    isPending ? "text-red-400" : "text-blue-400"
                  )} title={type.name}>{type.name}</div>
                  <div className="flex items-end justify-between">
                    <div className={cn(
                      "text-2xl font-black",
                      isPending ? "text-red-600" : "text-blue-600"
                    )}>{count} ทีม</div>
                    <div className="text-right">
                      <div className="text-[7px] font-black text-gray-400 uppercase leading-none mb-0.5">Scored</div>
                      <div className={cn(
                        "text-[10px] font-bold",
                        isPending ? "text-orange-600" : "text-emerald-600"
                      )}>{completedCount}/{count}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">ระดับการแข่งขัน</label>
              <select
                value={selectedLevel}
                onChange={(e) => { setSelectedLevel(e.target.value); setSelectedComp('all'); }}
                className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl text-sm font-bold outline-none appearance-none transition-all"
              >
                <option value="all">ทั้งหมด (All Levels)</option>
                {competitionTypes.map(type => (
                  <option key={type.key} value={type.key}>{type.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">รายการแข่งขัน</label>
              <select
                value={selectedComp}
                onChange={(e) => setSelectedComp(e.target.value)}
                disabled={selectedLevel === 'all'}
                className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl text-sm font-bold outline-none appearance-none transition-all disabled:opacity-50"
              >
                <option value="all">ทุกรายการ (All Competitions)</option>
                {competitions.filter(c => c.levelKey === selectedLevel).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">ค้นหาทีม/โรงเรียน</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-12 pr-5 py-3 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-2xl text-sm font-bold outline-none transition-all"
                  placeholder="ระบุคำค้น..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
          <div className="bg-white rounded-[32px] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <CertificateTemplate data={certData} innerRef={certificateRef} />
              
              <table className="w-full text-left border-collapse">
                <thead>
                  {selectedComp !== 'all' && (
                    <tr className="bg-gray-50/50 text-[11px] uppercase tracking-[0.2em] font-black text-gray-400 border-b border-gray-100">
                      <th colSpan={3} className="px-6 py-4"></th>
                      <th colSpan={4} className="px-4 py-4 text-center bg-emerald-50/30 border-x border-gray-100/50 text-emerald-600">
                        <div className="flex items-center justify-center gap-2">
                          <TrendingUp className="w-3 h-3" />
                          รอบที่ 1
                        </div>
                      </th>
                      <th colSpan={4} className="px-4 py-4 text-center bg-indigo-50/30 border-r border-gray-100/50 text-indigo-600">
                         <div className="flex items-center justify-center gap-2">
                          <TrendingUp className="w-3 h-3" />
                          รอบที่ 2
                        </div>
                      </th>
                      <th colSpan={2} className="px-6 py-4"></th>
                    </tr>
                  )}
                  <tr className="bg-gray-50/80 text-gray-400 text-[11px] uppercase tracking-[0.1em] font-bold border-b border-gray-100">
                    <th className="px-6 py-5 w-16 text-center">อันดับ</th>
                    <th className="px-6 py-5">ทีม / โรงเรียน</th>
                    {selectedComp !== 'all' && (
                      <>
                        <th className="px-4 py-5 text-center">
                          <div className="flex flex-col items-center">
                            <Target className="w-4 h-4 mb-1 text-emerald-500" />
                            <span className="text-emerald-700">คะแนน</span>
                          </div>
                        </th>
                        <th className="px-4 py-5 text-center">
                          <div className="flex flex-col items-center">
                            <Timer className="w-4 h-4 mb-1 text-blue-500" />
                            <span className="text-blue-700">เวลา</span>
                          </div>
                        </th>
                        <th className="px-4 py-5 text-center">
                          <div className="flex flex-col items-center">
                            <RotateCcw className="w-4 h-4 mb-1 text-orange-500" />
                            <span className="text-orange-700">Retry</span>
                          </div>
                        </th>
                        <th className="px-4 py-5 text-center">
                          <div className="flex flex-col items-center border-r border-gray-100/50 w-full">
                            <Box className="w-4 h-4 mb-1 text-slate-400" />
                            <span className="text-slate-600">น้ำหนัก</span>
                          </div>
                        </th>
                        
                        <th className="px-4 py-5 text-center">
                          <div className="flex flex-col items-center">
                            <Target className="w-4 h-4 mb-1 text-indigo-500" />
                            <span className="text-indigo-700">คะแนน</span>
                          </div>
                        </th>
                        <th className="px-4 py-5 text-center">
                          <div className="flex flex-col items-center">
                            <Timer className="w-4 h-4 mb-1 text-blue-500" />
                            <span className="text-blue-700">เวลา</span>
                          </div>
                        </th>
                        <th className="px-4 py-5 text-center">
                          <div className="flex flex-col items-center">
                            <RotateCcw className="w-4 h-4 mb-1 text-orange-500" />
                            <span className="text-orange-700">Retry</span>
                          </div>
                        </th>
                        <th className="px-4 py-5 text-center">
                          <div className="flex flex-col items-center border-r border-gray-100/50 w-full">
                            <Box className="w-4 h-4 mb-1 text-slate-400" />
                            <span className="text-slate-600">น้ำหนัก</span>
                          </div>
                        </th>
                      </>
                    )}
                    {selectedComp === 'all' && (
                      <th className="px-6 py-5 text-center w-32">ร่วมแข่ง</th>
                    )}
                    <th className="px-6 py-5 text-right w-32">คะแนนที่ดีที่สุด</th>
                    {selectedComp !== 'all' && (
                      <th className="px-6 py-5 text-center w-24">เกียรติบัตร</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {rankings.map((team, index) => (
                      <motion.tr
                        key={team.id}
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className={cn(
                          "group transition-all hover:bg-gray-50/80",
                          index < 3 ? "bg-white" : ""
                        )}
                      >
                        <td className="px-6 py-6 text-center">
                          <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center mx-auto font-black text-base shadow-sm ring-1 ring-black/5",
                            index === 0 ? "bg-gradient-to-br from-yellow-400 to-amber-600 text-white" :
                            index === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-white" :
                            index === 2 ? "bg-gradient-to-br from-orange-400 to-orange-700 text-white" :
                            "bg-gray-50 text-gray-400"
                          )}>
                            {index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="font-black text-gray-900 text-base flex items-center gap-2">
                              {team.name}
                              {index === 0 && <Medal className="w-4 h-4 text-yellow-500" />}
                            </div>
                            <div className="text-sm text-gray-500 font-bold flex items-center gap-2">
                              <School className="w-4 h-4 text-blue-400 opacity-60" />
                              {team.school}
                            </div>
                          </div>
                        </td>
                        {selectedComp !== 'all' && (
                          <>
                            <td className="px-4 py-4 text-center bg-emerald-50/5">
                              <div className="text-sm font-black text-emerald-600">
                                <ScoreUpdateEffect value={team.roundScores[`${team.id}_${selectedComp}`]?.[1]?.score ?? '-'} />
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center bg-emerald-50/5">
                              <div className="text-xs font-bold text-blue-500">
                                <ScoreUpdateEffect value={team.roundScores[`${team.id}_${selectedComp}`]?.[1]?.details?.timeUsed || '-'} />
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center bg-emerald-50/5">
                              <div className="text-xs font-bold text-orange-500">
                                <ScoreUpdateEffect value={team.roundScores[`${team.id}_${selectedComp}`]?.[1]?.details?.retryCount ?? '-'} />
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center bg-emerald-50/5 border-r border-gray-100/30">
                              <div className="text-xs font-bold text-slate-400">
                                <ScoreUpdateEffect value={team.roundScores[`${team.id}_${selectedComp}`]?.[1]?.details?.robotWeight ? `${team.roundScores[`${team.id}_${selectedComp}`][1].details.robotWeight}g` : '-'} />
                              </div>
                            </td>

                            <td className="px-4 py-4 text-center bg-indigo-50/5">
                              <div className="text-sm font-black text-indigo-600">
                                <ScoreUpdateEffect value={team.roundScores[`${team.id}_${selectedComp}`]?.[2]?.score ?? '-'} />
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center bg-indigo-50/5">
                              <div className="text-xs font-bold text-blue-500">
                                <ScoreUpdateEffect value={team.roundScores[`${team.id}_${selectedComp}`]?.[2]?.details?.timeUsed || '-'} />
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center bg-indigo-50/5">
                              <div className="text-xs font-bold text-orange-500">
                                <ScoreUpdateEffect value={team.roundScores[`${team.id}_${selectedComp}`]?.[2]?.details?.retryCount ?? '-'} />
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center bg-indigo-50/5 border-r border-gray-100/30">
                              <div className="text-xs font-bold text-slate-400">
                                <ScoreUpdateEffect value={team.roundScores[`${team.id}_${selectedComp}`]?.[2]?.details?.robotWeight ? `${team.roundScores[`${team.id}_${selectedComp}`][2].details.robotWeight}g` : '-'} />
                              </div>
                            </td>
                          </>
                        )}
                        {selectedComp === 'all' && (
                          <td className="px-6 py-4 text-center">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full text-xs font-black text-gray-600">
                              <Target className="w-3 h-3" />
                              {team.relevantScores.length}
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end">
                            <motion.div 
                              key={team.totalScore}
                              initial={{ scale: 1.2, color: '#2563eb' }}
                              animate={{ scale: 1, color: '#111827' }}
                              className="text-2xl font-black"
                            >
                              {team.totalScore}
                            </motion.div>
                            <div className="text-[10px] text-gray-400 uppercase font-black tracking-widest mt-0.5">points</div>
                          </div>
                        </td>
                        {selectedComp !== 'all' && (
                          <td className="px-6 py-4 text-center">
                            {index < 3 ? (
                              <button
                                onClick={() => handleGenerateCertificate(team, index)}
                                disabled={generatingId === team.id}
                                className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50 group/btn shadow-sm ring-1 ring-blue-100 hover:ring-blue-600 flex items-center justify-center mx-auto"
                                title="ดาวน์โหลดเกียรติบัตร"
                              >
                                {generatingId === team.id ? (
                                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Download className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                )}
                              </button>
                            ) : (
                              <div className="w-4 h-px bg-gray-200 mx-auto"></div>
                            )}
                          </td>
                        )}
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {rankings.length === 0 && (
                    <tr>
                      <td colSpan={selectedComp !== 'all' ? 14 : 4} className="px-8 py-32 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-30">
                          <Search className="w-16 h-16" />
                          <p className="text-xl font-black italic">ไม่พบข้อมูลอันดับในขณะนี้</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
      </div>
    </div>
  );
}

function CertificateTemplate({ data, innerRef }: { data: { team: string, school: string, competition: string, rank: string } | null, innerRef: React.RefObject<HTMLDivElement | null> }) {
  if (!data) return null;

  return (
    <div className="fixed -left-[4000px] top-0 pointer-events-none">
      <div 
        ref={innerRef}
        style={{ width: '1587px', height: '1123px' }}
        className="bg-white p-20 flex flex-col items-center justify-between border-[40px] border-double border-blue-900 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 -mr-48 -mt-48 rotate-45 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-50 -ml-48 -mb-48 rotate-45 pointer-events-none" />
        
        <div className="absolute inset-x-8 inset-y-8 border-[4px] border-blue-100 pointer-events-none" />
        
        <header className="text-center space-y-6 relative z-10 w-full mt-10">
          <div className="flex justify-center mb-8">
            <div className="bg-gradient-to-br from-blue-900 to-indigo-900 p-8 rounded-full shadow-2xl ring-8 ring-blue-50">
              <Trophy className="w-24 h-24 text-yellow-400" />
            </div>
          </div>
          <h1 className="text-7xl font-black text-blue-900 tracking-[0.2em] uppercase">Certificate</h1>
          <p className="text-2xl font-bold tracking-[0.5em] text-blue-400 uppercase">of achievement</p>
          <div className="h-1.5 w-64 bg-yellow-500 mx-auto rounded-full mt-6" />
        </header>

        <main className="flex-1 flex flex-col items-center justify-center py-20 space-y-12 relative z-10 w-full">
          <p className="text-3xl text-gray-500 italic font-medium">This certificate is proudly presented to</p>
          
          <div className="text-center w-full">
            <h2 className="text-8xl font-black text-gray-900 mb-4 px-20 border-b-4 border-gray-100 inline-block pb-4">{data.team}</h2>
            <div className="flex items-center justify-center gap-4 mt-6">
              <School className="w-8 h-8 text-blue-600" />
              <p className="text-3xl text-blue-900 font-black uppercase tracking-widest">{data.school}</p>
            </div>
          </div>

          <p className="text-2xl text-gray-500 font-medium tracking-widest uppercase">for achieving the distinct rank of</p>
          
          <div className="bg-gradient-to-b from-blue-50 to-white px-20 py-10 rounded-[40px] border-4 border-blue-200 shadow-xl text-center ring-8 ring-blue-50/50">
            <p className="text-5xl font-black text-blue-900 italic uppercase tracking-wider">{data.rank}</p>
          </div>

          <div className="text-center space-y-3">
            <p className="text-xl text-gray-400 font-black uppercase tracking-[0.3em]">in the competition</p>
            <p className="text-4xl font-black text-gray-800 tracking-tight">{data.competition}</p>
          </div>
        </main>

        <footer className="w-full flex justify-between items-end px-20 pb-10 relative z-10">
          <div className="text-center space-y-4">
             <div className="h-32 flex flex-col items-center justify-end">
                <div className="w-64 h-px bg-gray-200 mb-4" />
                <p className="text-lg font-black text-gray-400 uppercase tracking-widest">Committee Signature</p>
             </div>
          </div>
          
          <div className="text-center space-y-2 mb-4">
            <p className="text-sm font-black text-blue-400 uppercase tracking-widest">Issued on</p>
            <p className="text-3xl font-black text-blue-900">{new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div className="text-center space-y-4">
             <div className="h-32 flex flex-col items-center justify-end">
                <div className="w-64 h-px bg-gray-200 mb-4" />
                <p className="text-lg font-black text-gray-400 uppercase tracking-widest">Official Seal</p>
             </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
