import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Trophy, Medal, School, Target, ChevronRight, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';

interface Score {
  teamId: string;
  competitionId: string;
  score: number;
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

export default function Rankings() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionTypes, setCompetitionTypes] = useState<CompetitionType[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  
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
    // Helper to compare two scores based on the new rules
    const isBetter = (s1: Score, s2: Score) => {
      if (s1.score !== s2.score) return s1.score > s2.score;
      
      const t1 = parseFloat(s1.details?.timeUsed || "99.99");
      const t2 = parseFloat(s2.details?.timeUsed || "99.99");
      if (t1 !== t2) return t1 < t2;

      const r1 = s1.details?.retryCount || 0;
      const r2 = s2.details?.retryCount || 0;
      if (r1 !== r2) return r1 < r2;

      const w1 = parseFloat(s1.details?.robotWeight?.toString() || "99999");
      const w2 = parseFloat(s2.details?.robotWeight?.toString() || "99999");
      return w1 < w2;
    };

    // Group scores by team and competition, keeping the BEST score for each
    const teamBestScores: Record<string, Score> = {};
    const teamRoundScores: Record<string, Record<number, Score>> = {};
    
    scores.forEach(s => {
      const key = `${s.teamId}_${s.competitionId}`;
      if (!teamBestScores[key] || isBetter(s, teamBestScores[key])) {
        teamBestScores[key] = s;
      }

      // Track scores for Round 1 and Round 2
      if (!teamRoundScores[key]) teamRoundScores[key] = {};
      if (s.round === 1 || s.round === 2) {
        // If multiple entries for same round, take the "better" one
        if (!teamRoundScores[key][s.round] || isBetter(s, teamRoundScores[key][s.round])) {
          teamRoundScores[key][s.round] = s;
        }
      }
    });

    // Map teams with their scores
    let results = teams.map(team => {
      // Find all best scores for this team across different competitions
      const relevantScores = Object.entries(teamBestScores)
        .filter(([key]) => key.startsWith(`${team.id}_`))
        .map(([_, scoreObj]) => scoreObj);

      // For total ranking, we sum the scores, but tie-breaking is tricky.
      // Usually tie-breaking applies to a single competition.
      const totalScore = relevantScores.reduce((sum, s) => sum + s.score, 0);

      return {
        ...team,
        totalScore,
        relevantScores,
        // Store the "best" score details for tie-breaking when filtering by competition
        bestScoreObj: relevantScores[0], // Default, will be refined if filtering
        roundScores: teamRoundScores
      };
    });

    // Filter by level
    if (selectedLevel !== 'all') {
      results = results.filter(r => r.levelKey === selectedLevel);
    }

    // Filter by competition
    if (selectedComp !== 'all') {
      results = results.filter(r => r.relevantScores.some(s => s.compId === selectedComp || (s as any).competitionId === selectedComp));
      results = results.map(r => {
        const compScore = r.relevantScores.find(s => (s as any).competitionId === selectedComp);
        return {
          ...r,
          totalScore: compScore?.score || 0,
          bestScoreObj: compScore
        };
      });
    }

    // Filter by search
    if (search) {
      results = results.filter(r => 
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.school.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Sort with tie-breaking
    return results.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      
      // Tie-breaking logic (only really applies if we have bestScoreObj)
      if (a.bestScoreObj && b.bestScoreObj) {
        const t1 = parseFloat(a.bestScoreObj.details?.timeUsed || "99.99");
        const t2 = parseFloat(b.bestScoreObj.details?.timeUsed || "99.99");
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
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <Medal className="w-8 h-8 text-yellow-500" />
            สรุปผลคะแนนและอันดับ
          </h1>
          <p className="text-gray-500 mt-1">ตารางอันดับคะแนนรวมแยกตามระดับและรายการแข่งขัน</p>
        </div>

        {/* Filters moved here */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">ระดับการแข่งขัน</label>
              <select
                value={selectedLevel}
                onChange={(e) => { setSelectedLevel(e.target.value); setSelectedComp('all'); }}
                className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
              >
                <option value="all">ทั้งหมด</option>
                {competitionTypes.map(type => (
                  <option key={type.key} value={type.key}>{type.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              {selectedLevel !== 'all' && (
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">รายการแข่งขัน</label>
                  <select
                    value={selectedComp}
                    onChange={(e) => setSelectedComp(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                  >
                    <option value="all">ทุกรายการ</option>
                    {competitions.filter(c => c.levelKey === selectedLevel).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">ค้นหาทีม/โรงเรียน</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="ระบุคำค้น..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  {selectedComp !== 'all' && (
                    <tr className="bg-gray-100/50 text-[10px] uppercase tracking-widest font-black text-gray-400">
                      <th colSpan={2} className="px-4 py-2"></th>
                      <th colSpan={4} className="px-2 py-2 text-center bg-emerald-100/30 border-x border-emerald-200/30 text-emerald-600">รอบที่ 1 (Round 1)</th>
                      <th colSpan={4} className="px-2 py-2 text-center bg-indigo-100/30 border-r border-indigo-200/30 text-indigo-600">รอบที่ 2 (Round 2)</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  )}
                  <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider font-bold border-b border-gray-100">
                    <th className="px-4 py-3 w-12 text-center">อันดับ</th>
                    <th className="px-4 py-3 min-w-[180px]">ทีม / โรงเรียน</th>
                    {selectedComp !== 'all' && (
                      <>
                        {/* Round 1 Header Group */}
                        <th className="px-1 py-3 text-center bg-emerald-50/50 border-x border-emerald-100/50 text-emerald-700">คะแนน</th>
                        <th className="px-1 py-3 text-center bg-emerald-50/50 border-r border-emerald-100/50 text-blue-600">เวลา</th>
                        <th className="px-1 py-3 text-center bg-emerald-50/50 border-r border-emerald-100/50 text-orange-600">Retry</th>
                        <th className="px-1 py-3 text-center bg-emerald-50/50 border-r border-emerald-100/50 text-slate-500">น้ำหนัก</th>
                        
                        {/* Round 2 Header Group */}
                        <th className="px-1 py-3 text-center bg-indigo-50/50 border-r border-indigo-100/50 text-indigo-700">คะแนน</th>
                        <th className="px-1 py-3 text-center bg-indigo-50/50 border-r border-indigo-100/50 text-blue-600">เวลา</th>
                        <th className="px-1 py-3 text-center bg-indigo-50/50 border-r border-indigo-100/50 text-orange-600">Retry</th>
                        <th className="px-1 py-3 text-center bg-indigo-50/50 border-r border-indigo-100/50 text-slate-500">น้ำหนัก</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-right">คะแนนดีสุด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rankings.map((team, index) => (
                    <tr key={team.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-4 py-4 text-center">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center mx-auto font-black text-sm",
                          index === 0 ? "bg-yellow-100 text-yellow-600 shadow-sm" :
                          index === 1 ? "bg-gray-100 text-gray-600 shadow-sm" :
                          index === 2 ? "bg-orange-100 text-orange-600 shadow-sm" :
                          "text-gray-400"
                        )}>
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900 text-[13px] truncate max-w-[160px]" title={team.name}>{team.name}</div>
                        <div className="text-[9px] text-gray-400 flex items-center gap-1 mt-0.5 truncate max-w-[160px]" title={team.school}>
                          <School className="w-2.5 h-2.5" />
                          {team.school}
                        </div>
                      </td>
                      {selectedComp !== 'all' && (
                        <>
                          {/* Round 1 Data Group */}
                          <td className="px-1 py-3 text-center bg-emerald-50/10 border-x border-emerald-100/20">
                            <div className="text-xs font-black text-emerald-600">
                              {team.roundScores[`${team.id}_${selectedComp}`]?.[1]?.score ?? '-'}
                            </div>
                          </td>
                          <td className="px-1 py-3 text-center bg-emerald-50/10 border-r border-emerald-100/20">
                            <div className="text-[9px] font-bold text-blue-500">
                              {team.roundScores[`${team.id}_${selectedComp}`]?.[1]?.details?.timeUsed || '-'}
                            </div>
                          </td>
                          <td className="px-1 py-3 text-center bg-emerald-50/10 border-r border-emerald-100/20">
                            <div className="text-[9px] font-bold text-orange-500">
                              {team.roundScores[`${team.id}_${selectedComp}`]?.[1]?.details?.retryCount ?? '-'}
                            </div>
                          </td>
                          <td className="px-1 py-3 text-center bg-emerald-50/10 border-r border-emerald-100/20">
                            <div className="text-[9px] font-bold text-slate-400">
                              {team.roundScores[`${team.id}_${selectedComp}`]?.[1]?.details?.robotWeight ? `${team.roundScores[`${team.id}_${selectedComp}`][1].details.robotWeight}g` : '-'}
                            </div>
                          </td>

                          {/* Round 2 Data Group */}
                          <td className="px-1 py-3 text-center bg-indigo-50/10 border-r border-indigo-100/20">
                            <div className="text-xs font-black text-indigo-600">
                              {team.roundScores[`${team.id}_${selectedComp}`]?.[2]?.score ?? '-'}
                            </div>
                          </td>
                          <td className="px-1 py-3 text-center bg-indigo-50/10 border-r border-indigo-100/20">
                            <div className="text-[9px] font-bold text-blue-500">
                              {team.roundScores[`${team.id}_${selectedComp}`]?.[2]?.details?.timeUsed || '-'}
                            </div>
                          </td>
                          <td className="px-1 py-3 text-center bg-indigo-50/10 border-r border-indigo-100/20">
                            <div className="text-[9px] font-bold text-orange-500">
                              {team.roundScores[`${team.id}_${selectedComp}`]?.[2]?.details?.retryCount ?? '-'}
                            </div>
                          </td>
                          <td className="px-1 py-3 text-center bg-indigo-50/10 border-r border-indigo-100/20">
                            <div className="text-[9px] font-bold text-slate-400">
                              {team.roundScores[`${team.id}_${selectedComp}`]?.[2]?.details?.robotWeight ? `${team.roundScores[`${team.id}_${selectedComp}`][2].details.robotWeight}g` : '-'}
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right">
                        <div className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors">
                          {team.totalScore}
                        </div>
                        <div className="text-[8px] text-gray-400 uppercase font-bold">คะแนน</div>
                      </td>
                    </tr>
                  ))}
                  {rankings.length === 0 && (
                    <tr>
                      <td colSpan={selectedComp !== 'all' ? 11 : 4} className="px-8 py-20 text-center text-gray-400 italic">
                        ไม่พบข้อมูลอันดับ
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
