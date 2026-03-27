'use client';

import { useState, useMemo } from 'react';
import { Produto } from '@/services/api';

interface ProductTableGroupedProps {
  produtos: Produto[];
  onSelectReferencia: (referencia: string) => void;
  limiteClasseC?: number;
}

interface ReferenciaAgrupada {
  referencia: string;
  grupo: string;
  skus: Produto[];
  totalQtd: number;
  totalValor: number;
  percentTotal: number;
  temClasseC: boolean;
  classificacaoGeral: 'A' | 'B' | 'C';
}

type SortField = 'referencia' | 'grupo' | 'totalQtd' | 'totalValor' | 'percentTotal' | 'skusCount';
type SortOrder = 'asc' | 'desc';

export default function ProductTableGrouped({ produtos, onSelectReferencia, limiteClasseC = 95 }: ProductTableGroupedProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalValor');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterGrupo, setFilterGrupo] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'comC' | 'semC'>('all');
  const [filterClasse, setFilterClasse] = useState<'all' | 'A' | 'B' | 'C'>('all');
  const [expandedRefs, setExpandedRefs] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Agrupa produtos por referencia
  const referenciasAgrupadas = useMemo(() => {
    const grupos = new Map<string, ReferenciaAgrupada>();

    produtos.forEach(produto => {
      const ref = produto.referencia || '-';
      if (!grupos.has(ref)) {
        grupos.set(ref, {
          referencia: ref,
          grupo: produto.grupo,
          skus: [],
          totalQtd: 0,
          totalValor: 0,
          percentTotal: 0,
          temClasseC: false,
          classificacaoGeral: 'A'
        });
      }

      const grupo = grupos.get(ref)!;
      grupo.skus.push(produto);
      grupo.totalQtd += produto.qt_liquida;
      grupo.totalValor += produto.vl_total;

      // Verifica se tem classe C
      if (produto.classificacao === 'C') {
        grupo.temClasseC = true;
      }
    });

    // Calcula percentual total e classificacao geral
    const totalGeralValor = produtos.reduce((sum, p) => sum + p.vl_total, 0);
    grupos.forEach(grupo => {
      grupo.percentTotal = totalGeralValor > 0 ? (grupo.totalValor / totalGeralValor) * 100 : 0;
      // Classificacao geral baseada no maior % acumulado dos SKUs
      const maxPercent = Math.max(...grupo.skus.map(s => s.percent_acumulado));
      grupo.classificacaoGeral = maxPercent <= 80 ? 'A' : maxPercent <= limiteClasseC ? 'B' : 'C';
    });

    return Array.from(grupos.values());
  }, [produtos, limiteClasseC]);

  const grupos = useMemo(() => {
    const uniqueGrupos = new Set(referenciasAgrupadas.map(r => r.grupo).filter(g => g && g !== '-'));
    return Array.from(uniqueGrupos).sort();
  }, [referenciasAgrupadas]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const toggleExpand = (ref: string) => {
    const newExpanded = new Set(expandedRefs);
    if (newExpanded.has(ref)) {
      newExpanded.delete(ref);
    } else {
      newExpanded.add(ref);
    }
    setExpandedRefs(newExpanded);
  };

  const expandAll = () => {
    setExpandedRefs(new Set(filteredAndSorted.map(r => r.referencia)));
  };

  const collapseAll = () => {
    setExpandedRefs(new Set());
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...referenciasAgrupadas];

    // Filtro por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r =>
        r.referencia.toLowerCase().includes(term) ||
        r.grupo.toLowerCase().includes(term) ||
        r.skus.some(s => s.descricao.toLowerCase().includes(term) || s.cd_produto.toString().includes(term))
      );
    }

    // Filtro por grupo
    if (filterGrupo !== 'all') {
      result = result.filter(r => r.grupo === filterGrupo);
    }

    // Filtro por status (com/sem classe C)
    if (filterStatus === 'comC') {
      result = result.filter(r => r.temClasseC);
    } else if (filterStatus === 'semC') {
      result = result.filter(r => !r.temClasseC);
    }

    // Filtro por classe especifica - filtra referencias que contem SKUs da classe selecionada
    if (filterClasse !== 'all') {
      result = result.filter(r => r.skus.some(s => s.classificacao === filterClasse));
      // Tambem filtra os SKUs dentro de cada referencia para mostrar apenas os da classe
      result = result.map(r => ({
        ...r,
        skus: r.skus.filter(s => s.classificacao === filterClasse)
      }));
    }

    // Ordenacao
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case 'referencia':
          aVal = a.referencia;
          bVal = b.referencia;
          break;
        case 'grupo':
          aVal = a.grupo;
          bVal = b.grupo;
          break;
        case 'totalQtd':
          aVal = a.totalQtd;
          bVal = b.totalQtd;
          break;
        case 'totalValor':
          aVal = a.totalValor;
          bVal = b.totalValor;
          break;
        case 'percentTotal':
          aVal = a.percentTotal;
          bVal = b.percentTotal;
          break;
        case 'skusCount':
          aVal = a.skus.length;
          bVal = b.skus.length;
          break;
        default:
          aVal = a.totalValor;
          bVal = b.totalValor;
      }

      const modifier = sortOrder === 'asc' ? 1 : -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * modifier;
      }
      return (aVal - bVal) * modifier;
    });

    return result;
  }, [referenciasAgrupadas, searchTerm, filterGrupo, filterStatus, filterClasse, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredAndSorted.length / itemsPerPage);
  const paginatedData = filteredAndSorted.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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

  // Estatisticas
  const stats = useMemo(() => {
    const totalRefs = filteredAndSorted.length;
    const refsComC = filteredAndSorted.filter(r => r.temClasseC).length;
    const totalSkus = filteredAndSorted.reduce((sum, r) => sum + r.skus.length, 0);
    const skusClasseC = filteredAndSorted.reduce((sum, r) => sum + r.skus.filter(s => s.classificacao === 'C').length, 0);
    return { totalRefs, refsComC, totalSkus, skusClasseC };
  }, [filteredAndSorted]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Filtros */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-wrap gap-4 mb-3">
          <input
            type="text"
            placeholder="Buscar por referencia, descricao ou codigo..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
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
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value as typeof filterStatus); setCurrentPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="all">Todas as referencias</option>
            <option value="comC">Com SKUs Classe C (candidatos)</option>
            <option value="semC">Sem SKUs Classe C</option>
          </select>
          <select
            value={filterClasse}
            onChange={(e) => { setFilterClasse(e.target.value as typeof filterClasse); setCurrentPage(1); }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="all">Todas as classes</option>
            <option value="A">Somente Classe A (0-80%)</option>
            <option value="B">Somente Classe B (80-{limiteClasseC}%)</option>
            <option value="C">Somente Classe C ({limiteClasseC}-100%) - Candidatos</option>
          </select>
        </div>

        {/* Estatisticas e botoes */}
        <div className="flex items-center justify-between">
          <div className="flex gap-4 text-sm">
            <span className="text-gray-600">
              <strong>{stats.totalRefs}</strong> referencias
            </span>
            <span className="text-red-600">
              <strong>{stats.refsComC}</strong> com SKUs classe C
            </span>
            <span className="text-gray-600">
              <strong>{stats.totalSkus}</strong> SKUs total
            </span>
            <span className="text-red-600">
              <strong>{stats.skusClasseC}</strong> SKUs classe C
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="px-3 py-1 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              Expandir tudo
            </button>
            <button
              onClick={collapseAll}
              className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Recolher tudo
            </button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">

              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('referencia')}>
                Referencia <SortIcon field="referencia" />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('grupo')}>
                Grupo <SortIcon field="grupo" />
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('skusCount')}>
                SKUs <SortIcon field="skusCount" />
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalQtd')}>
                Qtd Total <SortIcon field="totalQtd" />
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('totalValor')}>
                Valor Total R$ <SortIcon field="totalValor" />
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('percentTotal')}>
                % do Total <SortIcon field="percentTotal" />
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedData.map((ref) => (
              <>
                {/* Linha da Referencia */}
                <tr
                  key={ref.referencia}
                  className={`cursor-pointer transition-colors ${
                    ref.temClasseC
                      ? 'bg-red-50 hover:bg-red-100'
                      : 'hover:bg-rose-50'
                  }`}
                  onClick={() => toggleExpand(ref.referencia)}
                >
                  <td className="px-4 py-3 text-sm">
                    <span className={`transform transition-transform inline-block ${expandedRefs.has(ref.referencia) ? 'rotate-90' : ''}`}>
                      ▶
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium ${ref.temClasseC ? 'text-red-700' : 'text-rose-600'}`}>
                    {ref.referencia}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {ref.grupo}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-center">
                    {ref.skus.length}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {ref.totalQtd.toLocaleString('pt-BR')}
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium text-right ${ref.temClasseC ? 'text-red-700' : 'text-gray-900'}`}>
                    {ref.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {ref.percentTotal.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    {ref.temClasseC ? (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                        Candidato
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        OK
                      </span>
                    )}
                  </td>
                </tr>

                {/* SKUs expandidos */}
                {expandedRefs.has(ref.referencia) && ref.skus.map((sku) => (
                  <tr
                    key={sku.cd_produto}
                    className={`text-sm ${
                      sku.classificacao === 'C'
                        ? 'bg-red-25 hover:bg-red-50'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectReferencia(ref.referencia);
                    }}
                  >
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 pl-8 text-gray-600">
                      <span className="text-xs text-gray-400 mr-2">SKU:</span>
                      {sku.cd_produto}
                    </td>
                    <td className="px-4 py-2 text-gray-600 truncate max-w-xs" title={sku.descricao}>
                      {sku.descricao} - {sku.cor} - {sku.tam}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {getClassBadge(sku.classificacao)}
                    </td>
                    <td className="px-4 py-2 text-gray-600 text-right">
                      {sku.qt_liquida.toLocaleString('pt-BR')}
                    </td>
                    <td className={`px-4 py-2 text-right ${sku.classificacao === 'C' ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {sku.vl_total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-gray-600 text-right">
                      {sku.percent_individual.toFixed(2)}%
                    </td>
                    <td className="px-4 py-2 text-gray-600 text-right">
                      {sku.percent_acumulado.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginacao */}
      <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
        <p className="text-sm text-gray-700">
          Mostrando <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> a{' '}
          <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredAndSorted.length)}</span> de{' '}
          <span className="font-medium">{filteredAndSorted.length}</span> referencias
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
            Pagina {currentPage} de {totalPages || 1}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Proxima
          </button>
        </div>
      </div>
    </div>
  );
}
