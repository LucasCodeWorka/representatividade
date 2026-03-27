'use client';

import { useEffect, useMemo, useState } from 'react';
import { produtosApi, CacheStatus, Empresa } from '@/services/api';

interface FilterPanelProps {
  ano: number;
  setAno: (ano: number) => void;
  aplicarFiltro: boolean;
  setAplicarFiltro: (value: boolean) => void;
  selectedEmpresas: number[];
  setSelectedEmpresas: (ids: number[]) => void;
  onRefresh: () => void;
  loading: boolean;
  onEmpresasInitialized?: (initialIds: number[]) => void;
}

const EMPRESAS_EXCLUIDAS = [
  'LIEBE ECOMMERCE ANGELICA',
  'LIEBE BH SHOPPING - MG',
  'CB EMPREENDIMENTOS',
  'CAIRO BENEVIDES',
  'LIEBE VILA OLIMPIA',
  'LIEBE SHOPPING IBIRAPUERA - SP',
  'LIEBE ANALIA FRANCO - SP',
  'LIEBE BOURBON SP'
];

const normalizeText = (value: string) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export default function FilterPanel({
  ano,
  setAno,
  aplicarFiltro,
  setAplicarFiltro,
  selectedEmpresas,
  setSelectedEmpresas,
  onRefresh,
  loading,
  onEmpresasInitialized
}: FilterPanelProps) {
  const anos = [2024, 2025, 2026];
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [showCacheInfo, setShowCacheInfo] = useState(false);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresasLoading, setEmpresasLoading] = useState(false);
  const [showEmpresas, setShowEmpresas] = useState(true);

  useEffect(() => {
    const carregarEmpresas = async () => {
      setEmpresasLoading(true);
      try {
        const response = await produtosApi.getEmpresas();
        const exclusoes = new Set(EMPRESAS_EXCLUIDAS.map(normalizeText));
        const empresasFiltradas = response.empresas.filter(
          (e) => !exclusoes.has(normalizeText(e.empresa))
        );
        setEmpresas(empresasFiltradas);
        const initialIds = empresasFiltradas.map(e => e.idempresa);
        if (selectedEmpresas.length === 0 && initialIds.length > 0) {
          setSelectedEmpresas(initialIds);
        }
        onEmpresasInitialized?.(initialIds);
      } catch (error) {
        console.error('Erro ao carregar empresas:', error);
      } finally {
        setEmpresasLoading(false);
      }
    };
    carregarEmpresas();
  }, [onEmpresasInitialized, setSelectedEmpresas]);

  const allEmpresaIds = useMemo(() => empresas.map(e => e.idempresa), [empresas]);
  const allSelected = empresas.length > 0 && selectedEmpresas.length === empresas.length;

  const toggleAllEmpresas = (checked: boolean) => {
    setSelectedEmpresas(checked ? allEmpresaIds : []);
  };

  const toggleEmpresa = (idempresa: number) => {
    if (selectedEmpresas.includes(idempresa)) {
      setSelectedEmpresas(selectedEmpresas.filter(id => id !== idempresa));
      return;
    }
    setSelectedEmpresas([...selectedEmpresas, idempresa]);
  };

  const handleCarregarCache = async () => {
    setCacheLoading(true);
    try {
      await produtosApi.carregarCache(ano);
      const status = await produtosApi.getCacheStatus();
      setCacheStatus(status);
      setShowCacheInfo(true);
      // Atualiza os dados apos carregar cache
      onRefresh();
    } catch (error) {
      console.error('Erro ao carregar cache:', error);
    } finally {
      setCacheLoading(false);
    }
  };

  const handleLimparCache = async () => {
    try {
      await produtosApi.limparCache();
      setCacheStatus(null);
      setShowCacheInfo(false);
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
    }
  };

  const handleCheckStatus = async () => {
    try {
      const status = await produtosApi.getCacheStatus();
      setCacheStatus(status);
      setShowCacheInfo(true);
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="ano" className="text-sm font-medium text-gray-600">
            Ano:
          </label>
          <select
            id="ano"
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
          >
            {anos.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="filtro"
            checked={aplicarFiltro}
            onChange={(e) => setAplicarFiltro(e.target.checked)}
            className="h-4 w-4 text-rose-600 border-gray-300 rounded focus:ring-rose-500"
          />
          <label htmlFor="filtro" className="text-sm text-gray-600">
            Apenas EM LINHA (excluir EDICAO LIMITADA)
          </label>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Botao Carregar Cache */}
          <button
            onClick={handleCarregarCache}
            disabled={cacheLoading || loading}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            title="Pre-carrega todos os dados em cache para navegacao rapida"
          >
            {cacheLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Carregando...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Carregar Cache
              </>
            )}
          </button>

          {/* Botao Status */}
          <button
            onClick={handleCheckStatus}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            title="Ver status do cache"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* Botao Atualizar */}
          <button
            onClick={onRefresh}
            disabled={loading || cacheLoading}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Carregando...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Atualizar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Empresas */}
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Empresas</span>
          <div className="flex items-center gap-3">
            {empresasLoading && <span className="text-xs text-gray-500">Carregando...</span>}
            <button
              type="button"
              onClick={() => setShowEmpresas(v => !v)}
              className="text-xs px-2 py-1 border border-gray-300 rounded bg-white hover:bg-gray-100 text-gray-700"
            >
              {showEmpresas ? 'Recolher' : 'Expandir'}
            </button>
          </div>
        </div>
        {showEmpresas && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="empresas-all"
                checked={allSelected}
                onChange={(e) => toggleAllEmpresas(e.target.checked)}
                className="h-4 w-4 text-rose-600 border-gray-300 rounded focus:ring-rose-500"
              />
              <label htmlFor="empresas-all" className="text-sm text-gray-700 font-medium">
                Selecionar todas
              </label>
              <span className="text-xs text-gray-500 ml-2">
                ({selectedEmpresas.length} de {empresas.length} selecionadas)
              </span>
            </div>
            <div className="max-h-32 overflow-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {empresas.map((empresa) => (
                <label key={empresa.idempresa} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedEmpresas.includes(empresa.idempresa)}
                    onChange={() => toggleEmpresa(empresa.idempresa)}
                    className="h-4 w-4 text-rose-600 border-gray-300 rounded focus:ring-rose-500"
                  />
                  <span>{empresa.empresa} ({empresa.idempresa})</span>
                </label>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Info do Cache */}
      {showCacheInfo && cacheStatus && (
        <div className="bg-gray-50 p-3 rounded-md border border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <div className={`flex items-center gap-1 ${cacheStatus.carregado ? 'text-green-600' : 'text-gray-500'}`}>
              <span className={`w-2 h-2 rounded-full ${cacheStatus.carregado ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              {cacheStatus.carregado ? 'Cache ativo' : 'Cache vazio'}
            </div>
            {cacheStatus.carregado && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">
                  {cacheStatus.comFiltro} SKUs (filtrado)
                </span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">
                  Expira em: {cacheStatus.expiraEm}
                </span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">
                  {cacheStatus.referenciasEmCache} referencias em cache
                </span>
              </>
            )}
          </div>
          <button
            onClick={handleLimparCache}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Limpar cache
          </button>
        </div>
      )}
    </div>
  );
}
