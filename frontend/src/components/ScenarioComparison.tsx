'use client';

import { useEffect, useMemo, useState } from 'react';
import MetricCard from './MetricCard';
import { Scenario, ScenarioItem, ScenarioSummary } from '@/services/api';

type ScenarioPayload = {
  nome: string;
  origem: string;
  summary: ScenarioSummary;
  items: ScenarioItem[];
};

interface ScenarioComparisonProps {
  ano: number;
  cenarios: Scenario[];
  loading: boolean;
  onSaveCurrent: (nome: string) => Promise<void>;
  onImportScenario: (payload: ScenarioPayload) => Promise<void>;
  onDeleteScenario: (id: string) => Promise<void>;
  currentScenarioSummary: ScenarioSummary;
  baseTotalValor: number;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function toNumber(value: string) {
  const normalized = String(value || '').trim().replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value: string) {
  const text = String(value || '').trim().toUpperCase();
  return text === 'SIM' || text === 'TRUE' || text === '1';
}

function buildSummary(items: ScenarioItem[], baseTotalValor: number): ScenarioSummary {
  const totalQtd = items.reduce((sum, item) => sum + item.qt_liquida, 0);
  const totalValor = items.reduce((sum, item) => sum + item.vl_total, 0);
  const referencias = new Set(items.map((item) => item.referencia).filter(Boolean)).size;

  return {
    totalSkus: items.length,
    totalQtd,
    totalValor,
    referencias,
    representatividadePercent: baseTotalValor > 0 ? (totalValor / baseTotalValor) * 100 : 0
  };
}

export default function ScenarioComparison({
  ano,
  cenarios,
  loading,
  onSaveCurrent,
  onImportScenario,
  onDeleteScenario,
  currentScenarioSummary,
  baseTotalValor
}: ScenarioComparisonProps) {
  const [scenarioName, setScenarioName] = useState('');
  const [selectedBaseId, setSelectedBaseId] = useState('');
  const [selectedCompareId, setSelectedCompareId] = useState('');
  const [busyAction, setBusyAction] = useState<'save' | 'import' | 'delete' | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (cenarios.length === 0) {
      setSelectedBaseId('');
      setSelectedCompareId('');
      return;
    }

    if (!selectedBaseId || !cenarios.some((cenario) => cenario.id === selectedBaseId)) {
      setSelectedBaseId(cenarios[0].id);
    }

    if (!selectedCompareId || !cenarios.some((cenario) => cenario.id === selectedCompareId)) {
      setSelectedCompareId(cenarios[1]?.id || cenarios[0].id);
    }
  }, [cenarios, selectedBaseId, selectedCompareId]);

  const baseScenario = useMemo(
    () => cenarios.find((cenario) => cenario.id === selectedBaseId) || null,
    [cenarios, selectedBaseId]
  );

  const compareScenario = useMemo(
    () => cenarios.find((cenario) => cenario.id === selectedCompareId) || null,
    [cenarios, selectedCompareId]
  );

  const comparison = useMemo(() => {
    if (!baseScenario || !compareScenario) {
      return null;
    }

    const baseSkus = new Set(baseScenario.items.map((item) => item.cd_produto));
    const compareSkus = new Set(compareScenario.items.map((item) => item.cd_produto));
    const added = Array.from(compareSkus).filter((sku) => !baseSkus.has(sku)).length;
    const removed = Array.from(baseSkus).filter((sku) => !compareSkus.has(sku)).length;

    return {
      deltaSkus: compareScenario.summary.totalSkus - baseScenario.summary.totalSkus,
      deltaQtd: compareScenario.summary.totalQtd - baseScenario.summary.totalQtd,
      deltaValor: compareScenario.summary.totalValor - baseScenario.summary.totalValor,
      deltaRepresentatividade: compareScenario.summary.representatividadePercent - baseScenario.summary.representatividadePercent,
      added,
      removed
    };
  }, [baseScenario, compareScenario]);

  const handleSaveCurrent = async () => {
    const nome = scenarioName.trim() || `Simulacao ${new Date().toLocaleString('pt-BR')}`;
    setBusyAction('save');
    try {
      await onSaveCurrent(nome);
      setScenarioName('');
      setStatusType('success');
      setStatusMessage(`Cenario "${nome}" salvo com sucesso.`);
    } catch (error: any) {
      setStatusType('error');
      setStatusMessage(error?.message || 'Erro ao salvar cenario.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;

    setBusyAction('import');
    try {
      const text = await file.text();
      const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length < 2) {
        throw new Error('CSV vazio ou sem linhas de dados');
      }

      const headers = parseCsvLine(lines[0]).map((header) => header.trim());
      const getIndex = (column: string) => headers.indexOf(column);
      const requiredColumns = ['referencia', 'grupo', 'cd_produto', 'descricao', 'cor', 'tam', 'qt_liquida', 'vl_total', 'percent_individual', 'percent_acumulado', 'classificacao', 'suspenso'];

      requiredColumns.forEach((column) => {
        if (getIndex(column) === -1) {
          throw new Error(`Coluna obrigatoria ausente no CSV: ${column}`);
        }
      });

      const items: ScenarioItem[] = lines.slice(1).map((line) => {
        const columns = parseCsvLine(line);
        return {
          cd_produto: toNumber(columns[getIndex('cd_produto')]),
          referencia: columns[getIndex('referencia')] || '',
          grupo: columns[getIndex('grupo')] || '-',
          descricao: columns[getIndex('descricao')] || '',
          cor: columns[getIndex('cor')] || '',
          tam: columns[getIndex('tam')] || '',
          qt_liquida: toNumber(columns[getIndex('qt_liquida')]),
          vl_total: toNumber(columns[getIndex('vl_total')]),
          percent_individual: toNumber(columns[getIndex('percent_individual')]),
          percent_acumulado: toNumber(columns[getIndex('percent_acumulado')]),
          classificacao: columns[getIndex('classificacao')] || '-',
          suspenso: toBoolean(columns[getIndex('suspenso')])
        };
      }).filter((item) => item.cd_produto > 0);

      const summary = buildSummary(items, baseTotalValor);
      await onImportScenario({
        nome: file.name.replace(/\.csv$/i, ''),
        origem: 'csv',
        summary,
        items
      });
      setStatusType('success');
      setStatusMessage(`CSV "${file.name}" importado com sucesso.`);
    } catch (error: any) {
      setStatusType('error');
      setStatusMessage(error?.message || 'Erro ao importar CSV.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteScenario = async (id: string) => {
    setBusyAction('delete');
    try {
      await onDeleteScenario(id);
      setStatusType('success');
      setStatusMessage('Cenario excluido com sucesso.');
    } catch (error: any) {
      setStatusType('error');
      setStatusMessage(error?.message || 'Erro ao excluir cenario.');
    } finally {
      setBusyAction(null);
    }
  };

  const renderScenarioCard = (label: string, scenario: Scenario | null) => {
    if (!scenario) {
      return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-xl border-2 border-dashed border-gray-300 shadow-sm">
          <p className="text-center text-sm text-gray-500">{label}: selecione um cenário</p>
        </div>
      );
    }

    const labelColors = {
      'Base': 'bg-blue-500',
      'Comparacao': 'bg-emerald-500'
    } as const;

    const bgGradient = label === 'Base'
      ? 'from-blue-50 to-blue-100'
      : 'from-emerald-50 to-emerald-100';

    return (
      <div className={`bg-gradient-to-br ${bgGradient} p-6 rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-200`}>
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className={`${labelColors[label as keyof typeof labelColors] || 'bg-gray-500'} text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide`}>
              {label}
            </span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-1">{scenario.nome}</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span className="px-2 py-0.5 bg-white rounded-md font-medium">{scenario.origem.toUpperCase()}</span>
            <span className="text-gray-400">•</span>
            <span>Ano {scenario.ano}</span>
            <span className="text-gray-400">•</span>
            <span>{new Date(scenario.createdAt).toLocaleString('pt-BR')}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
            <p className="text-xs font-semibold text-blue-600 uppercase mb-1">SKUs</p>
            <p className="text-2xl font-bold text-gray-900">{scenario.summary.totalSkus.toLocaleString('pt-BR')}</p>
          </div>

          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
            <p className="text-xs font-semibold text-green-600 uppercase mb-1">QTD</p>
            <p className="text-2xl font-bold text-gray-900">{scenario.summary.totalQtd.toLocaleString('pt-BR')}</p>
          </div>

          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 col-span-2 lg:col-span-1">
            <p className="text-xs font-semibold text-emerald-600 uppercase mb-1">Valor</p>
            <p className="text-xl font-bold text-gray-900">
              R$ {scenario.summary.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
            <p className="text-xs font-semibold text-rose-600 uppercase mb-1">Rep. Venda</p>
            <p className="text-2xl font-bold text-gray-900">{scenario.summary.representatividadePercent.toFixed(2)}%</p>
          </div>

          <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
            <p className="text-xs font-semibold text-red-600 uppercase mb-1">Referências</p>
            <p className="text-2xl font-bold text-gray-900">{scenario.summary.referencias.toLocaleString('pt-BR')}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cenarios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Salve simulacoes do PCP, importe CSVs exportados e compare duas situacoes lado a lado.
        </p>
      </div>

      {statusMessage && (
        <div className={`px-4 py-3 rounded-lg border text-sm ${
          statusType === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-rose-50 to-rose-100 p-5 rounded-xl border border-rose-200 shadow-md">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-rose-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                Salvar cenário atual
              </span>
            </div>
            <p className="text-sm text-gray-700">Usa os SKUs hoje marcados no PCP para o ano {ano}.</p>
          </div>
          <input
            type="text"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder="Ex.: Simulação 514 SKUs"
            className="w-full px-3 py-2.5 border-2 border-rose-200 rounded-lg focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 transition-all mb-3"
          />
          <button
            onClick={handleSaveCurrent}
            disabled={busyAction !== null}
            className="w-full px-4 py-2.5 bg-rose-600 text-white font-semibold rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {busyAction === 'save' ? 'Salvando...' : 'Salvar simulação atual'}
          </button>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-5 rounded-xl border border-indigo-200 shadow-md">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                Importar CSV
              </span>
            </div>
            <p className="text-sm text-gray-700">Importa um CSV no formato da exportação da retirada final.</p>
          </div>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void handleImportFile(e.target.files?.[0] || null)}
            disabled={busyAction !== null}
            className="block w-full text-sm text-gray-700 file:mr-4 file:px-4 file:py-2 file:border-0 file:rounded-lg file:bg-indigo-600 file:text-white file:font-semibold file:cursor-pointer hover:file:bg-indigo-700 file:transition-colors mb-3"
          />
          <p className="text-xs text-gray-600 bg-white/50 rounded-lg p-2">Os totais importados usam a base de representatividade carregada do ano selecionado.</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-5 rounded-xl border border-amber-200 shadow-md">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-amber-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                Resumo atual do PCP
              </span>
            </div>
            <p className="text-sm text-gray-700">Referência para o cenário que estiver aberto agora.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
              <p className="text-xs font-semibold text-blue-600 uppercase mb-1">SKUs</p>
              <p className="text-2xl font-bold text-gray-900">{currentScenarioSummary.totalSkus.toLocaleString('pt-BR')}</p>
            </div>

            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
              <p className="text-xs font-semibold text-green-600 uppercase mb-1">QTD</p>
              <p className="text-2xl font-bold text-gray-900">{currentScenarioSummary.totalQtd.toLocaleString('pt-BR')}</p>
            </div>

            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
              <p className="text-xs font-semibold text-emerald-600 uppercase mb-1">Valor</p>
              <p className="text-xl font-bold text-gray-900">
                R$ {currentScenarioSummary.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
              <p className="text-xs font-semibold text-rose-600 uppercase mb-1">Rep. Venda</p>
              <p className="text-2xl font-bold text-gray-900">{currentScenarioSummary.representatividadePercent.toFixed(2)}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">Simulacoes salvas</h3>
            <p className="text-sm text-gray-500 mt-1">{loading ? 'Carregando...' : `${cenarios.length} cenario(s) salvos`}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={selectedBaseId} onChange={(e) => setSelectedBaseId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm">
              {cenarios.map((cenario) => <option key={cenario.id} value={cenario.id}>Base: {cenario.nome}</option>)}
            </select>
            <select value={selectedCompareId} onChange={(e) => setSelectedCompareId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm">
              {cenarios.map((cenario) => <option key={cenario.id} value={cenario.id}>Comparar: {cenario.nome}</option>)}
            </select>
          </div>
        </div>

        {cenarios.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum cenario salvo ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Origem</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">SKUs</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qtd</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor R$</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Rep. Venda</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Criado em</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {cenarios.map((cenario) => (
                  <tr key={cenario.id}>
                    <td className="px-3 py-2 text-sm text-gray-700">{cenario.nome}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{cenario.origem.toUpperCase()}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 text-right">{cenario.summary.totalSkus.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 text-right">{cenario.summary.totalQtd.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 text-right">{cenario.summary.totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 text-right">{cenario.summary.representatividadePercent.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{new Date(cenario.createdAt).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => void handleDeleteScenario(cenario.id)}
                        disabled={busyAction !== null}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {renderScenarioCard('Base', baseScenario)}
        {renderScenarioCard('Comparacao', compareScenario)}
      </div>

      {comparison && (
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200 shadow-md">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                Delta entre cenários
              </span>
            </div>
            <p className="text-sm text-gray-700">
              Comparação de <span className="font-semibold">{baseScenario?.nome}</span> para <span className="font-semibold">{compareScenario?.nome}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className={`bg-white rounded-lg p-3 shadow-sm border-2 ${comparison.deltaSkus >= 0 ? 'border-green-300' : 'border-red-300'}`}>
              <p className={`text-xs font-semibold uppercase mb-1 ${comparison.deltaSkus >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Delta SKUs
              </p>
              <p className={`text-2xl font-bold ${comparison.deltaSkus >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {comparison.deltaSkus >= 0 ? '+' : ''}{comparison.deltaSkus.toLocaleString('pt-BR')}
              </p>
            </div>

            <div className={`bg-white rounded-lg p-3 shadow-sm border-2 ${comparison.deltaQtd >= 0 ? 'border-green-300' : 'border-red-300'}`}>
              <p className={`text-xs font-semibold uppercase mb-1 ${comparison.deltaQtd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Delta QTD
              </p>
              <p className={`text-2xl font-bold ${comparison.deltaQtd >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {comparison.deltaQtd >= 0 ? '+' : ''}{comparison.deltaQtd.toLocaleString('pt-BR')}
              </p>
            </div>

            <div className={`bg-white rounded-lg p-3 shadow-sm border-2 ${comparison.deltaValor >= 0 ? 'border-green-300' : 'border-red-300'} col-span-2 lg:col-span-1`}>
              <p className={`text-xs font-semibold uppercase mb-1 ${comparison.deltaValor >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Delta Valor
              </p>
              <p className={`text-xl font-bold ${comparison.deltaValor >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {comparison.deltaValor >= 0 ? '+' : ''}R$ {comparison.deltaValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className={`bg-white rounded-lg p-3 shadow-sm border-2 ${comparison.deltaRepresentatividade >= 0 ? 'border-green-300' : 'border-red-300'}`}>
              <p className={`text-xs font-semibold uppercase mb-1 ${comparison.deltaRepresentatividade >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                Delta Rep.
              </p>
              <p className={`text-2xl font-bold ${comparison.deltaRepresentatividade >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {comparison.deltaRepresentatividade >= 0 ? '+' : ''}{comparison.deltaRepresentatividade.toFixed(2)}%
              </p>
            </div>

            <div className="bg-white rounded-lg p-3 shadow-sm border-2 border-green-300">
              <p className="text-xs font-semibold text-green-600 uppercase mb-1">SKUs Entraram</p>
              <p className="text-2xl font-bold text-green-700">+{comparison.added.toLocaleString('pt-BR')}</p>
            </div>

            <div className="bg-white rounded-lg p-3 shadow-sm border-2 border-red-300">
              <p className="text-xs font-semibold text-red-600 uppercase mb-1">SKUs Saíram</p>
              <p className="text-2xl font-bold text-red-700">{comparison.removed.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
