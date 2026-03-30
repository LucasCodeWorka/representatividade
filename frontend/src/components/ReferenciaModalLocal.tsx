'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Produto, RetiradaFlag, WorkflowStage } from '@/services/api';

interface SaveSelectionsPayload {
  stage: WorkflowStage;
  action: 'save' | 'approve' | 'reject';
  referencia: string;
  referenciaProdutos: Produto[];
  selectedReference: boolean;
  selectedColors: string[];
  selectedSkuIds: number[];
}

interface ReferenciaModalLocalProps {
  mode: WorkflowStage;
  referencia: string | null;
  produtos: Produto[];
  flags: RetiradaFlag[];
  findExactFlag: (targetType: 'SKU' | 'COR' | 'REFERENCIA', payload: { referencia?: string | null; cor?: string | null; cd_produto?: number | null; }) => RetiradaFlag | null;
  getCoverageForProduto: (produto: Produto) => { type: 'SKU' | 'COR' | 'REFERENCIA'; flag: RetiradaFlag } | null;
  onSaveSelections: (payload: SaveSelectionsPayload) => Promise<void>;
  onUndoApproval?: (referencia: string) => Promise<void>;
  onClose: () => void;
}

export default function ReferenciaModalLocal({
  mode,
  referencia,
  produtos,
  flags,
  findExactFlag,
  getCoverageForProduto,
  onSaveSelections,
  onUndoApproval,
  onClose
}: ReferenciaModalLocalProps) {
  const [viewMode, setViewMode] = useState<'sku' | 'cor'>('sku');
  const [selectedReference, setSelectedReference] = useState(false);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSkuIds, setSelectedSkuIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [undoingApproval, setUndoingApproval] = useState(false);

  const skusDaReferencia = useMemo(() => {
    if (!referencia) return [];
    return produtos
      .filter((p) => p.referencia === referencia)
      .sort((a, b) => b.vl_total - a.vl_total);
  }, [referencia, produtos]);

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
  }, [coresAgrupadas, skusDaReferencia]);

  useEffect(() => {
    if (!referencia) return;

    console.log('[MODAL] Rehidratando modal para referência:', referencia, 'mode:', mode);
    console.log('[MODAL] Total de flags recebidas:', flags.length);

    const flagsAtivos = flags.filter(
      (flag) => flag.status !== 'rejeitado' && flag.referencia === referencia
    );
    console.log('[MODAL] Flags ativas para esta referência:', flagsAtivos.length);

    const referenciaFlags =
      mode === 'DIRETORIA'
        ? (() => {
            const diretoriaFlags = flagsAtivos.filter((flag) => flag.stage === 'DIRETORIA');
            return diretoriaFlags.length > 0
              ? diretoriaFlags
              : flagsAtivos.filter((flag) => flag.stage === 'PCP');
          })()
        : flagsAtivos.filter((flag) => flag.stage === 'PCP');

    console.log('[MODAL] Flags para rehidratação:', referenciaFlags.length);

    const initialReference = referenciaFlags.some((flag) => flag.targetType === 'REFERENCIA');
    const initialColors = referenciaFlags
      .filter((flag) => flag.targetType === 'COR' && flag.cor)
      .map((flag) => flag.cor as string);
    const initialSkus = referenciaFlags
      .filter((flag) => flag.targetType === 'SKU' && flag.cd_produto !== null)
      .map((flag) => Number(flag.cd_produto));

    console.log('[MODAL] Rehidratação:', {
      initialReference,
      initialColorsCount: initialColors.length,
      initialSkusCount: initialSkus.length,
      initialSkus: initialSkus,
      flagsSkuRaw: referenciaFlags.filter(f => f.targetType === 'SKU').map(f => ({ id: f.id, cd_produto: f.cd_produto, type: typeof f.cd_produto }))
    });

    const hasAnySavedAnalysis = referenciaFlags.length > 0;
    const shouldFallbackToReference =
      hasAnySavedAnalysis &&
      !initialReference &&
      initialColors.length === 0 &&
      initialSkus.length === 0;

    setSelectedReference(initialReference || shouldFallbackToReference);
    setSelectedColors(Array.from(new Set(initialColors)));
    setSelectedSkuIds(Array.from(new Set(initialSkus)));
  }, [flags, mode, referencia]);

  if (!referencia) return null;

  const grupo = skusDaReferencia[0]?.grupo || '-';
  const skusClasseA = skusDaReferencia.filter((s) => s.classificacao === 'A').length;
  const skusClasseB = skusDaReferencia.filter((s) => s.classificacao === 'B').length;
  const skusClasseC = skusDaReferencia.filter((s) => s.classificacao === 'C').length;
  const temClasseC = skusClasseC > 0;
  const hasApprovedFlags = flags.some((flag) => flag.referencia === referencia && flag.status === 'aprovado');

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

  const getDraftCoverageBadge = (produto: Produto) => {
    if (selectedReference) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white">Por referencia</span>;
    }
    if (selectedColors.includes(produto.cor || '-')) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white">Por cor</span>;
    }
    if (selectedSkuIds.includes(produto.cd_produto)) {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white">Por SKU</span>;
    }

    const coverage = getCoverageForProduto(produto);
    if (!coverage) return null;

    const labels = {
      SKU: 'Marcado SKU',
      COR: 'Coberto Cor',
      REFERENCIA: 'Coberto Ref'
    };

    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-300 text-slate-800">
        {labels[coverage.type]}
      </span>
    );
  };

  const toggleReference = () => {
    const nextValue = !selectedReference;
    setSelectedReference(nextValue);

    if (nextValue) {
      setSelectedColors([]);
      setSelectedSkuIds([]);
    }
  };

  const toggleColor = (cor: string) => {
    if (selectedReference) return;

    setSelectedColors((current) => {
      const exists = current.includes(cor);
      const next = exists ? current.filter((item) => item !== cor) : [...current, cor];

      if (!exists) {
        const skuIdsDaCor = skusDaReferencia
          .filter((sku) => (sku.cor || '-') === cor)
          .map((sku) => Number(sku.cd_produto));
        setSelectedSkuIds((skuIds) => skuIds.filter((id) => !skuIdsDaCor.includes(id)));
      }

      return next;
    });
  };

  const toggleSku = (produto: Produto) => {
    if (selectedReference || selectedColors.includes(produto.cor || '-')) return;
    const skuId = Number(produto.cd_produto);

    setSelectedSkuIds((current) =>
      current.includes(skuId)
        ? current.filter((id) => id !== skuId)
        : [...current, skuId]
    );
  };

  const handleSubmit = async (action: 'save' | 'approve' | 'reject') => {
    setSaving(true);
    try {
      await onSaveSelections({
        stage: mode,
        action,
        referencia,
        referenciaProdutos: skusDaReferencia,
        selectedReference,
        selectedColors,
        selectedSkuIds
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleUndoApproval = async () => {
    if (!onUndoApproval) return;

    setUndoingApproval(true);
    try {
      await onUndoApproval(referencia);
      onClose();
    } finally {
      setUndoingApproval(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className={`px-6 py-4 border-b border-gray-200 flex items-center justify-between ${temClasseC ? 'bg-red-50' : 'bg-gray-50'}`}>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
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
                <span className="text-gray-600">Grupo: <span className="font-medium text-gray-800">{grupo}</span></span>
                <span className="text-gray-600">SKUs: <span className="font-medium text-gray-800">{metricas.totalSkus}</span></span>
                <span className="text-gray-600">Qtd: <span className="font-medium text-gray-800">{metricas.totalQtd.toLocaleString('pt-BR')}</span></span>
                <span className="text-gray-600">Valor: <span className="font-medium text-emerald-700">R$ {metricas.totalVl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></span>
                <span className="text-emerald-600"><strong>{skusClasseA}</strong> classe A</span>
                <span className="text-amber-600"><strong>{skusClasseB}</strong> classe B</span>
                <span className="text-red-600"><strong>{skusClasseC}</strong> classe C</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-auto max-h-[calc(90vh-140px)]">
          <div className="px-6 pt-4 flex items-center justify-between gap-4">
            <div>
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
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={selectedReference}
                onChange={toggleReference}
                className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
              />
              Retirar referencia inteira
            </label>
          </div>

          <div className="px-6 pt-3 text-sm text-gray-500">
            {mode === 'PCP'
              ? <>As alteracoes so vao para a diretoria quando clicar em <strong>Salvar analise PCP</strong>.</>
              : <>A diretoria pode ajustar a selecao e <strong>aprovar</strong> o que deve ir para retirada final.</>}
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
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Retirar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {skusDaReferencia.map((sku) => {
                  const disabled = selectedReference || selectedColors.includes(sku.cor || '-');

                  return (
                    <tr
                      key={sku.cd_produto}
                      className={`transition-colors ${sku.classificacao === 'C' ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}
                    >
                      <td className={`px-4 py-3 text-sm font-medium ${sku.classificacao === 'C' ? 'text-red-800' : 'text-gray-900'}`}>
                        <div className="flex items-center gap-2">
                          <span>{sku.cd_produto}</span>
                          {getDraftCoverageBadge(sku)}
                          {sku.suspenso && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-900 text-white">
                              SUSPENSO
                            </span>
                          )}
                        </div>
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
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedSkuIds.includes(Number(sku.cd_produto))}
                          disabled={disabled}
                          onChange={() => toggleSku(sku)}
                          className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500 disabled:opacity-40"
                          aria-label={`Retirar SKU ${sku.cd_produto}`}
                        />
                      </td>
                    </tr>
                  );
                })}
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
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Retirar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {matrizPorCor.map((bloco) => (
                  <Fragment key={bloco.cor}>
                    <tr className="bg-rose-50 border-t-2 border-rose-200">
                      <td className="px-4 py-2 text-sm font-semibold text-rose-800">
                        <div className="flex items-center gap-2">
                          <span>Cor: {bloco.cor} ({bloco.resumo.skusCount} SKUs)</span>
                          {selectedColors.includes(bloco.cor) && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white">
                              Selecionada
                            </span>
                          )}
                        </div>
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
                      <td className="px-4 py-2 text-sm text-center">
                        <input
                          type="checkbox"
                          checked={selectedColors.includes(bloco.cor)}
                          disabled={selectedReference}
                          onChange={() => toggleColor(bloco.cor)}
                          className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500 disabled:opacity-40"
                          aria-label={`Retirar cor ${bloco.cor}`}
                        />
                      </td>
                    </tr>
                    {bloco.itens.map((sku) => {
                      const disabled = selectedReference || selectedColors.includes(bloco.cor);

                      return (
                        <tr key={sku.cd_produto} className={`transition-colors ${sku.classificacao === 'C' ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}>
                          <td className={`px-4 py-2 text-sm font-medium pl-8 ${sku.classificacao === 'C' ? 'text-red-800' : 'text-gray-900'}`}>
                            <div className="flex items-center gap-2">
                              <span>{sku.cd_produto}</span>
                              {getDraftCoverageBadge(sku)}
                              {sku.suspenso && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-900 text-white">
                                  SUSPENSO
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700 max-w-xs truncate" title={sku.descricao}>{sku.descricao}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{sku.tam}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">{sku.qt_liquida.toLocaleString('pt-BR')}</td>
                          <td className={`px-4 py-2 text-sm text-right ${sku.classificacao === 'C' ? 'text-red-700 font-medium' : 'text-gray-900'}`}>{sku.vl_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">{sku.percent_individual.toFixed(2)}%</td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">{sku.percent_acumulado.toFixed(2)}%</td>
                          <td className="px-4 py-2 text-center">{getClassBadge(sku.classificacao)}</td>
                          <td className="px-4 py-2 text-center">{sku.classificacao === 'C' ? getClassBadge('C') : <span className="text-xs text-gray-400">-</span>}</td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedSkuIds.includes(Number(sku.cd_produto))}
                              disabled={disabled}
                              onChange={() => toggleSku(sku)}
                              className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500 disabled:opacity-40"
                              aria-label={`Retirar SKU ${sku.cd_produto}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <span className="text-sm text-gray-500">
            {flags.filter((flag) => flag.status !== 'rejeitado').length} marcacao(oes) carregada(s)
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            {mode === 'DIRETORIA' && hasApprovedFlags && (
              <button
                onClick={handleUndoApproval}
                disabled={saving || undoingApproval}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors disabled:opacity-60"
              >
                {undoingApproval ? 'Desfazendo...' : 'Desfazer aprovacao'}
              </button>
            )}
            {mode === 'DIRETORIA' && (
              <button
                onClick={() => handleSubmit('reject')}
                disabled={saving || undoingApproval}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Rejeitar'}
              </button>
            )}
            <button
              onClick={() => handleSubmit('save')}
              disabled={saving || undoingApproval}
              className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors disabled:opacity-60"
            >
              {saving ? 'Salvando...' : mode === 'PCP' ? 'Salvar analise PCP' : 'Salvar diretoria'}
            </button>
            {mode === 'DIRETORIA' && (
              <button
                onClick={() => handleSubmit('approve')}
                disabled={saving || undoingApproval}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Aprovar para retirada'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
