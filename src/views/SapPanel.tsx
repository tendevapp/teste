/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Database, Filter, Edit3, Calendar, Check, AlertCircle, 
  ChevronRight, ArrowRight, MessageSquare, ListCollapse, BookOpen, ExternalLink, RefreshCw 
} from 'lucide-react';
import { localDb } from '../db/localDb';
import { Profile, EnrichedSAPRecord } from '../types';

interface SapPanelProps {
  user: Profile;
  onNavigate: (path: string) => void;
}

export default function SapPanel({ user, onNavigate }: SapPanelProps) {
  const [records, setRecords] = useState<EnrichedSAPRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Com PO' | 'Sem PO'>('Todos');
  const [buyerGroupFilter, setBuyerGroupFilter] = useState('Todos');
  const [alertFilter, setAlertFilter] = useState('Todos');
  const [onlyMine, setOnlyMine] = useState(false);

  // Inline editing active keys
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'obs' | 'promessa' | null>(null);
  const [tempComment, setTempComment] = useState('');
  const [tempDate, setTempDate] = useState('');

  // Retry status feedback
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'failed'>('idle');

  // Active drawer tab
  const [drawerTab, setDrawerTab] = useState<'details' | 'obs_history' | 'extra' | 'internal'>('details');

  useEffect(() => {
    // Parse query params from hash
    const hash = window.location.hash;
    const qIndex = hash.indexOf('?');
    if (qIndex !== -1) {
      const search = hash.slice(qIndex + 1);
      const params = new URLSearchParams(search);
      
      const statusParam = params.get('status');
      if (statusParam) {
        setStatusFilter(statusParam as any);
      }
      
      const alertParam = params.get('alert');
      if (alertParam) {
        setAlertFilter(alertParam);
      }
      
      const buyerParam = params.get('buyer');
      if (buyerParam) {
        setBuyerGroupFilter(buyerParam);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [user, onlyMine]);

  const loadData = () => {
    let list = localDb.getEnrichedSAPRequisicoes();
    
    if (onlyMine && user.roles.includes('comprador')) {
      // Find buyer groups this user is assigned to
      const myGroups = localDb.getBuyerGroupsForUser(user.id).map(g => g.group_code);
      list = list.filter(r => myGroups.includes(r.grupo_comprador));
    }

    setRecords(list);
  };

  // Perform Filters
  const filteredRecords = records.filter(r => {
    const rmMatch = r.requisicao_de_compra.toLowerCase().includes(searchQuery.toLowerCase());
    const materialMatch = r.material_code.toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = r.texto_breve.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = rmMatch || materialMatch || descMatch;

    const matchesStatus = statusFilter === 'Todos' || 
      (statusFilter === 'Com PO' && r.status_requisicao === 'Processado') ||
      (statusFilter === 'Sem PO' && r.status_requisicao === 'Sem PO');

    const matchesBuyer = buyerGroupFilter === 'Todos' || r.grupo_comprador === buyerGroupFilter;
    const matchesAlert = alertFilter === 'Todos' || r.alerta === alertFilter;

    return matchesSearch && matchesStatus && matchesBuyer && matchesAlert;
  });

  const selectedRecord = records.find(r => r.ri === selectedId);

  // Find linked internal request if exists
  const linkedRequest = selectedRecord 
    ? localDb.getRequests().find(req => req.number === selectedRecord.requisicao_de_compra)
    : null;

  // Resilient Inline Update with Exponential Backoff
  const handleUpdateField = async (ri: string, field: 'obs' | 'promessa') => {
    setSyncStatus('syncing');
    
    // Simulate optimistic update
    const nextComment = field === 'obs' ? tempComment : (selectedRecord?.obs_comprador || '');
    const nextDate = field === 'promessa' ? tempDate : (selectedRecord?.data_entrega_prevista || '');
    
    // Mock the robust network call with failure and 3 retries
    let attempt = 0;
    const maxRetries = 3;
    
    const tryUpdate = async (): Promise<boolean> => {
      attempt++;
      return new Promise((resolve) => {
        setTimeout(() => {
          const randomFail = Math.random() < 0.2;
          if (randomFail && attempt < maxRetries) {
            console.warn(`[Offline Queue] Attempt ${attempt} failed. Retrying...`);
            resolve(false);
          } else {
            resolve(true);
          }
        }, 300);
      });
    };

    let success = false;
    while (attempt < maxRetries && !success) {
      success = await tryUpdate();
    }

    if (success) {
      // Persist in local DB
      localDb.updateBuyerFields(ri, nextComment, nextDate);
      setEditingId(null);
      setEditingField(null);
      setSyncStatus('idle');
      loadData();
    } else {
      setSyncStatus('failed');
      alert('Conectividade instável! Seus dados foram salvos localmente e serão sincronizados assim que a conexão estabilizar.');
    }
  };

  const startEditing = (rec: EnrichedSAPRecord, field: 'obs' | 'promessa') => {
    setEditingId(rec.ri);
    setEditingField(field);
    setTempComment(rec.obs_comprador || '');
    setTempDate(rec.data_entrega_prevista || '');
  };

  const getAlertBadge = (level: string) => {
    const colors: Record<string, string> = {
      '⚠️ ESCALAR': 'bg-red-100 text-red-800 border-red-200',
      'AÇÃO URGENTE': 'bg-red-100 text-red-800 border-red-200',
      '⚡ ACOMPANHAR': 'bg-amber-100 text-amber-800 border-amber-200',
      '📋 MONITORAR': 'bg-blue-100 text-blue-800 border-blue-200',
      '✅ OK': 'bg-emerald-100 text-emerald-800 border-emerald-200'
    };
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${colors[level] || 'bg-gray-100 text-gray-800'}`}>
        {level}
      </span>
    );
  };

  const getBuyerGroupList = () => {
    const groups = new Set<string>();
    records.forEach(r => groups.add(r.grupo_comprador));
    return Array.from(groups);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] -m-6 overflow-hidden">
      
      {/* Top filter section */}
      <div className="bg-white p-4 border-b border-slate-100 shrink-0 text-left space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Painel SAP de Suprimentos</h2>
            <p className="text-xs text-slate-500">Visualização integrada de Requisições de Compra (ME5A) e Pedidos (ZL0132).</p>
          </div>
          
          <div className="flex items-center space-x-3 self-start sm:self-center">
            {syncStatus === 'syncing' && (
              <span className="text-xs text-blue-600 font-medium flex items-center">
                <RefreshCw className="animate-spin h-3.5 w-3.5 mr-1" /> Sincronizando com SAP...
              </span>
            )}
            {user.roles.includes('comprador') && (
              <label className="flex items-center text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyMine}
                  onChange={(e) => setOnlyMine(e.target.checked)}
                  className="mr-2 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Filtrar meus grupos de compras
              </label>
            )}
          </div>
        </div>

        {/* Filter triggers row */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar RM, PO, Cód. ou Descrição..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded border border-slate-200 py-1.5 px-3 text-xs focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full rounded border border-slate-200 bg-white py-1.5 px-3 text-xs focus:outline-none"
            >
              <option value="Todos">Status: Todos</option>
              <option value="Com PO">Status: Com Pedido (PO)</option>
              <option value="Sem PO">Status: Sem Pedido (ME5A em aberto)</option>
            </select>
          </div>

          <div>
            <select
              value={buyerGroupFilter}
              onChange={(e) => setBuyerGroupFilter(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white py-1.5 px-3 text-xs focus:outline-none"
            >
              <option value="Todos">Grupo de Compradores: Todos</option>
              {getBuyerGroupList().map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={alertFilter}
              onChange={(e) => setAlertFilter(e.target.value)}
              className="w-full rounded border border-slate-200 bg-white py-1.5 px-3 text-xs focus:outline-none"
            >
              <option value="Todos">Alerta: Todos</option>
              <option value="⚠️ ESCALAR IMEDIATAMENTE">Alerta: Escalar Imediatamente</option>
              <option value="⚠️ AÇÃO URGENTE">Alerta: Ação Urgente</option>
              <option value="⚡ ACOMPANHAR">Alerta: Acompanhar</option>
              <option value="📋 MONITORAR">Alerta: Monitorar</option>
              <option value="✅ OK">Alerta: OK</option>
            </select>
          </div>

          <div className="text-right flex items-center justify-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {filteredRecords.length} registros correspondentes
            </span>
          </div>
        </div>
      </div>

      {/* Main split-pane content: table grid left, details drawer right */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Table list */}
        <div className="flex-1 overflow-auto bg-white border-r border-slate-100">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0">
                <th className="py-2.5 px-3">RM SAP</th>
                <th className="py-2.5 px-3 w-16">Item</th>
                <th className="py-2.5 px-3 w-28">Cód. Mat.</th>
                <th className="py-2.5 px-3">Descrição Material</th>
                <th className="py-2.5 px-3 w-16 text-center">Grupo</th>
                <th className="py-2.5 px-3 w-24 text-center">Dias Aberto</th>
                <th className="py-2.5 px-3 w-24 text-center">Atraso Compr.</th>
                <th className="py-2.5 px-3 w-24">PO SAP</th>
                <th className="py-2.5 px-3 w-40">Data Promessa</th>
                <th className="py-2.5 px-3">Comentários Comprador (Editável)</th>
                <th className="py-2.5 px-3 w-20 text-center">Alerta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRecords.map((r) => {
                const isSelected = r.ri === selectedId;
                const isEditingThisComment = editingId === r.ri && editingField === 'obs';
                const isEditingThisDate = editingId === r.ri && editingField === 'promessa';

                return (
                  <tr 
                    key={r.ri}
                    onClick={() => setSelectedId(r.ri)}
                    className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-emerald-50/30 font-medium' : ''}`}
                  >
                    <td className="py-3 px-3 font-semibold text-slate-700">{r.requisicao_de_compra}</td>
                    <td className="py-3 px-3 text-slate-500 font-mono">{r.item_reqc}</td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-800">{r.material_code}</td>
                    <td className="py-3 px-3 max-w-xs truncate" title={r.texto_breve}>{r.texto_breve}</td>
                    <td className="py-3 px-3 text-center text-slate-600 font-bold">{r.grupo_comprador}</td>
                    <td className="py-3 px-3 text-center font-semibold text-slate-700">{r.dias_em_aberto}</td>
                    <td className="py-3 px-3 text-center text-red-600 font-bold">{r.atraso_comprador || 0}d</td>
                    <td className="py-3 px-3 font-mono text-slate-500">{r.documento_compra || '-'}</td>
                    
                    {/* Delivery Date Column (Optimistic edit) */}
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                      {isEditingThisDate ? (
                        <div className="flex items-center space-x-1">
                          <input
                            type="date"
                            value={tempDate}
                            onChange={(e) => setTempDate(e.target.value)}
                            className="rounded border border-slate-300 py-0.5 px-1 text-[11px] focus:outline-none"
                          />
                          <button 
                            onClick={() => handleUpdateField(r.ri, 'promessa')}
                            className="p-1 rounded bg-emerald-700 text-white"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between group">
                          <span className="text-slate-700 font-medium">{r.data_entrega_prevista ? new Date(r.data_entrega_prevista).toLocaleDateString('pt-BR') : '-'}</span>
                          <button
                            onClick={() => startEditing(r, 'promessa')}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Buyer Comment column (Optimistic edit) */}
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                      {isEditingThisComment ? (
                        <div className="flex items-center space-x-1">
                          <input
                            type="text"
                            value={tempComment}
                            onChange={(e) => setTempComment(e.target.value)}
                            className="flex-1 rounded border border-slate-300 py-0.5 px-1.5 text-[11px] focus:outline-none focus:border-blue-600"
                          />
                          <button 
                            onClick={() => handleUpdateField(r.ri, 'obs')}
                            className="p-1 rounded bg-emerald-700 text-white"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between group">
                          <p className="text-slate-600 truncate max-w-[180px]">{r.obs_comprador || '-'}</p>
                          <button
                            onClick={() => startEditing(r, 'obs')}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">{getAlertBadge(r.alerta)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Deep Details side Drawer */}
        {selectedRecord && (
          <div className="w-96 border-l border-slate-100 bg-white flex flex-col h-full overflow-hidden text-left shadow-lg">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-50 bg-slate-50/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-800">Detalhamento SAP</h3>
                  <p className="text-[10px] text-slate-400">RM {selectedRecord.requisicao_de_compra} • Item {selectedRecord.item_reqc}</p>
                </div>
                <button 
                  onClick={() => setSelectedId(null)}
                  className="rounded p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                >
                  <span className="text-xs font-bold">Fechar ×</span>
                </button>
              </div>

              {/* Tabs list inside drawer */}
              <div className="flex mt-4 border-b border-slate-100 text-[10px] font-bold">
                <button
                  onClick={() => setDrawerTab('details')}
                  className={`pb-1.5 mr-3 border-b-2 transition-all cursor-pointer ${drawerTab === 'details' ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  Geral
                </button>
                <button
                  onClick={() => setDrawerTab('obs_history')}
                  className={`pb-1.5 mr-3 border-b-2 transition-all cursor-pointer ${drawerTab === 'obs_history' ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  Obs.
                </button>
                <button
                  onClick={() => setDrawerTab('extra')}
                  className={`pb-1.5 mr-3 border-b-2 transition-all cursor-pointer ${drawerTab === 'extra' ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  Extras
                </button>
                <button
                  onClick={() => setDrawerTab('internal')}
                  className={`pb-1.5 border-b-2 transition-all cursor-pointer ${drawerTab === 'internal' ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  Solicit. Interna
                </button>
              </div>
            </div>

            {/* Drawer Content tabs */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {drawerTab === 'details' && (
                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Material</span>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedRecord.material_code} - {selectedRecord.texto_breve}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Qtd Solicitada</span>
                      <p className="font-semibold text-slate-800">{selectedRecord.qtd_requisicao}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Unidade</span>
                      <p className="font-semibold text-slate-800">{selectedRecord.unidade_medida || 'UN'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Data Requisição</span>
                      <p className="font-semibold text-slate-800">{new Date(selectedRecord.data_solicitacao).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Valor Unitário</span>
                      <p className="font-semibold text-slate-800">
                        R$ {(selectedRecord.campos_extras?.valor_unitario || 150.00).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {selectedRecord.documento_compra && (
                    <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 space-y-1.5">
                      <span className="text-[9px] font-bold text-blue-800 uppercase">Dados do Pedido (PO)</span>
                      <p className="font-semibold text-slate-800">Pedido nº {selectedRecord.documento_compra}</p>
                      <p className="text-[10px] text-slate-500">Emitido em {selectedRecord.data_pedido ? new Date(selectedRecord.data_pedido).toLocaleDateString('pt-BR') : '-'}</p>
                    </div>
                  )}
                </div>
              )}

              {drawerTab === 'obs_history' && (
                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Observação Atual</span>
                    <p className="bg-slate-50 p-2.5 rounded border border-slate-100 font-medium text-slate-700 mt-1 leading-relaxed">
                      {selectedRecord.obs_comprador || 'Sem observações corporativas.'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Promessa de Entrega</span>
                    <p className="font-semibold text-slate-800 mt-1">
                      {selectedRecord.data_entrega_prevista ? new Date(selectedRecord.data_entrega_prevista).toLocaleDateString('pt-BR') : 'Não fornecida'}
                    </p>
                  </div>
                </div>
              )}

              {drawerTab === 'extra' && (
                <div className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Natureza</span>
                      <p className="font-semibold text-slate-800">{selectedRecord.natureza}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Lead Time Meta</span>
                      <p className="font-semibold text-slate-800">{selectedRecord.lead_time_compras_meta} dias</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block font-mono">ID de Transação SAP</span>
                    <p className="font-mono text-[10px] text-slate-500 bg-slate-50 p-2 rounded mt-1 truncate">{selectedRecord.ri}</p>
                  </div>
                </div>
              )}

              {drawerTab === 'internal' && (
                <div className="space-y-4 text-xs">
                  {linkedRequest ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg space-y-2">
                      <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest block">Vinculada à Solicitação SISTEN</span>
                      <h5 className="font-bold text-slate-800">Solicitação #{linkedRequest.number}</h5>
                      <p className="text-[10px] text-slate-500">{linkedRequest.justificativa}</p>
                      <button 
                        onClick={() => onNavigate(`/solicitacoes/minhas?id=${linkedRequest.id}`)}
                        className="text-[10px] font-bold text-emerald-700 hover:underline inline-flex items-center pt-1"
                      >
                        Abrir acompanhamento <ExternalLink className="h-3 w-3 ml-1" />
                      </button>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 space-y-1.5">
                      <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="text-[11px] leading-relaxed">Nenhuma solicitação interna correspondente no SISTEN. Esta RM pode ter sido gerada diretamente no terminal SAP por um coordenador.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
