import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Trophy, Activity, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface TickerScore {
  id: string;
  teamName: string;
  competitionName: string;
  score: number;
  timeUsed?: string;
  createdAt: any;
}

export default function LiveScoreTicker() {
  const [recentScores, setRecentScores] = useState<TickerScore[]>([]);
  const [teams, setTeams] = useState<Record<string, { name: string, school: string }>>({});
  const [competitions, setCompetitions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Continuous score listener
    const q = query(collection(db, 'scores'), orderBy('createdAt', 'desc'), limit(10));
    
    // We listen to teams and competitions snapshots once or continuously
    const unsubTeams = onSnapshot(collection(db, 'teams'), (snap) => {
      const mapping: Record<string, { name: string, school: string }> = {};
      snap.forEach(doc => mapping[doc.id] = { 
        name: doc.data().name, 
        school: doc.data().school 
      });
      setTeams(mapping);
    });

    const unsubComps = onSnapshot(collection(db, 'competitions'), (snap) => {
      const mapping: Record<string, string> = {};
      snap.forEach(doc => mapping[doc.id] = doc.data().name);
      setCompetitions(mapping);
    });

    const unsubScores = onSnapshot(q, (snap) => {
      const sc = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentScores(sc as any[]);
      setLoading(false);
    });

    return () => {
      unsubTeams();
      unsubComps();
      unsubScores();
    };
  }, []); // Empty dependency array

  if (loading || recentScores.length === 0) return null;

  // Process data for display
  const tickerItems = recentScores.map(score => {
    const teamData = teams[score.teamId];
    return {
      ...score,
      teamName: teamData?.name || 'กำลังโหลดชื่อทีม...',
      schoolName: teamData?.school || '',
      competitionName: competitions[score.competitionId] || 'กำลังโหลดรายการ...',
      score: score.score,
      timeUsed: score.details?.timeUsed
    };
  });

  return (
    <div className="bg-blue-600 overflow-hidden py-3 relative">
      <div className="absolute left-0 top-0 bottom-0 px-6 bg-blue-700 z-10 flex items-center gap-2 shadow-2xl skew-x-[-15deg] -ml-4">
        <Activity className="w-5 h-5 text-yellow-400 animate-pulse skew-x-[15deg]" />
        <span className="font-black text-white text-sm tracking-widest skew-x-[15deg]">LIVE SCORES</span>
      </div>

      <div className="flex whitespace-nowrap">
        <motion.div 
          className="flex gap-12 items-center"
          animate={{ x: [0, -2000] }}
          transition={{ 
            duration: 40, 
            repeat: Infinity, 
            ease: "linear" 
          }}
        >
          {/* Repeat multiple times for seamless scrolling */}
          {[...tickerItems, ...tickerItems, ...tickerItems, ...tickerItems].map((score, idx) => (
            <div key={`${score.id}-${idx}`} className="flex items-center gap-6 text-white pr-4">
              <div className="bg-white/10 px-3 py-1 rounded-lg flex items-center gap-2 border border-white/5">
                <Zap className="w-3 h-3 text-yellow-300" />
                <span className="font-bold text-[10px] uppercase tracking-wider text-blue-100">
                  {score.competitionName}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="font-black text-base tracking-tight leading-none">{score.teamName}</span>
                {score.schoolName && (
                  <span className="text-[10px] font-bold text-blue-200 mt-1 opacity-80">{score.schoolName}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="px-2.5 py-1 bg-yellow-400 text-blue-900 rounded-lg font-black text-sm shadow-sm">
                  {score.score}
                </div>
                {score.timeUsed && (
                  <span className="text-[10px] font-bold text-blue-200 bg-blue-700 px-1.5 py-0.5 rounded italic">
                    {score.timeUsed}s
                  </span>
                )}
              </div>
              <div className="w-1 h-1 rounded-full bg-blue-300 opacity-50" />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
