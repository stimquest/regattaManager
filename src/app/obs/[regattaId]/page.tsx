"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { doc, collection, CollectionReference } from "firebase/firestore";

import { useFirestore, useDoc, useCollection } from "@/firebase";
import type { Heat, Regatta, RegattaParticipant, Participant, Score } from "@/lib/types";

// Helper for live time gap
function timeToSeconds(timeStr: string) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
  }
  return 0;
}

function formatGap(seconds: number) {
  if (seconds === 0) return '-';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return "+" + min + ":" + sec.toString().padStart(2, '0');
}

function OBSPageContent() {
  const params = useParams();
  const regattaId = params.regattaId as string;
  
  // React State for OBS Controller
  const [obsMode, setObsMode] = React.useState<'overall' | 'live'>('overall');
  const [obsDiscards, setObsDiscards] = React.useState(0);
  const [obsSailType, setObsSailType] = React.useState('Général');
  const [obsCategory, setObsCategory] = React.useState('Général');

  const firestore = useFirestore();

  const regattaDocRef = React.useMemo(() => regattaId ? doc(firestore, 'regattas', regattaId) : null, [firestore, regattaId]);
  const { data: regatta, loading: loadingRegatta } = useDoc<Regatta>(regattaDocRef as any);

  const regattaParticipantsColRef = React.useMemo(() => {
      if (!regattaId) return null;
      return collection(firestore, 'regattas', regattaId, 'participants') as CollectionReference<RegattaParticipant>;
  }, [firestore, regattaId]);
  const { data: regattaParticipants, loading: loadingRegattaParticipants } = useCollection<RegattaParticipant>(regattaParticipantsColRef as any);

  const allParticipantsCollection = React.useMemo(() => collection(firestore, 'participants'), [firestore]);
  const { data: allParticipants, loading: loadingAllParticipants } = useCollection<Participant>(allParticipantsCollection as any);

  const activeHeat = React.useMemo(() => {
    if (!regatta) return null;
    const inProgress = regatta.heats.find(h => h.status === 'In Progress');
    if (inProgress) return inProgress;
    const finished = [...regatta.heats].reverse().find(h => h.status === 'Finished');
    return finished || null;
  }, [regatta]);

  // LIVE HEAT RESULTS LOGIC
  const liveResults = React.useMemo(() => {
    if (!activeHeat?.results || !regattaParticipants) return [];
    
    const enrichedResults = activeHeat.results.map(res => {
      const participant = regattaParticipants.find(p => p.id === res.regattaParticipantId);
      return { ...res, participant };
    });

    return enrichedResults.sort((a, b) => {
      if (a.status === 'Finished' && b.status === 'Finished') {
        return (a.passage.finish || '').localeCompare(b.passage.finish || '');
      }
      if (a.status === 'Finished') return -1;
      if (b.status === 'Finished') return 1;
      const bibA = parseInt(a.participant?.bibNumber || '0');
      const bibB = parseInt(b.participant?.bibNumber || '0');
      return bibA - bibB;
    });
  }, [activeHeat, regattaParticipants]);

  // OVERALL CLASSIFICATION LOGIC
  const overallResults = React.useMemo(() => {
    if (!regatta || !regattaParticipants) return [];
    const finishedHeats = regatta.heats.filter(h => h.status === 'Finished');
    if (finishedHeats.length === 0) return [];

    const overall: Record<string, any> = {};
    regattaParticipants.forEach(rp => {
      overall[rp.id] = { participant: rp, totalPoints: 0, scores: [] as Score[] };
    });

    const penaltyPoints = regattaParticipants.length + 1;

    finishedHeats.forEach(heat => {
      regattaParticipants.forEach(rp => {
        const result = heat.results.find(r => r.regattaParticipantId === rp.id);
        const score: Score = {
          heatId: heat.id,
          points: result?.points ?? penaltyPoints,
          rank: result?.rank ?? result?.status ?? 'N/A',
          isDiscarded: false,
        };
        overall[rp.id].scores.push(score);
      });
    });

    Object.keys(overall).forEach(id => {
      const pScores = overall[id].scores;
      const sortedScores = [...pScores].sort((a: Score, b: Score) => b.points - a.points);
      
      for (let i = 0; i < obsDiscards; i++) {
        if (sortedScores[i]) {
          const original = pScores.find((s: Score) => s.heatId === sortedScores[i].heatId && s.points === sortedScores[i].points && !s.isDiscarded);
          if (original) original.isDiscarded = true;
        }
      }

      overall[id].totalPoints = pScores.filter((s:Score) => !s.isDiscarded).reduce((acc:number, s:Score) => acc + s.points, 0);
    });

    return Object.values(overall).sort((a, b) => a.totalPoints - b.totalPoints);

  }, [regatta, regattaParticipants, obsDiscards]);

  const getParticipantName = React.useCallback((id: string) => allParticipants?.find(p => p.id === id)?.name ?? 'Inconnu', [allParticipants]);

  if (loadingRegatta || loadingRegattaParticipants || loadingAllParticipants) {
    return <div className="text-white p-4 font-bold text-xl drop-shadow-md">Chargement...</div>;
  }

  if (!regatta) {
    return <div className="text-white p-4 font-bold text-xl drop-shadow-md">Aucune régate en cours</div>;
  }

  const isOverallMode = obsMode === 'overall';
  let displayItems = isOverallMode ? overallResults : liveResults;

  // Apply visual category/discipline filters
  if (obsSailType !== 'Général' || obsCategory !== 'Général') {
    displayItems = displayItems.filter(item => {
      const mainParticipantId = item.participant?.crewIds?.[0];
      const mainParticipant = allParticipants?.find(p => p.id === mainParticipantId);
      
      if (obsSailType !== 'Général' && mainParticipant?.sailType !== obsSailType) return false;
      if (obsCategory !== 'Général' && mainParticipant?.category !== obsCategory) return false;
      return true;
    });
  }

  const noData = displayItems.length === 0;

  let firstFinisherTime = 0;
  if (!isOverallMode && displayItems.length > 0 && displayItems[0].status === 'Finished' && displayItems[0].passage?.finish) {
    firstFinisherTime = timeToSeconds(displayItems[0].passage.finish);
  }

  let firstPoints = 0;
  if (isOverallMode && displayItems.length > 0) {
    firstPoints = displayItems[0].totalPoints;
  }

  // Refined CSS for elegant pro look
  const cssStyle = [
    "@import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,600;1,700;1,800;1,900&display=swap');",
    "body { background: transparent !important; }",
    ".obs-container {",
    "   font-family: 'Montserrat', sans-serif;",
    "   width: 100%;",
    "   max-width: 580px;",
    "   background: transparent;",
    "   filter: drop-shadow(0px 12px 24px rgba(0,0,0,0.6));",
    "}",
    ".header-gradient {",
    "   background: linear-gradient(90deg, #051024 0%, #17325D 100%);",
    "}",
    ".badge-navy {",
    "   background-color: #12223a;",
    "}",
    ".skew-badge {",
    "   transform: skewX(-18deg);",
    "}",
    ".unskew-text {",
    "   transform: skewX(18deg);",
    "}",
    ".row-even { background-color: #ffffff; }",
    ".row-odd { background-color: #e8ecef; }",
    ".text-navy { color: #0f1c30; }"
  ].join("\n");

  return (
    <div className="flex min-h-screen w-full font-sans">
      <style dangerouslySetInnerHTML={{ __html: cssStyle }} />

      {/* OBS CAPTURE AREA (LEFT 70-75%) */}
      <div className="flex-1 p-8 overflow-hidden">
        
        {noData ? (
           <div className="obs-container shadow-2xl p-6 header-gradient text-white font-bold text-center rounded-md border-b-4 border-[#0A192F]">
               Aucun résultat trouvé pour ces critères...
           </div>
        ) : (
          <div className="obs-container flex flex-col overflow-hidden shadow-2xl rounded-md border-b-4 border-[#0A192F]">
            
            {/* PREMIUM TOP HEADER */}
            <div className="header-gradient text-white px-6 py-4 flex flex-col border-b-2 border-[#38BDF8]">
              <div className="text-[11px] text-[#9FB3C8] font-bold tracking-[0.2em] uppercase mb-1 flex justify-between">
                <span>CLUB ORGANISATEUR</span>
                <span className="text-right text-[#38BDF8]">
                   {(obsSailType !== 'Général' || obsCategory !== 'Général') ? (obsSailType !== 'Général' ? obsSailType + ' ' : '') + (obsCategory !== 'Général' ? obsCategory : '') : ''}
                   {isOverallMode && obsDiscards > 0 && " (-" + obsDiscards + ")"}
                </span>
              </div>
              <div className="text-lg font-black italic tracking-wider flex items-center justify-between w-full drop-shadow-md">
                  <span className="uppercase text-white">{regatta.name}</span>
                  {!isOverallMode && activeHeat?.status === 'In Progress' ? (
                    <div className="flex items-center gap-2 text-xs bg-red-600/20 px-3 py-1 rounded-full border border-red-500/50">
                      <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_#ef4444]"></span>
                      <span className="text-red-400 font-bold tracking-widest uppercase">En direct</span>
                    </div>
                  ) : (
                    <span className="text-xs text-[#38BDF8] uppercase font-bold tracking-widest">{isOverallMode ? 'Général' : 'Terminé'}</span>
                  )}
              </div>
            </div>

            {/* SUB HEADER TITLE WITH ICON */}
            <div className="bg-[#0f1c30] px-6 py-4 flex items-center shadow-inner relative z-10">
              <div className="flex space-x-1.5 mr-4 items-end h-[24px]">
                <div className="w-[5px] h-[14px] bg-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.4)]"></div>
                <div className="w-[5px] h-[24px] bg-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.4)]"></div>
                <div className="w-[5px] h-[18px] bg-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.4)]"></div>
              </div>
              <h2 className="text-[22px] font-black italic tracking-wide text-white uppercase drop-shadow-md">
                {isOverallMode 
                  ? 'CLASSEMENT PROVISOIRE' 
                  : (activeHeat?.name + ' - ' + (activeHeat?.status === 'Finished' ? 'CLASSEMENT DÉFINITIF' : 'TEMPS RÉEL'))}
              </h2>
            </div>

            {/* TABLE HEADER */}
            <div className="bg-white text-[#8192A6] text-[11px] font-bold tracking-[0.15em] uppercase px-5 py-2.5 flex justify-between border-b 2 border-gray-200 shadow-sm relative z-0">
              <div className="w-[50px] text-center">RG</div>
              <div className="flex-1 ml-5">BATEAU</div>
              <div className="w-[85px] text-right">{isOverallMode ? 'TOTAL (ÉCART)' : 'ÉCART'}</div>
            </div>

            {/* TABLE BODY */}
            <div className="flex flex-col bg-white">
              {displayItems.map((item: any, index: number) => {
                const isEven = index % 2 === 0;
                let gapText = '';
                
                if (isOverallMode) {
                  const pts = item.totalPoints;
                  const diff = pts - firstPoints;
                  gapText = diff > 0 ? pts + " (+"+diff+")" : pts + " pts";
                } else {
                    if (item.status === 'Finished' && item.passage?.finish) {
                      const myTime = timeToSeconds(item.passage.finish);
                      const diff = myTime - firstFinisherTime;
                      gapText = diff > 0 ? formatGap(diff) : '-';
                    } else if (item.status !== 'DNS') {
                      gapText = item.status; // DNF, PEN, etc.
                    } else {
                      gapText = ''; // Still running
                    }
                }

                const participant = item.participant;
                const crewNames = participant?.crewIds?.map((id:string) => getParticipantName(id)).join(', ') || '';

                return (
                  <div 
                    key={participant?.id}
                    className={"flex items-center px-4 py-3.5 " + (isEven ? 'row-even' : 'row-odd')}
                  >
                    {/* PREMIUM RANK BADGE */}
                    <div className="w-[50px] flex-shrink-0 flex justify-center">
                      <div className="badge-navy skew-badge h-[40px] w-[50px] flex items-center justify-center shadow-md">
                        <span className="unskew-text text-white font-black italic text-[22px] leading-none drop-shadow-sm">
                          {isOverallMode || item.status === 'Finished' ? (index + 1).toString().padStart(2, '0') : '-'}
                        </span>
                      </div>
                    </div>

                    {/* BOAT & SKIPPER INFO */}
                    <div className="flex-1 ml-5 flex flex-col justify-center overflow-hidden">
                      <span className="text-navy font-black italic text-[17px] leading-tight uppercase truncate flex items-center">
                        {participant?.entryName || 'Inconnu'}
                        {!isOverallMode && <span className="text-xs text-gray-400 font-bold ml-2 no-italic">#{participant?.bibNumber}</span>}
                      </span>
                      <span className="text-[#64748B] font-bold text-[11px] tracking-widest uppercase truncate mt-[3px]">
                        SKIPPER{crewNames.includes(',') ? 'S' : ''}: {crewNames}
                      </span>
                    </div>

                    {/* GAP / STATUS */}
                    <div className="w-[85px] text-right flex-shrink-0 font-bold text-[#475569] text-[15px]">
                      {gapText}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* OBS CONTROL PANEL (RIGHT 25-30%) - Cropped in OBS broadcast */}
      <div className="w-[420px] flex-shrink-0 bg-slate-900 border-l-[6px] border-[#38BDF8] overflow-y-auto p-6 text-white shadow-[-10px_0_30px_rgba(0,0,0,0.5)] relative z-50">
        <h3 className="text-xl font-black italic uppercase tracking-widest mb-6 text-[#38BDF8] mt-2">Pilote OBS</h3>
        
        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-bold text-[#9FB3C8] tracking-widest uppercase">Affichage en direct</label>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setObsMode('overall')}
                className={"p-3 rounded-lg font-bold text-left border transition " + (obsMode === 'overall' ? 'bg-[#17325D] border-[#38BDF8] text-white shadow-[0_0_10px_rgba(56,189,248,0.3)]' : 'bg-slate-800 border-slate-700 text-[#9FB3C8] hover:border-slate-500')}
              >
                <div className="text-[15px]">Classement Général</div>
              </button>
              <button 
                onClick={() => setObsMode('live')}
                className={"p-3 rounded-lg font-bold text-left border transition " + (obsMode === 'live' ? 'bg-red-900/50 border-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-slate-800 border-slate-700 text-[#9FB3C8] hover:border-slate-500')}
              >
                <div className="text-[15px]">Focus Manche (Temps Réel)</div>
              </button>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-800">
            <label className="text-sm font-bold text-[#9FB3C8] tracking-widest uppercase">Filtres de Catégories</label>
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-xs text-slate-400 mb-2 block font-bold">DISCIPLINE</span>
                <div className="flex flex-wrap gap-2">
                  {['Général', 'Windsurf', 'Wingfoil', 'Catamaran', 'Dinghy'].map(type => (
                    <button
                      key={type}
                      onClick={() => setObsSailType(type)}
                      className={"px-3 py-2 text-xs font-bold rounded-md border transition-colors " + (obsSailType === type ? 'bg-[#38BDF8] border-[#38BDF8] text-[#0A192F] tracking-wide shadow-[0_0_8px_rgba(56,189,248,0.4)]' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white')}
                    >
                      {type === 'Général' ? 'Toutes' : type}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400 mb-2 block font-bold">CATÉGORIE ÂGE/NIVEAU</span>
                <div className="flex flex-wrap gap-2">
                  {['Général', 'Jeune', 'Confirmé', 'Vétéran'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setObsCategory(cat)}
                      className={"px-3 py-2 text-xs font-bold rounded-md border transition-colors " + (obsCategory === cat ? 'bg-[#38BDF8] border-[#38BDF8] text-[#0A192F] tracking-wide shadow-[0_0_8px_rgba(56,189,248,0.4)]' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white')}
                    >
                      {cat === 'Général' ? 'Toutes' : cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={"space-y-3 pt-4 border-t border-slate-800 transition-opacity duration-300 " + (obsMode !== 'overall' ? 'opacity-30 pointer-events-none' : '')}>
            <label className="text-sm font-bold text-[#9FB3C8] tracking-widest uppercase">Retraits (Discards)</label>
            <div className="flex items-center gap-4 bg-slate-800 p-1.5 rounded-lg border border-slate-700">
               <button onClick={() => setObsDiscards(Math.max(0, obsDiscards - 1))} className="w-10 h-10 bg-slate-700 rounded hover:bg-slate-600 active:bg-slate-500 text-xl font-bold transition-colors">-</button>
               <span className="flex-1 text-center font-black text-2xl">{obsDiscards}</span>
               <button onClick={() => setObsDiscards(obsDiscards + 1)} className="w-10 h-10 bg-slate-700 rounded hover:bg-slate-600 active:bg-slate-500 text-xl font-bold transition-colors">+</button>
            </div>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Nombre de manches parmi les pires résultats à retirer du calcul final des points.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function OBSPage() {
  return (
    <React.Suspense fallback={<div className="text-white p-4 font-bold">Chargement...</div>}>
      <OBSPageContent />
    </React.Suspense>
  );
}
