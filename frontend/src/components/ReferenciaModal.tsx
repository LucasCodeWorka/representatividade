'use client';

import { useState, useEffect } from 'react';
import { produtosApi, SkuReferencia, ReferenciaMetricas } from '@/services/api';

interface ReferenciaModalProps {
  referencia: string | null;
  ano: number;
  onClose: () => void;
}

export default function ReferenciaModal({ referencia, ano, onClose }: ReferenciaModalProps) {
  const [skus, setSkus] = useState<SkuReferencia[]>([]);
  const [metricas, setMetricas] = useState<ReferenciaMetricas | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!referencia) return;

    const fetchSkus = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await produtosApi.getSkusPorReferencia(referencia, ano);
        setSkus(response.skus);
        setMetricas(response.metricas);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar SKUs');
      } finally {
        setLoading(false);
      }
    };

    fetchSkus();
  }, [referencia, ano]);

  if (!referencia) return null;

  const grupo = skus[0]?.grupo || '-';

  // Calcula estatisticas por classe
  const skusClasseA = skus.filter(s => s.classificacao === 'A').length;
  const skusClasseB = skus.filter(s => s.classificacao === 'B').length;
  const skusClasseC = skus.filter(s => s.classificacao === 'C').length;
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
          {loading && (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-rose-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && skus.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              Nenhum SKU com venda encontrado para esta referencia.
            </div>
          )}

          {!loading && !error && skus.length > 0 && (
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
                {skus.map((sku) => (
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
