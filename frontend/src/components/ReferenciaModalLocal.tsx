'use client';

import { Fragment, useMemo, useState } from 'react';
import { Produto } from '@/services/api';

interface ReferenciaModalLocalProps {
  referencia: string | null;
  produtos: Produto[]; // Todos os produtos já em memória
  onClose: () => void;
}

export default function ReferenciaModalLocal({ referencia, produtos, onClose }: ReferenciaModalLocalProps) {
  const [viewMode, setViewMode] = useState<'sku' | 'cor'>('sku');

  // Filtra os SKUs da referência selecionada - instantâneo pois já está em memória
  const skusDaReferencia = useMemo(() => {
    if (!referencia) return [];
    return produtos
      .filter(p => p.referencia === referencia)
      .sort((a, b) => b.vl_total - a.vl_total); // Ordena por valor decrescente
  }, [referencia, produtos]);

  // Calcula métricas
  const metricas = useMemo(() => {
    if (skusDaReferencia.length === 0) return null;
    return {
      totalSkus: skusDaReferencia.length,
      totalQtd: skusDaReferencia.reduce((sum, s) => sum + s.qt_liquida, 0),
      totalVl: skusDaReferencia.reduce((sum, s) => sum + s.vl_total, 0),
    };
  }, [skusDaReferencia]);

  const coresAgrupadas = useMemo(() => {
    if (skusDaReferencia.length === 0) return [];

    const totalVl = skusDaReferencia.reduce((sum, s) => sum + s.vl_total, 0);
    const mapa = new Map<string, { cor: string; skusCount: number; qt_liquida: number; vl_total: number }>();

    skusDaReferencia.forEach((sku) => {
      const key = sku.cor || '-';
      const atual = mapa.get(key) || { cor: key, skusCount: 0, qt_liquida: 0, vl_total: 0 };
      mapa.set(key, {
        cor: key,
        skusCount: atual.skusCount + 1,
        qt_liquida: atual.qt_liquida + sku.qt_liquida,
        vl_total: atual.vl_total + sku.vl_total,
      });
    });

    const agrupadas = Array.from(mapa.values()).sort((a, b) => b.vl_total - a.vl_total);
    let acumulado = 0;
    return agrupadas.map((item) => {
      const percentIndividual = totalVl > 0 ? (item.vl_total / totalVl) * 100 : 0;
      acumulado += percentIndividual;
      return {
        ...item,
        percent_individual: percentIndividual,
        percent_acumulado: acumulado,
      };
    });
  }, [skusDaReferencia]);

  const matrizPorCor = useMemo(() => {
    if (skusDaReferencia.length === 0) return [];

    const mapa = new Map<string, Produto[]>();
    skusDaReferencia.forEach((sku) => {
      const key = sku.cor || '-';
      const atual = mapa.get(key) || [];
      atual.push(sku);
      mapa.set(key, atual);
    });

    return coresAgrupadas.map((corResumo) => {
      const itens = (mapa.get(corResumo.cor) || []).sort((a, b) => b.vl_total - a.vl_total);
      const candidatosCount = itens.filter((sku) => sku.classificacao === 'C').length;
      return {
        cor: corResumo.cor,
        resumo: corResumo,
        candidatosCount,
        itens
      };
    });
  }, [skusDaReferencia, coresAgrupadas]);

  if (!referencia) return null;

  const grupo = skusDaReferencia[0]?.grupo || '-';

  // Calcula estatisticas por classe
  const skusClasseA = skusDaReferencia.filter(s => s.classificacao === 'A').length;
  const skusClasseB = skusDaReferencia.filter(s => s.classificacao === 'B').length;
  const skusClasseC = skusDaReferencia.filter(s => s.classificacao === 'C').length;
  const temClasseC = skusClasseC > 0;

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 border-b border-gray-200 flex items-center justify-between ${temClasseC ? 'bg-red-50' : 'bg-gray-50'}`}>
          <div>
            <div className="flex items-center gap-3">
              <h2 className={`text-xl font-semibold ${temClasseC ? 'text-red-800' : 'text-gray-900'}`}>
                Referencia: {referencia}
              </h2>
              {temClasseC && (
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                  {skusClasseC} SKU{skusClasseC > 1 ? 's' : ''} candidato{skusClasseC > 1 ? 's' : ''} a descontinuacao
                </span>
              )}
            </div>
            {metricas && (
              <div className="flex flex-wrap gap-4 text-sm mt-2">
                <span className="text-gray-600">
                  Grupo: <span className="font-medium text-gray-800">{grupo}</span>
                </span>
                <span className="text-gray-600">
                  SKUs: <span className="font-medium text-gray-800">{metricas.totalSkus}</span>
                </span>
                <span className="text-gray-600">
                  Qtd: <span className="font-medium text-gray-800">{metricas.totalQtd.toLocaleString('pt-BR')}</span>
                </span>
                <span className="text-gray-600">
                  Valor: <span className="font-medium text-emerald-700">R$ {metricas.totalVl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </span>
                <span className="text-emerald-600">
                  <strong>{skusClasseA}</strong> classe A
                </span>
                <span className="text-amber-600">
                  <strong>{skusClasseB}</strong> classe B
                </span>
                <span className="text-red-600">
                  <strong>{skusClasseC}</strong> classe C
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto max-h-[calc(90vh-140px)]">
          <div className="px-6 pt-4">
            <label className="text-sm text-gray-600 mr-2">Visualizacao:</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'sku' | 'cor')}
              className="px-3 py-1.5 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            >
              <option value="sku">SKU</option>
              <option value="cor">Agrupado por Cor</option>
            </select>
          </div>

          {skusDaReferencia.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              Nenhum SKU encontrado para esta referencia.
            </div>
          )}

          {skusDaReferencia.length > 0 && viewMode === 'sku' && (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Codigo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descricao</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tam</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qtd</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor R$</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% Ind</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% Acum</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Classe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {skusDaReferencia.map((sku) => (
                  <tr
                    key={sku.cd_produto}
                    className={`transition-colors ${
                      sku.classificacao === 'C'
                        ? 'bg-red-50 hover:bg-red-100'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className={`px-4 py-3 text-sm font-medium ${sku.classificacao === 'C' ? 'text-red-800' : 'text-gray-900'}`}>
                      {sku.cd_produto}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate" title={sku.descricao}>{sku.descricao}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{sku.cor}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{sku.tam}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{sku.qt_liquida.toLocaleString('pt-BR')}</td>
                    <td className={`px-4 py-3 text-sm text-right ${sku.classificacao === 'C' ? 'text-red-700 font-medium' : 'text-gray-900'}`}>
                      {sku.vl_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{sku.percent_individual.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{sku.percent_acumulado.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-center">{getClassBadge(sku.classificacao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {skusDaReferencia.length > 0 && viewMode === 'cor' && (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cor / Codigo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descricao</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tam</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qtd</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Valor R$</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% Ind</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% Acum</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Classe</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Candidato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {matrizPorCor.map((bloco) => (
                  <Fragment key={bloco.cor}>
                    <tr className="bg-rose-50 border-t-2 border-rose-200">
                      <td className="px-4 py-2 text-sm font-semibold text-rose-800">
                        Cor: {bloco.cor} ({bloco.resumo.skusCount} SKUs)
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">Subtotal da cor</td>
                      <td className="px-4 py-2 text-sm text-gray-500 text-left">-</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{Math.round(bloco.resumo.qt_liquida).toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{bloco.resumo.vl_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{bloco.resumo.percent_individual.toFixed(2)}%</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{bloco.resumo.percent_acumulado.toFixed(2)}%</td>
                      <td className="px-4 py-2 text-sm text-center text-gray-400">-</td>
                      <td className="px-4 py-2 text-sm text-center">
                        {bloco.candidatosCount > 0 ? (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            {bloco.candidatosCount} candidato{bloco.candidatosCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">0</span>
                        )}
                      </td>
                    </tr>
                    {bloco.itens.map((sku) => (
                      <tr key={sku.cd_produto} className={`transition-colors ${sku.classificacao === 'C' ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}>
                        <td className={`px-4 py-2 text-sm font-medium pl-8 ${sku.classificacao === 'C' ? 'text-red-800' : 'text-gray-900'}`}>{sku.cd_produto}</td>
                        <td className="px-4 py-2 text-sm text-gray-700 max-w-xs truncate" title={sku.descricao}>{sku.descricao}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{sku.tam}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{sku.qt_liquida.toLocaleString('pt-BR')}</td>
                        <td className={`px-4 py-2 text-sm text-right ${sku.classificacao === 'C' ? 'text-red-700 font-medium' : 'text-gray-900'}`}>{sku.vl_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{sku.percent_individual.toFixed(2)}%</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{sku.percent_acumulado.toFixed(2)}%</td>
                        <td className="px-4 py-2 text-center">{getClassBadge(sku.classificacao)}</td>
                        <td className="px-4 py-2 text-center">{sku.classificacao === 'C' ? getClassBadge('C') : <span className="text-xs text-gray-400">-</span>}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
