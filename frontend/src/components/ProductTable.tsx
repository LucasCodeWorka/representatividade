'use client';

import { useState, useMemo } from 'react';
import { Produto } from '@/services/api';

interface ProductTableProps {
  produtos: Produto[];
  onSelectReferencia: (referencia: string) => void;
  limiteClasseC?: number;
}

type MacroGrupo = 'grupo1' | 'grupo2';
type ProdutoComMacro = Produto & {
  macrogrupo: MacroGrupo;
  percent_individual_macro: number;
  percent_acumulado_macro: number;
};

type SortField = 'referencia' | 'cd_produto' | 'descricao' | 'grupo' | 'qt_liquida' | 'vl_total' | 'percent_individual' | 'percent_acumulado' | 'percent_acumulado_macro';
type SortOrder = 'asc' | 'desc';

export default function ProductTable({ produtos, onSelectReferencia, limiteClasseC = 95 }: ProductTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('percent_acumulado');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filterClass, setFilterClass] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [filterGrupo, setFilterGrupo] = useState<string>('all');
  const [filterMacroGrupo, setFilterMacroGrupo] = useState<'all' | MacroGrupo>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const normalizeText = (value: string) =>
    (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const getMacroGrupo = (grupo: string): MacroGrupo => {
    const grupoNormalizado = normalizeText(grupo);
    const macro2 = ['soutien', 'camisola', 'short doll', 'body', 'bory', 'macaquinho'];
    if (macro2.some(item => grupoNormalizado.includes(item))) {
      return 'grupo2';
    }

    const macro1 = ['calca', 'calcas', 'sem costura'];
    if (macro1.some(item => grupoNormalizado.includes(item))) {
      return 'grupo1';
    }

    if (/(^|\s)short(\s|$)/.test(grupoNormalizado)) {
      return 'grupo1';
    }

    return 'grupo2';
  };

  const grupos = useMemo(() => {
    const uniqueGrupos = new Set(produtos.map(p => p.grupo).filter(g => g && g !== '-'));
    return Array.from(uniqueGrupos).sort();
  }, [produtos]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    let base: ProdutoComMacro[] = produtos.map((p) => ({
      ...p,
      macrogrupo: getMacroGrupo(p.grupo),
      percent_individual_macro: 0,
      percent_acumulado_macro: 0
    }));

    if (filterMacroGrupo !== 'all') {
      base = base.filter(p => p.macrogrupo === filterMacroGrupo);
    }

    const totalValorMacro = base.reduce((sum, p) => sum + p.vl_total, 0);
    const ordenadosMacro = [...base].sort((a, b) => b.vl_total - a.vl_total);
    let acumuladoMacro = 0;
    const paretoMacroMap = new Map<number, {
      percent_individual_macro: number;
      percent_acumulado_macro: number;
    }>();

    ordenadosMacro.forEach((p) => {
      const percentualIndividual = totalValorMacro > 0 ? (p.vl_total / totalValorMacro) * 100 : 0;
      acumuladoMacro += percentualIndividual;

      paretoMacroMap.set(p.cd_produto, {
        percent_individual_macro: Math.round(percentualIndividual * 100) / 100,
        percent_acumulado_macro: Math.round(acumuladoMacro * 100) / 100
      });
    });

    let result: ProdutoComMacro[] = base.map((p) => {
      const macro = paretoMacroMap.get(p.cd_produto);
      return {
        ...p,
        percent_individual_macro: macro?.percent_individual_macro ?? 0,
        percent_acumulado_macro: macro?.percent_acumulado_macro ?? 0
      };
    });

    // Filtro por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.cd_produto.toString().includes(term) ||
        p.descricao.toLowerCase().includes(term) ||
        p.cor.toLowerCase().includes(term) ||
        p.referencia.toLowerCase().includes(term)
      );
    }

    // Filtro por classe
    if (filterClass !== 'all') {
      result = result.filter(p => p.classificacao === filterClass);
    }

    // Filtro por grupo
    if (filterGrupo !== 'all') {
      result = result.filter(p => p.grupo === filterGrupo);
    }

    // Ordenação
    result.sort((a: ProdutoComMacro, b: ProdutoComMacro) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const modifier = sortOrder === 'asc' ? 1 : -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * modifier;
      }
      return ((aVal as number) - (bVal as number)) * modifier;
    });

    return result;
  }, [produtos, searchTerm, filterClass, filterGrupo, filterMacroGrupo, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredAndSorted.length / itemsPerPage);
  const paginatedData = filteredAndSorted.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Estatisticas
  const stats = useMemo(() => {
    const totalSkus = filteredAndSorted.length;
    const skusClasseA = filteredAndSorted.filter(p => p.classificacao === 'A').length;
    const skusClasseB = filteredAndSorted.filter(p => p.classificacao === 'B').length;
    const skusClasseC = filteredAndSorted.filter(p => p.classificacao === 'C').length;
    return { totalSkus, skusClasseA, skusClasseB, skusClasseC };
  }, [filteredAndSorted]);

  const getClassBadge = (classificacao: string) => {
    const colors = {
      A: 'bg-emerald-100 text-emerald-800',
      B: 'bg-amber-100 text-amber-800',
      C: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[classificacao as keyof typeof colors]}`}>
        {classificacao}
      </span>
    );
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Filtros */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-wrap gap-4 mb-3">
          <input
            type="text"
            placeholder="Buscar por codigo, descricao, cor ou referencia..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
          <select
            value={filterMacroGrupo}
            onChange={(e) => { setFilterMacroGrupo(e.target.value as typeof filterMacroGrupo); setCurrentPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="all">Todos macrogrupos</option>
            <option value="grupo1">Macro 1: Calcas/Sem Costura/Short</option>
            <option value="grupo2">Macro 2: Soutien/Camisola/Body/etc</option>
          </select>
          <select
            value={filterGrupo}
            onChange={(e) => { setFilterGrupo(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="all">Todos os grupos</option>
            {grupos.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <select
            value={filterClass}
            onChange={(e) => { setFilterClass(e.target.value as typeof filterClass); setCurrentPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="all">Todas as classes</option>
            <option value="A">Classe A (0-80%)</option>
            <option value="B">Classe B (80-{limiteClasseC}%)</option>
            <option value="C">Classe C ({limiteClasseC}-100%) - Candidatos</option>
          </select>
        </div>

        {/* Estatisticas */}
        <div className="flex gap-4 text-sm">
          <span className="text-gray-600">
            <strong>{stats.totalSkus}</strong> SKUs
          </span>
          <span className="text-emerald-600">
            <strong>{stats.skusClasseA}</strong> classe A
          </span>
          <span className="text-amber-600">
            <strong>{stats.skusClasseB}</strong> classe B
          </span>
          <span className="text-red-600">
            <strong>{stats.skusClasseC}</strong> classe C
          </span>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('referencia')}>
                Referencia <SortIcon field="referencia" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('cd_produto')}>
                Codigo <SortIcon field="cd_produto" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('descricao')}>
                Descricao <SortIcon field="descricao" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('grupo')}>
                Grupo <SortIcon field="grupo" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cor
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tam
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('qt_liquida')}>
                Qtd <SortIcon field="qt_liquida" />
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('vl_total')}>
                Valor R$ <SortIcon field="vl_total" />
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('percent_individual')}>
                % Ind <SortIcon field="percent_individual" />
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('percent_acumulado')}>
                % Acumulado <SortIcon field="percent_acumulado" />
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('percent_acumulado_macro')}>
                % Acum Macro (Filtrado) <SortIcon field="percent_acumulado_macro" />
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Classe
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedData.map((produto) => (
                <tr
                  key={produto.cd_produto}
                  className={`cursor-pointer transition-colors ${
                    produto.classificacao === 'C'
                      ? 'bg-red-50 hover:bg-red-100'
                      : 'hover:bg-rose-50'
                  }`}
                onClick={() => onSelectReferencia(produto.referencia)}
                title={`Clique para ver todos os SKUs da referencia ${produto.referencia}`}
              >
                <td className={`px-4 py-3 text-sm font-medium ${produto.classificacao === 'C' ? 'text-red-700' : 'text-rose-600'}`}>
                  <div className="flex items-center gap-2">
                    <span>{produto.referencia}</span>
                    {produto.suspenso && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-900 text-white">
                        SUSPENSO
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {produto.cd_produto}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={produto.descricao}>
                  {produto.descricao}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {produto.grupo}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {produto.cor}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {produto.tam}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {produto.qt_liquida.toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {produto.vl_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {produto.percent_individual.toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {produto.percent_acumulado.toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {filterMacroGrupo === 'all' ? '-' : `${produto.percent_acumulado_macro.toFixed(2)}%`}
                </td>
                <td className="px-4 py-3 text-center">
                  {getClassBadge(produto.classificacao)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
        <p className="text-sm text-gray-700">
          Mostrando <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> a{' '}
          <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredAndSorted.length)}</span> de{' '}
          <span className="font-medium">{filteredAndSorted.length}</span> produtos
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Anterior
          </button>
          <span className="px-3 py-1 text-sm">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
