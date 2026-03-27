'use client';

import { useState } from 'react';
import { produtosApi, CacheStatus } from '@/services/api';

interface FilterPanelProps {
  ano: number;
  setAno: (ano: number) => void;
  aplicarFiltro: boolean;
  setAplicarFiltro: (value: boolean) => void;
  onRefresh: () => void;
  loading: boolean;
}

export default function FilterPanel({
  ano,
  setAno,
  aplicarFiltro,
  setAplicarFiltro,
  onRefresh,
  loading
}: FilterPanelProps) {
  const anos = [2024, 2025, 2026];
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [showCacheInfo, setShowCacheInfo] = useState(false);

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
