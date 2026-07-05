/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Home, Search, BarChart3, PlusCircle, List, FileCheck, 
  Database, LayoutDashboard, Upload, Users, Shield, 
  Map, Settings, HelpCircle, ChevronRight, Menu, KeyRound, Radio
} from 'lucide-react';
import { localDb } from '../db/localDb';
import { Profile } from '../types';

interface SidebarProps {
  user: Profile;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export default function Sidebar({ user, currentPath, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const getSectorsWithHelpdesk = () => {
    return localDb.getSectors().filter(s => s.helpdesk_enabled);
  };

  const navItems = [
    {
      group: 'GERAL',
      items: [
        { label: 'Início', path: '/', icon: Home, perm: { module: 'solicitacoes', action: 'visualizar_proprias' } },
        { label: 'Catálogo SAP', path: '/materiais/busca', icon: Search, perm: { module: 'materiais', action: 'visualizar' } },
        { label: 'Relatórios', path: '/relatorios', icon: BarChart3, perm: { module: 'materiais', action: 'visualizar' } },
      ],
    },
    {
      group: 'SOLICITAÇÕES',
      items: [
        { label: 'Nova Solicitação', path: '/solicitacoes/nova', icon: PlusCircle, perm: { module: 'solicitacoes', action: 'criar' } },
        { label: 'Minhas Solicitações', path: '/solicitacoes/minhas', icon: List, perm: { module: 'solicitacoes', action: 'visualizar_proprias' } },
        { label: 'Aprovações', path: '/solicitacoes/aprovacoes', icon: FileCheck, perm: { module: 'compras', action: 'visualizar_setor' } },
      ],
    },
    {
      group: 'SUPRIMENTOS',
      items: [
        { label: 'Cadastros SAP', path: '/suprimentos/cadastros-sap', icon: KeyRound, perm: { module: 'cadastro_sap', action: 'atender' } },
        { label: 'Painel SAP', path: '/suprimentos/painel', icon: Database, perm: { module: 'sap', action: 'visualizar_painel' } },
        { label: 'Dashboards', path: '/suprimentos/dashboards', icon: LayoutDashboard, perm: { module: 'sap', action: 'dashboards' } },
        { label: 'Importar SAP', path: '/suprimentos/importar', icon: Upload, perm: { module: 'sap', action: 'importar' } },
      ],
    },
    {
      group: 'HELPDESK',
      items: [
        { label: 'Atendimento', path: '/helpdesk', icon: Radio, perm: { module: 'chamados', action: 'atender_setor' } },
      ],
    },
    {
      group: 'ADMINISTRAÇÃO',
      items: [
        { label: 'Usuários', path: '/admin/usuarios', icon: Users, perm: { module: 'admin', action: 'usuarios' } },
        { label: 'Setores', path: '/admin/setores', icon: Map, perm: { module: 'admin', action: 'setores' } },
        { label: 'Permissões', path: '/admin/permissoes', icon: Shield, perm: { module: 'admin', action: 'auditoria' } },
        { label: 'Import. Materiais', path: '/admin/importacao-materiais', icon: Upload, perm: { module: 'admin', action: 'importacao_materiais' } },
        { label: 'Log Importação SAP', path: '/suprimentos/importar/log', icon: List, perm: { module: 'sap', action: 'importar' } },
        { label: 'Grupos Comprador', path: '/suprimentos/grupos-comprador', icon: Settings, perm: { module: 'sap', action: 'gerenciar_grupos' } },
        { label: 'Config. Helpdesk', path: '/admin/helpdesk', icon: Settings, perm: { module: 'admin', action: 'usuarios' } },
      ],
    },
  ];

  const handleNavClick = (path: string) => {
    onNavigate(path);
  };

  return (
    <aside 
      className={`relative flex flex-col border-r border-gray-800 bg-slate-900 text-slate-300 transition-all duration-300 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand logo container */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-gray-800 bg-slate-950">
        {!collapsed ? (
          <div className="flex items-center space-x-2">
            {/* Wind turbine custom SVG logo */}
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 p-1 ring-2 ring-white/10">
              <svg className="h-7 w-7 text-white animate-[spin_12s_linear_infinite]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                <path d="M12 12L12 2M12 12L4 16.5M12 12L20 16.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex flex-col text-left">
              <span className="text-sm font-extrabold text-white tracking-wider leading-none">SISTEN</span>
              <span className="text-[9px] text-slate-400 mt-0.5">Plataforma Torres Eólicas</span>
            </div>
          </div>
        ) : (
          <div className="flex w-full justify-center">
            <svg className="h-6 w-6 text-blue-500 animate-[spin_15s_linear_infinite]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
              <path d="M12 12L12 2M12 12L4 16.5M12 12L20 16.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="rounded p-1 hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto py-4">
        {navItems.map((group, groupIdx) => {
          // Filter items based on user permission
          const visibleItems = group.items.filter(item => 
            localDb.hasPermission(user, item.perm.module, item.perm.action)
          );

          if (visibleItems.length === 0) return null;

          return (
            <div key={groupIdx} className="mb-6">
              {!collapsed && (
                <h3 className="px-6 mb-2 text-[10px] font-bold text-slate-500 tracking-widest text-left">
                  {group.group}
                </h3>
              )}
              <ul className="space-y-1">
                {visibleItems.map((item, itemIdx) => {
                  const Icon = item.icon;
                  // If path is helpdesk or specific sub-path, check exact or partial matches
                  const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
                  
                  return (
                    <li key={itemIdx}>
                      <button
                        onClick={() => handleNavClick(item.path)}
                        className={`flex w-full items-center px-6 py-2 text-sm font-medium transition-all duration-150 ${
                          isActive 
                            ? 'border-l-4 border-emerald-500 bg-slate-800 text-emerald-400' 
                            : 'border-l-4 border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-white'
                        }`}
                        title={item.label}
                      >
                        <Icon className={`h-5 w-5 shrink-0 ${collapsed ? 'mr-0' : 'mr-3'}`} />
                        {!collapsed && <span className="truncate text-left">{item.label}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Profile Footer */}
      {!collapsed && (
        <div className="border-t border-gray-800 bg-slate-950 p-4 text-left">
          <p className="text-xs font-semibold text-white truncate">{user.name}</p>
          <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.email}</p>
        </div>
      )}
    </aside>
  );
}
