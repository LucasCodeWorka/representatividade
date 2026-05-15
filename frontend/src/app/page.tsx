'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  produtosApi,
  flagsApi,
  cenariosApi,
  Produto,
  Metricas,
  RetiradaFlag,
  FlagStatus,
  FlagTargetType,
  WorkflowStage,
  Scenario,
  ScenarioItem,
  ScenarioSummary
} from '@/services/api';
import MetricCard from '@/components/MetricCard';
import ProductTable from '@/components/ProductTable';
import FilterPanel from '@/components/FilterPanel';
import ReferenciaModalLocal from '@/components/ReferenciaModalLocal';
import ScenarioComparison from '@/components/ScenarioComparison';
import AnaliseSuspensao from '@/components/AnaliseSuspensao';
import { useNavigation } from '@/components/NavigationContext';

type SaveSelectionsPayload = {
  stage: WorkflowStage;
  action: 'save' | 'approve' | 'reject';
  referencia: string;
  referenciaProdutos: Produto[];
  selectedReference: boolean;
  selectedColors: string[];
  selectedSkuIds: number[];
};

type RetiradaFinalRow = {
  uniqueKey: string;
  origem: WorkflowStage;
  tipoMarcacao: FlagTargetType;
  referencia: string;
  grupo: string;
  cd_produto: number;
  descricao: string;
  cor: string;
  tam: string;
  qt_liquida: number;
  vl_total: number;
  percent_individual: number;
  percent_acumulado: number;
  classificacao: string;
  suspenso: boolean;
  aprovadoEm: string;
};

export default function Home() {
  const { activeSection } = useNavigation();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [flags, setFlags] = useState<RetiradaFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [cenariosLoading, setCenariosLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ano, setAno] = useState(2026);
  const [aplicarFiltro, setAplicarFiltro] = useState(true);
  const [selectedEmpresas, setSelectedEmpresas] = useState<number[]>([]);
  const [percentAcumuladoMax, setPercentAcumuladoMax] = useState(100);
  const [selectedReferencia, setSelectedReferencia] = useState<string | null>(null);
  const [limiteClasseC, setLimiteClasseC] = useState(93);
  const [showOnlyPcpReviewed, setShowOnlyPcpReviewed] = useState(true);
  const [showOnlyPcpSavedInPcp, setShowOnlyPcpSavedInPcp] = useState(false);
  const [clearingPcp, setClearingPcp] = useState(false);
  const [showApprovedInDiretoria, setShowApprovedInDiretoria] = useState(false);
  const [clearingDiretoria, setClearingDiretoria] = useState(false);
  const [approvingAllDiretoria, setApprovingAllDiretoria] = useState(false);
  const [pcpVisibleSkuCount, setPcpVisibleSkuCount] = useState(0);
  const [diretoriaVisibleSkuCount, setDiretoriaVisibleSkuCount] = useState(0);
  const [cenarios, setCenarios] = useState<Scenario[]>([]);
  const [empresasReady, setEmpresasReady] = useState(false);
  const latestRequestId = useRef(0);

  const normalizeText = useCallback((value: string | null | undefined) => {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }, []);

  const normalizeProduto = useCallback((produto: Produto): Produto => {
    const toNumber = (value: unknown, fallback: number = 0) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : fallback;
    };

    return {
      ...produto,
      cd_produto: toNumber(produto.cd_produto, 0),
      qt_liquida: toNumber(produto.qt_liquida, 0),
      vl_total: toNumber(produto.vl_total, 0),
      percent_individual: toNumber(produto.percent_individual, 0),
      percent_acumulado: toNumber(produto.percent_acumulado, 0),
      referencia: normalizeText(produto.referencia),
      cor: normalizeText(produto.cor),
      tam: normalizeText(produto.tam),
      grupo: normalizeText(produto.grupo),
      descricao: normalizeText(produto.descricao)
    };
  }, [normalizeText]);

  const normalizeFlag = useCallback((flag: RetiradaFlag): RetiradaFlag => {
    const cdProduto =
      flag.cd_produto === null || flag.cd_produto === undefined
        ? null
        : Number(flag.cd_produto);

    return {
      ...flag,
      cd_produto: cdProduto !== null && Number.isFinite(cdProduto) ? cdProduto : null,
      referencia: flag.referencia === null ? null : normalizeText(flag.referencia),
      cor: flag.cor === null ? null : normalizeText(flag.cor),
      reason: normalizeText(flag.reason),
      notes: normalizeText(flag.notes)
    };
  }, [normalizeText]);

  const carregarFlags = useCallback(async () => {
    setFlagsLoading(true);
    try {
      const response = await flagsApi.list();
      const normalized = response.flags.map(normalizeFlag);
      console.log('[FLAGS] Flags carregadas do backend:', normalized.length);
      console.log('[FLAGS] Flags SKU:', normalized.filter(f => f.targetType === 'SKU').map(f => ({ id: f.id, cd_produto: f.cd_produto, type: typeof f.cd_produto })));
      setFlags(normalized);
    } catch (err) {
      console.error('Erro ao carregar flags:', err);
    } finally {
      setFlagsLoading(false);
    }
  }, [normalizeFlag]);

  const carregarDados = useCallback(async () => {
    if (!empresasReady) {
      return;
    }

    const requestId = ++latestRequestId.current;
    setLoading(true);
    setError(null);

    try {
      const response = await produtosApi.getRepresentatividade(ano, aplicarFiltro, selectedEmpresas);
      if (requestId !== latestRequestId.current) {
        return;
      }

      setProdutos(response.produtos.map(normalizeProduto));
      setMetricas(response.metricas);
    } catch (err: any) {
      if (requestId !== latestRequestId.current) {
        return;
      }

      console.error('Erro ao carregar dados:', err);
      setError(err.message || 'Erro ao carregar dados. Verifique se o backend esta rodando.');
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
      }
    }
  }, [ano, aplicarFiltro, empresasReady, normalizeProduto, selectedEmpresas]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    carregarFlags();
  }, [carregarFlags]);

  const handleEmpresasInitialized = useCallback((initialIds: number[]) => {
    setSelectedEmpresas((current) => current.length === 0 ? initialIds : current);
    setEmpresasReady(true);
  }, []);

  const carregarCenarios = useCallback(async () => {
    setCenariosLoading(true);
    try {
      const response = await cenariosApi.list();
      setCenarios(response.cenarios);
    } catch (err) {
      console.error('Erro ao carregar cenarios:', err);
    } finally {
      setCenariosLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarCenarios();
  }, [carregarCenarios]);

  const produtosComClassificacao = useMemo(() => {
    return produtos.map((p) => ({
      ...p,
      classificacao: p.percent_acumulado <= 80 ? 'A' as const : p.percent_acumulado <= limiteClasseC ? 'B' as const : 'C' as const
    }));
  }, [produtos, limiteClasseC]);

  const produtosFiltrados = useMemo(() => {
    return produtosComClassificacao.filter((p) => p.percent_acumulado <= percentAcumuladoMax);
  }, [produtosComClassificacao, percentAcumuladoMax]);

  const impactoCortes = useMemo(() => {
    const totalValor = produtos.reduce((sum, p) => sum + p.vl_total, 0);
    const calcular = (limite: number) => {
      const skusCorte = produtos.filter((p) => p.percent_acumulado > limite);
      const valorPerdido = skusCorte.reduce((sum, p) => sum + p.vl_total, 0);
      const percentualPerdido = totalValor > 0 ? (valorPerdido / totalValor) * 100 : 0;

      return {
        limite,
        skus: skusCorte.length,
        valorPerdido,
        percentualPerdido
      };
    };

    return [calcular(90), calcular(93), calcular(95)];
  }, [produtos]);

  const activeFlags = useMemo(
    () => flags.filter((flag) => flag.status !== 'rejeitado'),
    [flags]
  );

  const pcpFlags = useMemo(
    () => activeFlags.filter((flag) => flag.stage === 'PCP'),
    [activeFlags]
  );

  const pcpReferenceKeys = useMemo(
    () => new Set(
      pcpFlags
        .filter((flag) => flag.targetType === 'REFERENCIA' && flag.referencia)
        .map((flag) => String(flag.referencia))
    ),
    [pcpFlags]
  );

  const pcpColorKeys = useMemo(
    () => new Set(
      pcpFlags
        .filter((flag) => flag.targetType === 'COR' && flag.referencia && flag.cor)
        .map((flag) => `${String(flag.referencia)}|${String(flag.cor)}`)
    ),
    [pcpFlags]
  );

  const pcpSkuKeys = useMemo(
    () => new Set(
      pcpFlags
        .filter((flag) => flag.targetType === 'SKU' && flag.referencia && flag.cd_produto !== null)
        .map((flag) => `${String(flag.referencia)}|${Number(flag.cd_produto)}`)
    ),
    [pcpFlags]
  );

  const isProdutoPcpMarked = useCallback((produto: Produto) => {
    const referencia = String(produto.referencia || '');
    const cor = String(produto.cor || '');
    const sku = Number(produto.cd_produto);

    if (pcpReferenceKeys.has(referencia)) return true;
    if (pcpColorKeys.has(`${referencia}|${cor}`)) return true;
    if (pcpSkuKeys.has(`${referencia}|${sku}`)) return true;

    return false;
  }, [pcpColorKeys, pcpReferenceKeys, pcpSkuKeys]);

  const diretoriaFlags = useMemo(
    () => activeFlags.filter((flag) => flag.stage === 'DIRETORIA'),
    [activeFlags]
  );

  const approvedFlags = useMemo(
    () => activeFlags.filter((flag) => flag.status === 'aprovado'),
    [activeFlags]
  );

  const retiradaFinalRows = useMemo<RetiradaFinalRow[]>(() => {
    const rows: RetiradaFinalRow[] = [];
    const seen = new Set<string>();

    approvedFlags.forEach((flag) => {
      const itensReferencia = Array.isArray(flag.snapshot?.itensReferencia) ? flag.snapshot.itensReferencia : [];
      const grupo = flag.snapshot?.referenciaResumo?.grupo || '-';

      const pushRow = (item: any) => {
        const uniqueKey = [
          flag.stage,
          flag.targetType,
          flag.referencia || '',
          item.cd_produto,
          item.cor || '',
          item.tam || ''
        ].join('|');

        if (seen.has(uniqueKey)) {
          return;
        }

        seen.add(uniqueKey);
        rows.push({
          uniqueKey,
          origem: flag.stage,
          tipoMarcacao: flag.targetType,
          referencia: flag.referencia || '',
          grupo,
          cd_produto: Number(item.cd_produto),
          descricao: item.descricao || '',
          cor: item.cor || '',
          tam: item.tam || '',
          qt_liquida: Number(item.qt_liquida || 0),
          vl_total: Number(item.vl_total || 0),
          percent_individual: Number(item.percent_individual || 0),
          percent_acumulado: Number(item.percent_acumulado || 0),
          classificacao: item.classificacao || '-',
          suspenso: Boolean(item.suspenso),
          aprovadoEm: flag.updatedAt
        });
      };

      if (flag.targetType === 'REFERENCIA') {
        itensReferencia.forEach(pushRow);
        return;
      }

      if (flag.targetType === 'COR') {
        itensReferencia
          .filter((item: any) => (item.cor || '') === (flag.cor || ''))
          .forEach(pushRow);
        return;
      }

      if (flag.targetType === 'SKU') {
        const alvo = flag.snapshot?.alvo;
        if (alvo?.cd_produto) {
          pushRow(alvo);
        }
      }
    });

    return rows.sort((a, b) => {
      if (a.referencia !== b.referencia) {
        return a.referencia.localeCompare(b.referencia);
      }
      if (a.cor !== b.cor) {
        return a.cor.localeCompare(b.cor);
      }
      return a.cd_produto - b.cd_produto;
    });
  }, [approvedFlags]);

  const pcpAnalyzedReferences = useMemo(
    () => new Set(pcpFlags.map((flag) => flag.referencia).filter((referencia): referencia is string => Boolean(referencia))),
    [pcpFlags]
  );
  const diretoriaSavedReferences = useMemo(
    () => new Set(diretoriaFlags.map((flag) => flag.referencia).filter((referencia): referencia is string => Boolean(referencia))),
    [diretoriaFlags]
  );
  const approvedReferences = useMemo(
    () => new Set(approvedFlags.map((flag) => flag.referencia).filter((referencia): referencia is string => Boolean(referencia))),
    [approvedFlags]
  );

  const produtosPcpFiltrados = useMemo(() => {
    const base = produtosFiltrados;
    if (!showOnlyPcpSavedInPcp) {
      return base;
    }

    return base.filter((produto) => isProdutoPcpMarked(produto));
  }, [isProdutoPcpMarked, produtosFiltrados, showOnlyPcpSavedInPcp]);

  const totalSuspensos = useMemo(
    () => produtos.filter((p) => p.suspenso === true).length,
    [produtos]
  );

  const pcpMarkedProdutos = useMemo(
    () => produtosComClassificacao.filter((produto) => isProdutoPcpMarked(produto)),
    [isProdutoPcpMarked, produtosComClassificacao]
  );

  const pcpMarkedTotals = useMemo(() => ({
    totalSkus: pcpMarkedProdutos.length,
    totalQtd: pcpMarkedProdutos.reduce((sum, produto) => sum + produto.qt_liquida, 0),
    totalValor: pcpMarkedProdutos.reduce((sum, produto) => sum + produto.vl_total, 0)
  }), [pcpMarkedProdutos]);

  const pcpMarkedScenarioItems = useMemo<ScenarioItem[]>(() => (
    pcpMarkedProdutos.map((produto) => ({
      cd_produto: Number(produto.cd_produto),
      referencia: produto.referencia || '',
      grupo: produto.grupo || '-',
      descricao: produto.descricao || '',
      cor: produto.cor || '',
      tam: produto.tam || '',
      qt_liquida: Number(produto.qt_liquida || 0),
      vl_total: Number(produto.vl_total || 0),
      percent_individual: Number(produto.percent_individual || 0),
      percent_acumulado: Number(produto.percent_acumulado || 0),
      classificacao: produto.classificacao || '-',
      suspenso: Boolean(produto.suspenso)
    }))
  ), [pcpMarkedProdutos]);

  const currentPcpScenarioSummary = useMemo<ScenarioSummary>(() => ({
    totalSkus: pcpMarkedTotals.totalSkus,
    totalQtd: pcpMarkedTotals.totalQtd,
    totalValor: pcpMarkedTotals.totalValor,
    referencias: new Set(pcpMarkedProdutos.map((produto) => produto.referencia).filter(Boolean)).size,
    representatividadePercent: metricas && metricas.totalValor > 0 ? (pcpMarkedTotals.totalValor / metricas.totalValor) * 100 : 0
  }), [metricas, pcpMarkedProdutos, pcpMarkedTotals]);

  const produtosDiretoriaFiltrados = useMemo(() => {
    // Diretoria precisa enxergar tudo que o PCP marcou, mesmo fora do corte Classe C.
    let base = produtosComClassificacao.filter(
      (produto) => produto.percent_acumulado > limiteClasseC || pcpAnalyzedReferences.has(produto.referencia)
    );

    if (!showApprovedInDiretoria) {
      base = base.filter((produto) => !approvedReferences.has(produto.referencia));
    }

    if (showOnlyPcpReviewed) {
      base = base.filter((produto) => isProdutoPcpMarked(produto));
    }

    return base;
  }, [approvedReferences, isProdutoPcpMarked, limiteClasseC, pcpAnalyzedReferences, produtosComClassificacao, showApprovedInDiretoria, showOnlyPcpReviewed]);

  const buildReferenciaSnapshot = useCallback((referenciaProdutos: Produto[]) => {
    const grupo = referenciaProdutos[0]?.grupo || '-';
    const totalSkus = referenciaProdutos.length;
    const totalQtd = referenciaProdutos.reduce((sum, item) => sum + item.qt_liquida, 0);
    const totalValor = referenciaProdutos.reduce((sum, item) => sum + item.vl_total, 0);
    const classeA = referenciaProdutos.filter((item) => item.classificacao === 'A').length;
    const classeB = referenciaProdutos.filter((item) => item.classificacao === 'B').length;
    const classeC = referenciaProdutos.filter((item) => item.classificacao === 'C').length;

    return {
      analise: {
        ano,
        aplicarFiltro,
        empresasSelecionadas: selectedEmpresas,
        limiteClasseC
      },
      referenciaResumo: {
        grupo,
        totalSkus,
        totalQtd,
        totalValor,
        classeA,
        classeB,
        classeC
      },
      itensReferencia: referenciaProdutos.map((item) => ({
        cd_produto: item.cd_produto,
        descricao: item.descricao,
        cor: item.cor,
        tam: item.tam,
        qt_liquida: item.qt_liquida,
        vl_total: item.vl_total,
        percent_individual: item.percent_individual,
        percent_acumulado: item.percent_acumulado,
        classificacao: item.classificacao,
        suspenso: Boolean(item.suspenso)
      }))
    };
  }, [ano, aplicarFiltro, selectedEmpresas, limiteClasseC]);

  const saveFlag = useCallback(async (payload: Partial<RetiradaFlag>) => {
    await flagsApi.create(payload);
  }, []);

  const removeFlag = useCallback(async (id: string) => {
    await flagsApi.remove(id);
  }, []);

  const updateFlagStatus = useCallback(async (id: string, status: FlagStatus) => {
    await flagsApi.update(id, { status });
    await carregarFlags();
  }, [carregarFlags]);

  const syncSelections = useCallback(async ({
    stage,
    action,
    referencia,
    referenciaProdutos,
    selectedReference,
    selectedColors,
    selectedSkuIds
  }: SaveSelectionsPayload) => {
    console.log('[SYNC] Início syncSelections:', {
      stage,
      action,
      referencia,
      selectedReference,
      selectedColorsCount: selectedColors.length,
      selectedSkuIdsCount: selectedSkuIds.length,
      selectedSkuIds: selectedSkuIds,
      selectedSkuIdsTypes: selectedSkuIds.map(id => typeof id)
    });

    const flagsDaEtapa = activeFlags.filter(
      (flag) => flag.stage === stage && flag.referencia === referencia
    );
    const pcpFlagsReferencia = activeFlags.filter(
      (flag) => flag.stage === 'PCP' && flag.referencia === referencia
    );
    const referenciaFlag = flagsDaEtapa.find((flag) => flag.targetType === 'REFERENCIA') || null;
    const colorFlags = flagsDaEtapa.filter((flag) => flag.targetType === 'COR');
    const skuFlags = flagsDaEtapa.filter((flag) => flag.targetType === 'SKU');
    const baseSnapshot = buildReferenciaSnapshot(referenciaProdutos);
    const statusToPersist: FlagStatus = action === 'approve' ? 'aprovado' : 'pendente_diretoria';

    const desiredColors = new Set(selectedColors);
    const desiredSkus = new Set(selectedSkuIds.map((skuId) => Number(skuId)));

    console.log('[SYNC] Flags existentes SKU:', skuFlags.map(f => ({ id: f.id, cd_produto: f.cd_produto, type: typeof f.cd_produto })));
    console.log('[SYNC] Desired SKUs (Set):', Array.from(desiredSkus));

    const selectionFromFlags = (flagsToRead: RetiradaFlag[]) => ({
      reference: flagsToRead.some((flag) => flag.targetType === 'REFERENCIA'),
      colors: new Set(flagsToRead.filter((flag) => flag.targetType === 'COR' && flag.cor).map((flag) => flag.cor as string)),
      skus: new Set(flagsToRead.filter((flag) => flag.targetType === 'SKU' && flag.cd_produto !== null).map((flag) => Number(flag.cd_produto)))
    });

    const currentSelection = {
      reference: selectedReference,
      colors: desiredColors,
      skus: desiredSkus
    };

    const sameSelection = (a: { reference: boolean; colors: Set<string>; skus: Set<number>; }, b: { reference: boolean; colors: Set<string>; skus: Set<number>; }) => {
      if (a.reference !== b.reference || a.colors.size !== b.colors.size || a.skus.size !== b.skus.size) {
        return false;
      }
      for (const value of Array.from(a.colors)) {
        if (!b.colors.has(value)) return false;
      }
      for (const value of Array.from(a.skus)) {
        if (!b.skus.has(value)) return false;
      }
      return true;
    };

    if (stage === 'DIRETORIA' && action === 'reject') {
      const allReferenceFlags = activeFlags.filter((flag) => flag.referencia === referencia);
      await Promise.all(allReferenceFlags.map((flag) => flagsApi.update(flag.id, { status: 'rejeitado' })));
      await carregarFlags();
      return;
    }

    if (stage === 'DIRETORIA' && action === 'approve') {
      const hasExistingDiretoria = flagsDaEtapa.length > 0;
      const sourceSelection = hasExistingDiretoria ? selectionFromFlags(flagsDaEtapa) : selectionFromFlags(pcpFlagsReferencia);

      if (sameSelection(sourceSelection, currentSelection)) {
        const sourceFlags = hasExistingDiretoria ? flagsDaEtapa : pcpFlagsReferencia;
        await Promise.all(sourceFlags.map((flag) => flagsApi.update(flag.id, { status: 'aprovado' })));
        await carregarFlags();
        return;
      }
    }

    const removals: Promise<void>[] = [];
    const creations: Promise<void>[] = [];

    if (referenciaFlag && !selectedReference) {
      removals.push(removeFlag(referenciaFlag.id));
    }

    colorFlags.forEach((flag) => {
      if (!desiredColors.has(flag.cor || '')) {
        removals.push(removeFlag(flag.id));
      }
    });

    skuFlags.forEach((flag) => {
      const flagSkuId = flag.cd_produto === null || flag.cd_produto === undefined
        ? -1
        : Number(flag.cd_produto);
      if (!desiredSkus.has(flagSkuId)) {
        console.log('[SYNC] Removendo flag SKU:', { id: flag.id, cd_produto: flag.cd_produto, flagSkuId, hasInDesired: desiredSkus.has(flagSkuId) });
        removals.push(removeFlag(flag.id));
      } else {
        console.log('[SYNC] Mantendo flag SKU:', { id: flag.id, cd_produto: flag.cd_produto });
      }
    });

    console.log('[SYNC] Total de remoções:', removals.length);
    await Promise.all(removals);

    if (selectedReference) {
      creations.push(
        saveFlag({
          targetType: 'REFERENCIA',
          stage,
          referencia,
          status: statusToPersist,
          snapshot: {
            ...baseSnapshot,
            alvo: {
              tipo: 'REFERENCIA',
              descricao: `Referencia ${referencia}`
            }
          }
        })
      );
    }

    selectedColors.forEach((cor) => {
      const corProdutos = referenciaProdutos.filter((item) => (item.cor || '-') === cor);
      creations.push(
        saveFlag({
          targetType: 'COR',
          stage,
          referencia,
          cor,
          status: statusToPersist,
          snapshot: {
            ...baseSnapshot,
            alvo: {
              tipo: 'COR',
              cor,
              totalSkus: corProdutos.length,
              totalQtd: corProdutos.reduce((sum, item) => sum + item.qt_liquida, 0),
              totalValor: corProdutos.reduce((sum, item) => sum + item.vl_total, 0),
              candidatosClasseC: corProdutos.filter((item) => item.classificacao === 'C').length
            }
          }
        })
      );
    });

    selectedSkuIds.forEach((skuId) => {
      const skuIdNumber = Number(skuId);
      const produto = referenciaProdutos.find((item) => Number(item.cd_produto) === skuIdNumber);
      if (!produto) {
        console.log('[SYNC] SKU não encontrado em referenciaProdutos:', skuId);
        return;
      }

      console.log('[SYNC] Criando flag SKU:', { cd_produto: skuIdNumber, type: typeof skuIdNumber });
      creations.push(
        saveFlag({
          targetType: 'SKU',
          stage,
          referencia,
          cor: produto.cor,
          cd_produto: Number(produto.cd_produto),
          status: statusToPersist,
          snapshot: {
            ...baseSnapshot,
            alvo: {
              tipo: 'SKU',
              cd_produto: Number(produto.cd_produto),
              descricao: produto.descricao,
              cor: produto.cor,
              tam: produto.tam,
              qt_liquida: produto.qt_liquida,
              vl_total: produto.vl_total,
              percent_individual: produto.percent_individual,
              percent_acumulado: produto.percent_acumulado,
              classificacao: produto.classificacao,
              suspenso: Boolean(produto.suspenso)
            }
          }
        })
      );
    });

    console.log('[SYNC] Total de criações:', creations.length);
    await Promise.all(creations);
    console.log('[SYNC] Recarregando flags do backend...');
    await carregarFlags();
    console.log('[SYNC] Concluído');
  }, [activeFlags, buildReferenciaSnapshot, carregarFlags, removeFlag, saveFlag]);

  const clearPcpReferencia = useCallback(async (referencia: string) => {
    setClearingPcp(true);
    const pcpFlagsDaReferencia = activeFlags.filter(
      (flag) => flag.stage === 'PCP' && flag.referencia === referencia
    );

    try {
      for (const flag of pcpFlagsDaReferencia) {
        await removeFlag(flag.id);
      }
      await carregarFlags();
    } finally {
      setClearingPcp(false);
    }
  }, [activeFlags, carregarFlags, removeFlag]);

  const clearAllPcpFlags = useCallback(async () => {
    setClearingPcp(true);
    const referenciasAlvo = showOnlyPcpSavedInPcp
      ? new Set(produtosPcpFiltrados.map((produto) => produto.referencia))
      : null;

    const pcpFlagsParaRemover = activeFlags.filter((flag) => {
      if (flag.stage !== 'PCP') return false;
      if (!referenciasAlvo) return true;
      return Boolean(flag.referencia && referenciasAlvo.has(flag.referencia));
    });

    try {
      for (const flag of pcpFlagsParaRemover) {
        await removeFlag(flag.id);
      }
      await carregarFlags();
    } finally {
      setClearingPcp(false);
    }
  }, [activeFlags, carregarFlags, produtosPcpFiltrados, removeFlag, showOnlyPcpSavedInPcp]);

  const clearAllDiretoriaFlags = useCallback(async () => {
    setClearingDiretoria(true);
    const referenciasAlvo = new Set(produtosDiretoriaFiltrados.map((produto) => produto.referencia));
    const diretoriaFlagsParaRemover = activeFlags.filter((flag) => {
      if (flag.stage !== 'DIRETORIA') return false;
      return Boolean(flag.referencia && referenciasAlvo.has(flag.referencia));
    });

    try {
      for (const flag of diretoriaFlagsParaRemover) {
        await removeFlag(flag.id);
      }
      await carregarFlags();
    } finally {
      setClearingDiretoria(false);
    }
  }, [activeFlags, carregarFlags, produtosDiretoriaFiltrados, removeFlag]);

  const approveAllDiretoriaVisible = useCallback(async () => {
    setApprovingAllDiretoria(true);

    const referenciasAlvo = new Set(
      produtosDiretoriaFiltrados
        .map((produto) => produto.referencia)
        .filter((referencia): referencia is string => Boolean(referencia))
    );

    const updates: Promise<unknown>[] = [];

    referenciasAlvo.forEach((referencia) => {
      const diretoriaDaReferencia = activeFlags.filter(
        (flag) =>
          flag.referencia === referencia &&
          flag.stage === 'DIRETORIA' &&
          flag.status !== 'aprovado'
      );

      const pcpDaReferencia = activeFlags.filter(
        (flag) =>
          flag.referencia === referencia &&
          flag.stage === 'PCP' &&
          flag.status !== 'aprovado'
      );

      const sourceFlags = diretoriaDaReferencia.length > 0 ? diretoriaDaReferencia : pcpDaReferencia;
      sourceFlags.forEach((flag) => {
        updates.push(flagsApi.update(flag.id, { status: 'aprovado' }));
      });
    });

    try {
      if (updates.length > 0) {
        await Promise.all(updates);
      }
      await carregarFlags();
    } finally {
      setApprovingAllDiretoria(false);
    }
  }, [activeFlags, carregarFlags, produtosDiretoriaFiltrados]);

  const hasDiretoriaBulkApprovalTarget = useMemo(() => {
    const referenciasAlvo = new Set(
      produtosDiretoriaFiltrados
        .map((produto) => produto.referencia)
        .filter((referencia): referencia is string => Boolean(referencia))
    );

    for (const referencia of Array.from(referenciasAlvo)) {
      const hasDiretoriaPendente = activeFlags.some(
        (flag) =>
          flag.referencia === referencia &&
          flag.stage === 'DIRETORIA' &&
          flag.status !== 'aprovado'
      );
      const hasPcpPendente = activeFlags.some(
        (flag) =>
          flag.referencia === referencia &&
          flag.stage === 'PCP' &&
          flag.status !== 'aprovado'
      );
      if (hasDiretoriaPendente || hasPcpPendente) {
        return true;
      }
    }
    return false;
  }, [activeFlags, produtosDiretoriaFiltrados]);

  const undoDiretoriaApproval = useCallback(async (referencia: string) => {
    const approvedFlagsDaReferencia = activeFlags.filter(
      (flag) => flag.referencia === referencia && flag.status === 'aprovado'
    );

    await Promise.all(
      approvedFlagsDaReferencia.map((flag) =>
        flagsApi.update(flag.id, { status: 'pendente_diretoria' })
      )
    );

    await carregarFlags();
  }, [activeFlags, carregarFlags]);

  const findExactFlag = useCallback((targetType: FlagTargetType, payload: { referencia?: string | null; cor?: string | null; cd_produto?: number | null; }) => {
    return activeFlags.find((flag) =>
      flag.targetType === targetType &&
      (flag.referencia || null) === (payload.referencia || null) &&
      (flag.cor || null) === (payload.cor || null) &&
      (flag.cd_produto ?? null) === (payload.cd_produto ?? null)
    ) || null;
  }, [activeFlags]);

  const getCoverageForProduto = useCallback((produto: Produto) => {
    const referenciaFlag = findExactFlag('REFERENCIA', { referencia: produto.referencia });
    if (referenciaFlag) return { type: 'REFERENCIA' as const, flag: referenciaFlag };

    const corFlag = findExactFlag('COR', { referencia: produto.referencia, cor: produto.cor });
    if (corFlag) return { type: 'COR' as const, flag: corFlag };

    const skuFlag = findExactFlag('SKU', {
      cd_produto: produto.cd_produto,
      referencia: produto.referencia,
      cor: produto.cor
    });
    if (skuFlag) return { type: 'SKU' as const, flag: skuFlag };

    return null;
  }, [findExactFlag]);

  const renderCommonFilters = () => (
    <>
      <FilterPanel
        ano={ano}
        setAno={setAno}
        aplicarFiltro={aplicarFiltro}
        setAplicarFiltro={setAplicarFiltro}
        selectedEmpresas={selectedEmpresas}
        setSelectedEmpresas={setSelectedEmpresas}
        onRefresh={carregarDados}
        loading={loading}
        onEmpresasInitialized={handleEmpresasInitialized}
      />

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
    </>
  );

  const exportRetiradaFinalCsv = useCallback(() => {
    if (retiradaFinalRows.length === 0) {
      return;
    }

    const headers = [
      'origem',
      'tipo_marcacao',
      'referencia',
      'grupo',
      'cd_produto',
      'descricao',
      'cor',
      'tam',
      'qt_liquida',
      'vl_total',
      'percent_individual',
      'percent_acumulado',
      'classificacao',
      'suspenso',
      'aprovado_em'
    ];

    const escapeCsv = (value: string | number | boolean) => {
      const text = String(value ?? '');
      if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const lines = [
      headers.join(','),
      ...retiradaFinalRows.map((row) => [
        row.origem,
        row.tipoMarcacao,
        row.referencia,
        row.grupo,
        row.cd_produto,
        row.descricao,
        row.cor,
        row.tam,
        row.qt_liquida,
        row.vl_total.toFixed(2),
        row.percent_individual.toFixed(2),
        row.percent_acumulado.toFixed(2),
        row.classificacao,
        row.suspenso ? 'SIM' : 'NAO',
        new Date(row.aprovadoEm).toLocaleString('pt-BR')
      ].map(escapeCsv).join(','))
    ];

    const blob = new Blob(["\uFEFF" + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `retirada-final-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [retiradaFinalRows]);

  const saveCurrentPcpScenario = useCallback(async (nome: string) => {
    await cenariosApi.create({
      nome,
      origem: 'pcp',
      ano,
      summary: currentPcpScenarioSummary,
      items: pcpMarkedScenarioItems
    });
    await carregarCenarios();
  }, [ano, carregarCenarios, currentPcpScenarioSummary, pcpMarkedScenarioItems]);

  const importScenario = useCallback(async ({
    nome,
    origem,
    summary,
    items
  }: {
    nome: string;
    origem: string;
    summary: ScenarioSummary;
    items: ScenarioItem[];
  }) => {
    await cenariosApi.create({
      nome,
      origem,
      ano,
      summary,
      items
    });
    await carregarCenarios();
  }, [ano, carregarCenarios]);

  const deleteScenario = useCallback(async (id: string) => {
    await cenariosApi.remove(id);
    await carregarCenarios();
  }, [carregarCenarios]);

  const renderRepresentatividade = () => (
    <>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analise PCP</h1>
        <p className="text-sm text-gray-500 mt-1">
          O PCP marca recomendacoes por referencia, cor ou SKU. As referencias ja analisadas ficam com badge PCP.
        </p>
      </div>

      {renderCommonFilters()}

      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between gap-4">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={showOnlyPcpSavedInPcp}
              onChange={(e) => setShowOnlyPcpSavedInPcp(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
            />
            Ver somente SKUs marcados pelo PCP
          </label>
        <button
          onClick={clearAllPcpFlags}
          disabled={pcpFlags.length === 0 || clearingPcp}
          className="px-3 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {clearingPcp ? 'Desfazendo...' : 'Desfazer tudo do PCP'}
        </button>
      </div>

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

      {!loading && !error && metricas && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <MetricCard compact title="SKUs no corte" value={pcpVisibleSkuCount.toLocaleString('pt-BR')} subtitle="Apos filtros da tabela" color="blue" icon="box" />
            <MetricCard compact title="SKUs (80% valor)" value={metricas.skus80Percent.toLocaleString('pt-BR')} subtitle="Concentracao principal" color="green" icon="chart" />
            <MetricCard compact title="Total Qtd" value={metricas.totalVendido.toLocaleString('pt-BR')} subtitle="Unidades" color="blue" icon="box" />
            <MetricCard compact title="Total Valor" value={`R$ ${(metricas.totalValor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} subtitle="Faturamento" color="green" icon="money" />
            <MetricCard compact title="Qtd Marcada" value={pcpMarkedTotals.totalQtd.toLocaleString('pt-BR')} subtitle={`${pcpMarkedTotals.totalSkus.toLocaleString('pt-BR')} SKUs marcados`} color="red" icon="box" />
            <MetricCard compact title="Valor Marcado" value={`R$ ${pcpMarkedTotals.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} subtitle="Valor total dos SKUs marcados" color="red" icon="money" />
            <MetricCard compact title="Refs PCP" value={pcpAnalyzedReferences.size.toLocaleString('pt-BR')} subtitle="Ja analisadas pelo PCP" color="red" icon="warning" />
            <MetricCard compact title="SKUs Suspensos" value={totalSuspensos.toLocaleString('pt-BR')} subtitle="Na base carregada" color="blue" icon="warning" />
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Perda Potencial por Corte Classe C</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {impactoCortes.map((corte) => (
                <MetricCard
                  key={corte.limite}
                  title={`Corte ${corte.limite}%`}
                  value={`R$ ${corte.valorPerdido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  subtitle={`${corte.percentualPerdido.toFixed(2)}% do faturamento | ${corte.skus} SKUs`}
                  color="red"
                  icon="money"
                />
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">
              Detalhamento para Analise PCP
              <span className="text-sm font-normal text-gray-500 ml-2">
                (clique na referencia para abrir o modal)
              </span>
            </h2>
            <ProductTable
              produtos={produtosPcpFiltrados}
              onSelectReferencia={(ref) => setSelectedReferencia(ref)}
              limiteClasseC={limiteClasseC}
              analyzedReferences={pcpAnalyzedReferences}
              isPcpMarked={isProdutoPcpMarked}
              onVisibleCountChange={setPcpVisibleSkuCount}
              diretoriaReferences={diretoriaSavedReferences}
              approvedReferences={approvedReferences}
              onQuickClearReferencia={clearPcpReferencia}
            />
          </div>
        </>
      )}
    </>
  );

  const renderDiretoria = () => (
    <>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Diretoria</h1>
        <p className="text-sm text-gray-500 mt-1">
          A diretoria revisa o que o PCP marcou, pode incluir novos itens e aprovar o que vai para retirada final.
        </p>
      </div>

      {renderCommonFilters()}

      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={showOnlyPcpReviewed}
              onChange={(e) => setShowOnlyPcpReviewed(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
            />
            Ver somente SKUs marcados pelo PCP
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={showApprovedInDiretoria}
              onChange={(e) => setShowApprovedInDiretoria(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
            />
            Mostrar aprovados
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={approveAllDiretoriaVisible}
            disabled={!hasDiretoriaBulkApprovalTarget || approvingAllDiretoria || clearingDiretoria}
            className="px-3 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {approvingAllDiretoria ? 'Aprovando...' : 'Aprovar todos'}
          </button>
          <button
            onClick={clearAllDiretoriaFlags}
            disabled={diretoriaFlags.length === 0 || clearingDiretoria || approvingAllDiretoria}
            className="px-3 py-2 bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {clearingDiretoria ? 'Desfazendo...' : 'Desfazer tudo da diretoria'}
          </button>
        </div>
      </div>

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard title="SKUs no corte" value={diretoriaVisibleSkuCount.toLocaleString('pt-BR')} subtitle="Apos filtros da tabela" color="red" icon="warning" />
            <MetricCard title="Refs PCP" value={pcpAnalyzedReferences.size.toLocaleString('pt-BR')} subtitle="Base vinda do PCP" color="blue" icon="box" />
            <MetricCard title="Itens Diretoria" value={diretoriaFlags.length.toLocaleString('pt-BR')} subtitle="Ja avaliados pela diretoria" color="green" icon="chart" />
            <MetricCard title="Aprovados" value={approvedFlags.length.toLocaleString('pt-BR')} subtitle="Ja enviados para retirada" color="green" icon="money" />
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">
              Analise da Diretoria
              <span className="text-sm font-normal text-gray-500 ml-2">
                (a diretoria abre a referencia, ajusta e aprova)
              </span>
            </h2>
            <ProductTable
              produtos={produtosDiretoriaFiltrados}
              onSelectReferencia={(ref) => setSelectedReferencia(ref)}
              limiteClasseC={limiteClasseC}
              analyzedReferences={pcpAnalyzedReferences}
              isPcpMarked={isProdutoPcpMarked}
              onVisibleCountChange={setDiretoriaVisibleSkuCount}
              diretoriaReferences={diretoriaSavedReferences}
              approvedReferences={approvedReferences}
            />
          </div>
        </>
      )}
    </>
  );

  const renderRetiradaFinal = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Retirada Final</h1>
        <p className="text-sm text-gray-500 mt-1">
          Itens aprovados pela diretoria ou marcados diretamente por ela para sair de linha.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard compact title="Linhas SKU" value={retiradaFinalRows.length.toLocaleString('pt-BR')} subtitle="Lista final operacional" color="red" icon="warning" />
        <MetricCard compact title="Referencias" value={new Set(retiradaFinalRows.map((row) => row.referencia).filter(Boolean)).size.toLocaleString('pt-BR')} subtitle="Com aprovacao final" color="blue" icon="box" />
        <MetricCard compact title="Origem PCP" value={retiradaFinalRows.filter((row) => row.origem === 'PCP').length.toLocaleString('pt-BR')} subtitle="Linhas vindas do PCP" color="blue" icon="chart" />
        <MetricCard compact title="Origem Diretoria" value={retiradaFinalRows.filter((row) => row.origem === 'DIRETORIA').length.toLocaleString('pt-BR')} subtitle="Linhas definidas pela diretoria" color="green" icon="money" />
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-800">Lista Final por SKU</h3>
            <p className="text-sm text-gray-500 mt-1">Cada linha representa um SKU que deve sair de linha.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {flagsLoading ? 'Carregando...' : `${retiradaFinalRows.length} linha(s)`}
            </span>
            <button
              onClick={exportRetiradaFinalCsv}
              disabled={retiradaFinalRows.length === 0}
              className="px-3 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Exportar CSV
            </button>
          </div>
        </div>

        {retiradaFinalRows.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum item aprovado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Origem</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Marcacao</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Referencia</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grupo</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Descricao</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cor</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tam</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qtd</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor R$</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">% Ind</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">% Acum</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Classe</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Suspenso</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Aprovado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {retiradaFinalRows.map((row) => (
                  <tr key={row.uniqueKey}>
                    <td className="px-3 py-2 text-sm text-gray-700">{row.origem}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{row.tipoMarcacao}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{row.referencia}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{row.grupo}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{row.cd_produto}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{row.descricao}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{row.cor}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{row.tam}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 text-right">{row.qt_liquida.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 text-right">{row.vl_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 text-right">{row.percent_individual.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-sm text-gray-700 text-right">{row.percent_acumulado.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-sm text-center text-gray-700">{row.classificacao}</td>
                    <td className="px-3 py-2 text-sm text-center text-gray-700">{row.suspenso ? 'SIM' : 'NAO'}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{new Date(row.aprovadoEm).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderLoadingOrError = () => {
    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-medium">Erro ao carregar dados</p>
          <p className="text-sm mt-1">{error}</p>
          <p className="text-sm mt-2">Certifique-se de que o backend esta rodando em http://localhost:3001</p>
        </div>
      );
    }

    if (loading && !metricas) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center max-w-md">
            <svg className="animate-spin h-10 w-10 text-blue-600 mx-auto" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="mt-4 text-gray-700 font-medium">Carregando dados...</p>
            <p className="text-sm text-gray-500 mt-1">Carregando representatividade...</p>
          </div>
        </div>
      );
    }

    return null;
  };

  const currentModalMode: WorkflowStage | null =
    activeSection === 'representatividade' ? 'PCP' :
    activeSection === 'aprovar-retirada' ? 'DIRETORIA' :
    null;

  return (
    <main className="min-h-screen p-6 bg-gray-50">
      <div className="space-y-6">
        {renderLoadingOrError()}
        {!error && activeSection === 'representatividade' && renderRepresentatividade()}
        {!error && activeSection === 'aprovar-retirada' && renderDiretoria()}
        {!error && activeSection === 'retirada-final' && renderRetiradaFinal()}
        {!error && activeSection === 'cenarios' && (
          <ScenarioComparison
            ano={ano}
            cenarios={cenarios}
            loading={cenariosLoading}
            onSaveCurrent={saveCurrentPcpScenario}
            onImportScenario={importScenario}
            onDeleteScenario={deleteScenario}
            currentScenarioSummary={currentPcpScenarioSummary}
            baseTotalValor={metricas?.totalValor || 0}
          />
        )}
        {!error && activeSection === 'comportamento-suspensao' && (
          <AnaliseSuspensao ano={ano} selectedEmpresas={selectedEmpresas} />
        )}
        {!error && activeSection === 'pareto' && (
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">Analise Pareto</h1>
            <p className="text-sm text-gray-500 mt-2">Essa area ainda nao foi montada.</p>
          </div>
        )}
        {!error && activeSection === 'configuracoes' && (
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">Configuracoes</h1>
            <p className="text-sm text-gray-500 mt-2">Essa area ainda nao foi montada.</p>
          </div>
        )}

        {selectedReferencia && currentModalMode && (
          <ReferenciaModalLocal
            mode={currentModalMode}
            referencia={selectedReferencia}
            produtos={produtosComClassificacao}
            flags={activeFlags}
            findExactFlag={findExactFlag}
            getCoverageForProduto={getCoverageForProduto}
            onSaveSelections={syncSelections}
            onUndoApproval={currentModalMode === 'DIRETORIA' ? undoDiretoriaApproval : undefined}
            onClose={() => setSelectedReferencia(null)}
          />
        )}
      </div>
    </main>
  );
}
