/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Radio, CheckSquare, Clock, User, ArrowRightLeft, Pause, Play, 
  CheckCircle2, AlertTriangle, FileText, Send, UserCheck, ChevronRight 
} from 'lucide-react';
import { localDb } from '../db/localDb';
import { Profile, Request, RequestComment } from '../types';

interface HelpdeskProps {
  user: Profile;
  onNavigate: (path: string) => void;
}

export default function Helpdesk({ user, onNavigate }: HelpdeskProps) {
  const [tickets, setTickets] = useState<Request[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Filtering & tabs
  const [activeQueueTab, setActiveQueueTab] = useState<'mine' | 'unassigned' | 'resolved'>('unassigned');
  
  // Custom ticket actions
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState<'public' | 'internal'>('public');

  // Transfer sector state
  const [transferSectorId, setTransferSectorId] = useState('');

  const sectors = localDb.getSectors();

  useEffect(() => {
    loadTickets();
  }, [user, activeQueueTab]);

  const loadTickets = () => {
    const all = localDb.getRequests().filter(r => r.type === 'chamado');
    let filtered: Request[] = [];

    // Filter tickets targeting user's active sector helpdesk (e.g., TI or Facilities)
    const mySectorTickets = all.filter(r => r.target_sector_id === user.sector_id);

    if (activeQueueTab === 'mine') {
      filtered = mySectorTickets.filter(r => r.status === 'em_atendimento' || r.status === 'aguardando_solicitante');
    } else if (activeQueueTab === 'unassigned') {
      filtered = mySectorTickets.filter(r => r.status === 'aberto');
    } else { // resolved / closed
      filtered = mySectorTickets.filter(r => r.status === 'resolvido' || r.status === 'fechado');
    }

    setTickets(filtered);
    if (filtered.length > 0) {
      setSelectedId(filtered[0].id);
    } else {
      setSelectedId(null);
    }
  };

  const selectedTicket = tickets.find(r => r.id === selectedId);
  const comments = selectedTicket ? localDb.getRequestComments(selectedTicket.id) : [];

  const handleTakeOver = () => {
    if (!selectedTicket) return;
    localDb.updateRequestStatus(selectedTicket.id, 'em_atendimento', user.id, 'Técnico assumiu o atendimento do chamado.');
    loadTickets();
  };

  const handleResolve = () => {
    if (!selectedTicket) return;
    localDb.updateRequestStatus(selectedTicket.id, 'resolvido', user.id, 'Chamado resolvido com sucesso pelo suporte.');
    loadTickets();
  };

  const handlePauseSLA = () => {
    if (!selectedTicket) return;
    // Toggles between waiting for user (paused) or in progress
    const nextStatus = selectedTicket.status === 'em_atendimento' ? 'aguardando_solicitante' : 'em_atendimento';
    const msg = nextStatus === 'aguardando_solicitante' 
      ? 'Atendimento pausado: Aguardando retorno com informações do solicitante.' 
      : 'Atendimento retomado pelo suporte técnico.';

    localDb.updateRequestStatus(selectedTicket.id, nextStatus, user.id, msg);
    loadTickets();
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !transferSectorId) return;

    // Simulate transfer by updating target_sector_id
    localDb.transferTicketSector(selectedTicket.id, transferSectorId, user.id);
    setTransferSectorId('');
    loadTickets();
  };

  const handlePostNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !noteText.trim()) return;

    localDb.addComment(selectedTicket.id, user.id, noteText.trim(), noteType);
    setNoteText('');
    loadTickets();
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      aberto: 'Aberto (Fila)',
      em_atendimento: 'Em Atendimento',
      aguardando_solicitante: 'Pausado (Aguardando Solicitante)',
      resolvido: 'Resolvido',
      fechado: 'Fechado'
    };
    return labels[status] || status;
  };

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-100px)] -m-6 overflow-hidden">
      
      {/* Left panel: Active Queues */}
      <div className="w-full lg:w-2/5 border-r border-slate-100 bg-white flex flex-col h-full text-left">
        <div className="p-4 border-b border-slate-50 space-y-3">
          <h2 className="text-lg font-bold text-slate-800">Atendimento Helpdesk</h2>
          
          {/* Queues selector */}
          <div className="flex rounded-lg border border-slate-100 p-0.5 bg-slate-50/50 text-xs">
            <button
              onClick={() => setActiveQueueTab('unassigned')}
              className={`flex-1 rounded py-1.5 font-bold transition-all text-center cursor-pointer ${activeQueueTab === 'unassigned' ? 'bg-white shadow-sm text-emerald-800' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Não Atribuídos ({localDb.getRequests().filter(r => r.type === 'chamado' && r.status === 'aberto' && r.target_sector_id === user.sector_id).length})
            </button>
            <button
              onClick={() => setActiveQueueTab('mine')}
              className={`flex-1 rounded py-1.5 font-bold transition-all text-center cursor-pointer ${activeQueueTab === 'mine' ? 'bg-white shadow-sm text-emerald-800' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Meus Atendimentos
            </button>
            <button
              onClick={() => setActiveQueueTab('resolved')}
              className={`flex-1 rounded py-1.5 font-bold transition-all text-center cursor-pointer ${activeQueueTab === 'resolved' ? 'bg-white shadow-sm text-emerald-800' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Encerrados
            </button>
          </div>
        </div>

        {/* Ticket List queue */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {tickets.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">Nenhum chamado nesta fila.</div>
          ) : (
            tickets.map((t) => {
              const isSelected = t.id === selectedId;
              const formattedDate = new Date(t.created_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex flex-col space-y-1.5 border-l-4 ${isSelected ? 'bg-emerald-50/30 border-emerald-600' : 'border-transparent'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-500">#{t.number}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${t.criticality >= 4 ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`} title={`Criticidade ${t.criticality}`} />
                  </div>
                  <p className="text-xs font-semibold text-slate-800 truncate max-w-[260px]">
                    {t.justificativa || 'Incidente sem título'}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>Aberto: {formattedDate}</span>
                    <span className="font-bold uppercase text-slate-500">{t.category_id || 'TI'}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel: Ticket detail, take-over trigger, SLA controls, transfer forms, and conversation notes */}
      <div className="flex-1 bg-slate-50/50 flex flex-col h-full overflow-hidden text-left">
        {selectedTicket ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Header detail */}
            <div className="bg-white p-6 border-b border-slate-100 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Chamado #{selectedTicket.number}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">SLA de Atendimento: <strong className="text-emerald-700">Dentro da meta (24h)</strong></p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-400">ESTADO:</span>
                  <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded uppercase">
                    {getStatusLabel(selectedTicket.status)}
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable details */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Ticket description */}
              <div className="rounded-xl bg-white p-5 border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Descrição do Incidente</h4>
                  <span className="text-[10px] bg-slate-50 text-slate-600 font-bold px-1.5 py-0.5 rounded border">
                    Local: {selectedTicket.local || 'Não aplicável'}
                  </span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedTicket.justificativa}</p>
              </div>

              {/* Technical control panel triggers */}
              <div className="rounded-xl bg-white p-5 border border-slate-100 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ações do Técnico</h4>
                
                <div className="flex flex-wrap gap-3">
                  {selectedTicket.status === 'aberto' && (
                    <button
                      onClick={handleTakeOver}
                      className="flex-1 min-w-[140px] rounded-lg bg-emerald-700 hover:bg-emerald-900 text-white font-bold text-xs py-2 px-4 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <UserCheck className="mr-1.5 h-4.5 w-4.5" />
                      <span>Assumir chamado</span>
                    </button>
                  )}

                  {(selectedTicket.status === 'em_atendimento' || selectedTicket.status === 'aguardando_solicitante') && (
                    <>
                      <button
                        onClick={handleResolve}
                        className="flex-1 min-w-[140px] rounded-lg bg-emerald-700 hover:bg-emerald-900 text-white font-bold text-xs py-2 px-4 transition-colors flex items-center justify-center cursor-pointer"
                      >
                        <CheckCircle2 className="mr-1.5 h-4.5 w-4.5" />
                        <span>Encerrar / Resolver</span>
                      </button>

                      <button
                        onClick={handlePauseSLA}
                        className="flex-1 min-w-[140px] rounded-lg border border-yellow-300 hover:bg-yellow-50 text-yellow-800 font-bold text-xs py-2 px-4 transition-colors flex items-center justify-center cursor-pointer"
                      >
                        {selectedTicket.status === 'em_atendimento' ? (
                          <>
                            <Pause className="mr-1.5 h-4.5 w-4.5" />
                            <span>Pausar SLA</span>
                          </>
                        ) : (
                          <>
                            <Play className="mr-1.5 h-4.5 w-4.5 animate-pulse" />
                            <span>Retomar Atendimento</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>

                {/* Transfer Sector Form */}
                {selectedTicket.status !== 'resolvido' && selectedTicket.status !== 'fechado' && (
                  <form onSubmit={handleTransfer} className="pt-3 border-t border-slate-50 flex items-end gap-3">
                    <div className="flex-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Transferir para outro setor helpdesk</label>
                      <select
                        required
                        value={transferSectorId}
                        onChange={(e) => setTransferSectorId(e.target.value)}
                        className="w-full rounded border border-slate-200 bg-white py-1 px-2 text-xs focus:outline-none focus:border-emerald-600"
                      >
                        <option value="">Selecione o setor...</option>
                        {sectors.filter(s => s.helpdesk_enabled && s.id !== user.sector_id).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="rounded bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] py-1 px-3"
                    >
                      Transferir
                    </button>
                  </form>
                )}
              </div>

              {/* Conversas e Anotações Internas */}
              <div className="rounded-xl bg-white p-5 border border-slate-100 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Anotações & Respostas</h4>
                  
                  {/* Note type selector toggle */}
                  <div className="flex rounded bg-slate-100 p-0.5 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setNoteType('public')}
                      className={`rounded px-2.5 py-0.5 transition-colors ${noteType === 'public' ? 'bg-white shadow-sm text-emerald-800' : 'text-slate-500'}`}
                    >
                      Público (Solicitante vê)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoteType('internal')}
                      className={`rounded px-2.5 py-0.5 transition-colors ${noteType === 'internal' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500'}`}
                    >
                      Nota Interna TI
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {comments.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2 text-center">Nenhum histórico de observações registrado.</p>
                  ) : (
                    comments.map((c) => {
                      return (
                        <div key={c.id} className="p-3 bg-slate-50/50 rounded-lg border border-slate-100 text-xs">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>{c.user_name || 'Técnico'} • {new Date(c.created_at).toLocaleString('pt-BR')}</span>
                            {c.is_internal && (
                              <span className="font-bold text-amber-700 bg-amber-50 px-1 rounded">INTERNO</span>
                            )}
                          </div>
                          <p className="mt-1 text-slate-700 font-medium leading-normal">{c.content}</p>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={handlePostNote} className="flex gap-2 pt-2 border-t border-slate-50">
                  <input
                    type="text"
                    required
                    placeholder={noteType === 'internal' ? "Inserir anotação técnica interna..." : "Enviar resposta ao solicitante..."}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="flex-1 rounded border border-slate-200 py-1.5 px-3 text-xs focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="submit"
                    className="rounded bg-emerald-800 hover:bg-emerald-900 text-white p-1.5 cursor-pointer"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>

            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Radio className="h-12 w-12 text-slate-300 mb-2" />
            <p className="text-sm">Selecione um chamado aberto na lista para interagir.</p>
          </div>
        )}
      </div>

    </div>
  );
}
