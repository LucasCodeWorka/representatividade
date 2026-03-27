'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { produtosApi, Produto, Metricas } from '@/services/api';
import MetricCard from '@/components/MetricCard';
import ProductTable from '@/components/ProductTable';
import FilterPanel from '@/components/FilterPanel';
import ReferenciaModalLocal from '@/components/ReferenciaModalLocal';

export default function Home() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ano, setAno] = useState(2026);
  const [aplicarFiltro, setAplicarFiltro] = useState(true);
  const [percentAcumuladoMax, setPercentAcumuladoMax] = useState(100);
  const [selectedReferencia, setSelectedReferencia] = useState<string | null>(null);
  const [limiteClasseC, setLimiteClasseC] = useState(93); // Limite para classe C (90%, 93% ou 95%)

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await produtosApi.getRepresentatividade(ano, aplicarFiltro);
      setProdutos(response.produtos);
      setMetricas(response.metricas);
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
      setError(err.message || 'Erro ao carregar dados. Verifique se o backend está rodando.');
    } finally {
      setLoading(false);
    }
  }, [ano, aplicarFiltro]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Recalcula classificação baseada no limite configurável
  const produtosComClassificacao = useMemo(() => {
    return produtos.map(p => ({
      ...p,
      classificacao: p.percent_acumulado <= 80 ? 'A' as const :
                     p.percent_acumulado <= limiteClasseC ? 'B' as const : 'C' as const
    }));
  }, [produtos, limiteClasseC]);

  const produtosFiltrados = useMemo(() => {
    return produtosComClassificacao.filter(p => p.percent_acumulado <= percentAcumuladoMax);
  }, [produtosComClassificacao, percentAcumuladoMax]);

  const metricasFiltradas = useMemo(() => {
    if (!metricas) return null;
    const totalFiltrado = produtosFiltrados.reduce((sum, p) => sum + p.qt_liquida, 0);
    // Recalcula candidatos baseado no limite configurável
    const candidatosDescontinuacao = produtosComClassificacao.filter(p => p.classificacao === 'C').length;
    return {
      ...metricas,
      totalSkusFiltrados: produtosFiltrados.length,
      totalVendidoFiltrado: totalFiltrado,
      skusCandidatosDescontinuacao: candidatosDescontinuacao
    };
  }, [metricas, produtosFiltrados, produtosComClassificacao]);

  return (
    <main className="min-h-screen p-6 bg-gray-50">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Representatividade de Produtos
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Analise quais SKUs concentram suas vendas para decisoes de descontinuacao
            </p>
          </div>
        </div>

        {/* Filtros */}
        <FilterPanel
          ano={ano}
          setAno={setAno}
          aplicarFiltro={aplicarFiltro}
          setAplicarFiltro={setAplicarFiltro}
          onRefresh={carregarDados}
          loading={loading}
        />

        {!loading && !error && metricas && (
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Limite Classe C:</span>
              <select
                value={limiteClasseC}
                onChange={(e) => setLimiteClasseC(Number(e.target.value))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              >
                <option value={90}>90%</option>
                <option value={93}>93%</option>
                <option value={95}>95%</option>
              </select>
            </div>
          </div>
        )}

        {/* Controle deslizante de % Acumulado */}
        {!loading && !error && metricas && (
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-600">
                Filtrar por % Acumulado (ate {percentAcumuladoMax}%)
              </label>
              <span className="text-sm text-gray-500">
                {produtosFiltrados.length} de {produtos.length} SKUs
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={percentAcumuladoMax}
              onChange={(e) => setPercentAcumuladoMax(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1%</span>
              <span className="text-rose-600 font-medium">{percentAcumuladoMax}%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-medium">Erro ao carregar dados</p>
            <p className="text-sm mt-1">{error}</p>
            <p className="text-sm mt-2">
              Certifique-se de que o backend esta rodando em http://localhost:3001
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <svg className="animate-spin h-10 w-10 text-blue-600 mx-auto" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="mt-4 text-gray-600">Carregando dados...</p>
              <p className="text-sm text-gray-400 mt-1">Isso pode levar alguns minutos na primeira vez</p>
            </div>
          </div>
        )}

        {/* Conteúdo */}
        {!loading && !error && metricas && (
          <>
            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <MetricCard
                title="Total de SKUs"
                value={metricas.totalSkus.toLocaleString('pt-BR')}
                subtitle="Produtos ativos"
                color="blue"
                icon="box"
              />
              <MetricCard
                title="SKUs (80% valor)"
                value={metricas.skus80Percent.toLocaleString('pt-BR')}
                subtitle={`${((metricas.skus80Percent / metricas.totalSkus) * 100).toFixed(1)}% do total`}
                color="green"
                icon="chart"
              />
              <MetricCard
                title="Total Qtd"
                value={metricas.totalVendido.toLocaleString('pt-BR')}
                subtitle="Unidades"
                color="blue"
                icon="box"
              />
              <MetricCard
                title="Total Valor"
                value={`R$ ${(metricas.totalValor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                subtitle="Faturamento"
                color="green"
                icon="money"
              />
              <MetricCard
                title="Candidatos Descontinuacao"
                value={metricasFiltradas?.skusCandidatosDescontinuacao.toLocaleString('pt-BR') || '0'}
                subtitle={`Classe C (> ${limiteClasseC}%)`}
                color="red"
                icon="warning"
              />
            </div>

            {/* Tabela de SKUs */}
            <div>
              <h2 className="text-lg font-semibold mb-3">
                Detalhamento por SKU
                <span className="text-sm font-normal text-gray-500 ml-2">
                  (clique na referencia para ver agrupamento)
                </span>
              </h2>
              <ProductTable
                produtos={produtosFiltrados}
                onSelectReferencia={(ref) => setSelectedReferencia(ref)}
                limiteClasseC={limiteClasseC}
              />
            </div>

            {/* Legenda Classificação */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <div className="mb-3">
                <h3 className="font-semibold text-gray-800">Classificacao ABC</h3>
              </div>
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">A</span>
                  <span className="text-gray-600">0-80% das vendas - <strong className="text-emerald-700">Essenciais</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">B</span>
                  <span className="text-gray-600">80-{limiteClasseC}% - <strong className="text-amber-700">Moderados</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">C</span>
                  <span className="text-gray-600">{limiteClasseC}-100% - <strong className="text-red-700">Candidatos a descontinuacao</strong></span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Modal de Referência */}
        {selectedReferencia && (
          <ReferenciaModalLocal
            referencia={selectedReferencia}
            produtos={produtosComClassificacao}
            onClose={() => setSelectedReferencia(null)}
          />
        )}
      </div>
    </main>
  );
}
