import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Users, Timer, ChevronRight, Search, Filter, AlertCircle, CheckCircle2, Trophy, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Team {
  id: string;
  name: string;
  school: string;
  levelKey: string;
}

interface CompetitionType {
  key: string;
  name: string;
}

interface Score {
  teamId: string;
  competitionId: string;
  round: number;
}

export default function PendingTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitionTypes, setCompetitionTypes] = useState<CompetitionType[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedRound, setSelectedRound] = useState<number>(1);

  useEffect(() => {
    const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
    });

    const unsubTypes = onSnapshot(collection(db, 'competition_types'), (snapshot) => {
      setCompetitionTypes(snapshot.docs.map(doc => ({ key: doc.id, ...doc.data() } as CompetitionType)));
    });

    const unsubScores = onSnapshot(collection(db, 'scores'), (snapshot) => {
      setScores(snapshot.docs.map(doc => doc.data() as Score));
      setLoading(false);
    });

    return () => {
      unsubTeams();
      unsubTypes();
      unsubScores();
    };
  }, []);

  const getPendingTeams = () => {
    // A team is pending for a specific round if they DON'T have a score for that round
    // in THEIR respective competition type.
    
    let filteredTeams = teams;

    if (selectedLevel !== 'all') {
      filteredTeams = filteredTeams.filter(t => t.levelKey === selectedLevel);
    }

    if (search) {
      filteredTeams = filteredTeams.filter(t => 
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.school.toLowerCase().includes(search.toLowerCase())
      );
    }

    return filteredTeams.filter(team => {
      // Check if this team has a score for the selected round
      const hasCompeted = scores.some(s => s.teamId === team.id && s.round === selectedRound);
      return !hasCompeted;
    });
  };

  const pendingTeams = getPendingTeams();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-orange-600 p-2 rounded-xl text-white">
            <Timer className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-black text-gray-900 leading-tight">ทีมที่ยังไม่ได้แข่งขัน</h1>
            <p className="text-gray-400 text-sm font-medium">ตรวจสอบรายชื่อทีมที่ยังไม่ได้บันทึกคะแนน</p>
          </div>
        </div>
      </div>

      <div className="bg-white px-6 py-4 rounded-[24px] shadow-sm border border-gray-100 mb-6 flex flex-col lg:flex-row items-center gap-6">
        <div className="flex flex-col w-full lg:w-auto">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">ระดับการแข่งขัน</label>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-xl px-4 py-2 text-sm font-bold outline-none appearance-none transition-all lg:min-w-[180px]"
          >
            <option value="all">ทั้งหมด (All Levels)</option>
            {competitionTypes.map(type => (
              <option key={type.key} value={type.key}>{type.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col w-full lg:w-auto">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">รอบการแข่งขัน</label>
          <div className="flex bg-gray-100 p-1 rounded-xl w-full lg:w-[200px]">
            <button
              onClick={() => setSelectedRound(1)}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                selectedRound === 1 ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:bg-gray-200"
              )}
            >
              รอบที่ 1
            </button>
            <button
              onClick={() => setSelectedRound(2)}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                selectedRound === 2 ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:bg-gray-200"
              )}
            >
              รอบที่ 2
            </button>
          </div>
        </div>

        <div className="flex flex-col flex-1 w-full lg:w-auto">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">ค้นหาทีม/โรงเรียน</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-xl text-sm font-bold outline-none transition-all"
              placeholder="ระบุคำค้น..."
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {pendingTeams.map((team) => (
            <motion.div
              key={team.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-6 rounded-3xl border border-red-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden ring-1 ring-red-50/50"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
              <div className="flex items-start justify-between mb-4">
                <div className="bg-orange-50 p-3 rounded-2xl">
                  <Users className="w-6 h-6 text-orange-600" />
                </div>
                <div className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-wider">
                  {competitionTypes.find(t => t.key === team.levelKey)?.name || team.levelKey}
                </div>
              </div>
              <h3 className="text-base font-black text-gray-900 mb-1 group-hover:text-blue-600 transition-colors line-clamp-2 min-h-[2.5rem]">
                {team.name}
              </h3>
              <p className="text-gray-400 font-bold text-xs mb-4 line-clamp-2">
                {team.school}
              </p>
              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <div className="flex items-center gap-2 text-orange-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-widest">ยังไม่ได้แข่งรอบที่ {selectedRound}</span>
                </div>
                <div className="text-gray-300">
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {pendingTeams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[32px] border border-gray-100">
          <div className="bg-green-100 p-6 rounded-full mb-6">
            <CheckCircle2 className="w-16 h-16 text-green-600" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-2">แข่งครบทุกทีมแล้ว!</h3>
          <p className="text-gray-500 font-bold">ในระดับและรอบที่ท่านกำลังเลือก ทุกทีมทำการแข่งขันเรียบร้อยแล้ว</p>
        </div>
      )}

      <div className="mt-12 bg-blue-600 rounded-[32px] p-8 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative z-10">
          <h3 className="text-2xl font-black mb-2">สรุปความคืบหน้าการแข่งขัน</h3>
          <p className="text-blue-100 font-medium mb-6">ความคืบหน้าโดยรวมของทุกระดับชั้นในรอบที่ {selectedRound}</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {competitionTypes.map(type => {
              const totalInLevel = teams.filter(t => t.levelKey === type.key).length;
              const pendingInLevel = teams.filter(t => t.levelKey === type.key && !scores.some(s => s.teamId === t.id && s.round === selectedRound)).length;
              const completedInLevel = totalInLevel - pendingInLevel;
              const percent = totalInLevel > 0 ? (completedInLevel / totalInLevel) * 100 : 0;

              return (
                <div key={type.key} className={cn(
                  "backdrop-blur-md rounded-2xl p-4 border transition-all",
                  pendingInLevel > 0 
                    ? "bg-red-500/20 border-red-500/30 ring-1 ring-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]" 
                    : "bg-white/10 border-white/10"
                )}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-[10px] font-black text-blue-200 uppercase tracking-widest truncate">{type.name}</div>
                    {pendingInLevel > 0 && (
                      <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse shadow-[0_0_5px_rgba(248,113,113,0.8)]" />
                    )}
                  </div>
                  <div className="flex items-end gap-2 mb-3">
                    <div className={cn(
                      "text-2xl font-black",
                      pendingInLevel > 0 ? "text-red-100" : "text-white"
                    )}>{completedInLevel}/{totalInLevel}</div>
                    <div className="text-[10px] font-bold text-blue-200 mb-1">ทีม</div>
                  </div>
                  <div className="h-2 bg-blue-900/30 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      className={cn(
                        "h-full rounded-full transition-colors",
                        pendingInLevel > 0 ? "bg-red-400" : "bg-white"
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
