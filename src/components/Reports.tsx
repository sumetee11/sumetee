import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { FileText, Download, Printer, Filter, ChevronRight, Trophy, Medal, Users, Calendar, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import jspdf from 'jspdf';
import { toPng } from 'html-to-image';

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
  score: number;
  timeUsed?: string;
  retryCount?: number;
  robotWeight?: number;
  details?: {
    timeUsed?: string;
    retryCount?: number;
    robotWeight?: number;
  };
  createdAt: any;
}

export default function Reports() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitionTypes, setCompetitionTypes] = useState<CompetitionType[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedRound, setSelectedRound] = useState<number | 'best'>(1);

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

  const getReportData = () => {
    let filteredTeams = teams;
    if (selectedLevel !== 'all') {
      filteredTeams = teams.filter(t => t.levelKey === selectedLevel);
    }

    const reportData = filteredTeams.map(team => {
      const teamScores = scores.filter(s => s.teamId === team.id);
      
      let targetScore: Score | undefined;
      
      if (selectedRound === 'best') {
        // Find best score (highest score, then lowest time, then lowest weight)
        targetScore = [...teamScores].sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          
          const timeAValue = a.details?.timeUsed || a.timeUsed || '999';
          const timeBValue = b.details?.timeUsed || b.timeUsed || '999';
          const timeA = parseFloat(timeAValue);
          const timeB = parseFloat(timeBValue);
          
          if (timeA !== timeB) return timeA - timeB;
          
          const weightA = a.details?.robotWeight || a.robotWeight || 999;
          const weightB = b.details?.robotWeight || b.robotWeight || 999;
          return Number(weightA) - Number(weightB);
        })[0];
      } else {
        targetScore = teamScores.find(s => s.round === selectedRound);
      }

      return {
        ...team,
        scoreData: targetScore
      };
    });

    // Sort report selection
    return reportData.sort((a, b) => {
      const scoreA = a.scoreData?.score ?? -1;
      const scoreB = b.scoreData?.score ?? -1;
      
      if (scoreB !== scoreA) return scoreB - scoreA;
      
      const timeAValue = a.scoreData?.details?.timeUsed || a.scoreData?.timeUsed || '999';
      const timeBValue = b.scoreData?.details?.timeUsed || b.scoreData?.timeUsed || '999';
      const timeA = parseFloat(timeAValue);
      const timeB = parseFloat(timeBValue);
      
      if (timeA !== timeB) return timeA - timeB;
      
      const weightA = a.scoreData?.details?.robotWeight || a.scoreData?.robotWeight || 999;
      const weightB = b.scoreData?.details?.robotWeight || b.scoreData?.robotWeight || 999;
      return Number(weightA) - Number(weightB);
    });
  };

  const reportData = getReportData();

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('report-to-print');
    if (!element) return;

    try {
      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      
      const pdf = new jspdf('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`report-${selectedLevel}-${selectedRound}-${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('เกิดข้อผิดพลาดในการดาวน์โหลด PDF กรุณาใช้คำสั่งพิมพ์รายงาน (Print) แทน');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Header - Hidden on Print */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 leading-tight">รายงานสรุปผล</h1>
            <p className="text-gray-400 text-sm font-medium">สรุปผลการแข่งขันและอันดับคะแนน</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            <Download className="w-4 h-4" />
            PDF (Download)
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-white text-gray-700 px-4 py-2 rounded-xl text-sm font-bold border border-gray-200 hover:bg-gray-50 transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            พิมพ์รายงาน (Print)
          </button>
        </div>
      </div>

      {/* Filters - Hidden on Print */}
      <div className="bg-white px-6 py-4 rounded-[24px] shadow-sm border border-gray-100 mb-6 print:hidden flex flex-col md:flex-row items-center gap-6">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">ระดับการแข่งขัน</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="bg-gray-50 border-2 border-transparent focus:border-blue-500 rounded-xl px-4 py-2 text-sm font-bold outline-none appearance-none transition-all md:min-w-[200px]"
            >
              <option value="all">ทั้งหมด (All Levels)</option>
              {competitionTypes.map(type => (
                <option key={type.key} value={type.key}>{type.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col flex-1 w-full md:w-auto">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">เลือกการสรุปผลรอบการแข่งขัน</label>
          <div className="flex bg-gray-100 p-1 rounded-xl w-full">
            <button
              onClick={() => setSelectedRound(1)}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-black transition-all",
                selectedRound === 1 ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:bg-gray-200"
              )}
            >
              รอบที่ 1
            </button>
            <button
              onClick={() => setSelectedRound(2)}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-black transition-all",
                selectedRound === 2 ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:bg-gray-200"
              )}
            >
              รอบที่ 2
            </button>
            <button
              onClick={() => setSelectedRound('best')}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-black transition-all",
                selectedRound === 'best' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:bg-gray-200"
              )}
            >
              คะแนนที่ดีที่สุด
            </button>
          </div>
        </div>
      </div>

      {/* Report Layout */}
      <div id="report-to-print" className="bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden print:border-none print:shadow-none">
        <div className="p-10">
          <div className="text-center mb-10 border-b-4 border-double border-gray-900 pb-6">
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-1 uppercase tracking-tighter">สรุปผลการแข่งขันหุ่นยนต์อัตโนมัติ (ROBOT Competition)</h1>
            <div className="flex flex-col items-center gap-4 mt-6">
              <div className="inline-flex items-center gap-3 px-6 py-2 bg-blue-600 text-white rounded-2xl text-xl font-bold shadow-lg shadow-blue-100">
                <Trophy className="w-6 h-6" />
                ประเภท: {selectedLevel === 'all' ? 'ทุกประเภทการแข่งขัน' : competitionTypes.find(t => t.key === selectedLevel)?.name}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mt-4">
                <div className="flex flex-col items-center p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">วันที่แข่งขัน</span>
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
                
                <div className="flex flex-col items-center p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">จำนวนทีม</span>
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    <Users className="w-4 h-4 text-blue-500" />
                    {reportData.length} ทีม
                  </div>
                </div>

                <div className="flex flex-col items-center p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">สรุปผล</span>
                  <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    <Medal className="w-4 h-4 text-emerald-500" />
                    {selectedRound === 'best' ? 'คะแนนที่ดีที่สุด' : `รอบที่ ${selectedRound}`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden flex-col md:flex-row justify-between items-center gap-6 mb-10 print:hidden">
            <div>
              <h2 className="text-4xl font-black text-gray-900 tracking-tighter mb-2">รางวัลและอันดับ</h2>
              <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-gray-400">
                <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {reportData.length} ทีมที่เข้าร่วม</span>
                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <div className="px-6 py-2 bg-gray-900 text-white rounded-full text-sm font-black uppercase tracking-widest shadow-lg shadow-gray-200">
                {selectedRound === 'best' ? 'BEST' : `ROUND ${selectedRound}`}
              </div>
              {selectedLevel !== 'all' && (
                <div className="px-6 py-2 bg-blue-600 text-white rounded-full text-sm font-black uppercase tracking-widest shadow-lg shadow-blue-100">
                  {competitionTypes.find(t => t.key === selectedLevel)?.name}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-900">
                  <th className="py-4 px-2 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">อันดับ</th>
                  <th className="py-4 px-2 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">ทีม / โรงเรียน</th>
                  <th className="py-4 px-2 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">ระดับ</th>
                  <th className="py-4 px-2 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">รอบ</th>
                  <th className="py-4 px-2 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">คะแนน</th>
                  <th className="py-4 px-2 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">เวลา</th>
                  <th className="py-4 px-2 text-center text-[10px] font-black text-red-500 uppercase tracking-widest">Retry</th>
                  <th className="py-4 px-2 text-center text-[10px] font-black text-blue-500 uppercase tracking-widest">น้ำหนัก</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map((data, index) => {
                  const isRanked = data.scoreData !== undefined;
                  const rank = index + 1;
                  
                  return (
                    <tr key={data.id} className={cn(
                      "border-b border-gray-100 transition-colors",
                      !isRanked && "opacity-40 grayscale",
                      rank <= 3 && isRanked && "bg-blue-50/30 print:bg-transparent"
                    )}>
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-3">
                          {rank <= 3 && isRanked ? (
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black",
                              rank === 1 ? "bg-yellow-500 shadow-lg shadow-yellow-100 print:bg-gray-100 print:text-black print:border print:border-gray-300" :
                              rank === 2 ? "bg-gray-400 shadow-lg shadow-gray-100 print:bg-gray-100 print:text-black print:border print:border-gray-300" :
                              "bg-orange-400 shadow-lg shadow-orange-100 print:bg-gray-100 print:text-black print:border print:border-gray-300"
                            )}>
                              {rank}
                            </div>
                          ) : (
                            <span className="text-sm font-black text-gray-300 ml-2">{rank}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-2">
                        <div>
                          <div className="text-sm font-black text-gray-900">{data.name}</div>
                          <div className="text-[10px] font-bold text-gray-400">{data.school}</div>
                        </div>
                      </td>
                      <td className="py-4 px-2">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-100 px-1.5 py-0.5 rounded-md print:bg-transparent print:border print:border-gray-100">
                          {competitionTypes.find(t => t.key === data.levelKey)?.name || data.levelKey}
                        </span>
                      </td>
                      <td className="py-4 px-2 text-center">
                        <span className="text-xs font-bold text-gray-600">
                          {isRanked ? (data.scoreData?.round || '-') : '-'}
                        </span>
                      </td>
                      <td className="py-4 px-2 text-center">
                        {isRanked ? (
                          <span className="text-lg font-black text-blue-600">{data.scoreData?.score}</span>
                        ) : (
                          <span className="text-sm font-bold text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-4 px-2 text-center">
                        {isRanked ? (
                          <span className="text-xs font-bold text-gray-600">
                            {data.scoreData?.details?.timeUsed || data.scoreData?.timeUsed || '-'} น.
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-4 px-2 text-center">
                        <div className={cn(
                          "inline-flex items-center justify-center min-w-[24px] h-6 rounded-lg font-black text-xs",
                          isRanked ? "bg-red-50 text-red-600 border border-red-100 print:bg-transparent print:border-none" : "text-gray-300"
                        )}>
                          {isRanked ? (data.scoreData?.details?.retryCount ?? data.scoreData?.retryCount ?? '-') : '-'}
                        </div>
                      </td>
                      <td className="py-4 px-2 text-center">
                        <div className={cn(
                          "inline-flex items-center justify-center px-2 h-6 rounded-lg font-black text-xs",
                          isRanked ? "bg-blue-50 text-blue-600 border border-blue-100 print:bg-transparent print:border-none" : "text-gray-300"
                        )}>
                          {isRanked ? `${data.scoreData?.details?.robotWeight ?? data.scoreData?.robotWeight ?? '-'} ก.` : '-'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-12 hidden print:grid grid-cols-3 gap-12 text-center pt-10 border-t border-gray-100">
            <div className="space-y-16">
              <div className="h-px w-full bg-gray-300" />
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest">ลงชื่อ กรรมการผู้ตัดสิน</p>
            </div>
            <div className="space-y-16">
              <div className="h-px w-full bg-gray-300" />
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest">ลงชื่อ ผู้จัดการการแข่งขัน</p>
            </div>
            <div className="space-y-16">
              <div className="h-px w-full bg-gray-300" />
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest">ลงชื่อ ประธานจัดงาน</p>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          nav { display: none !important; }
          .max-w-7xl { max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
