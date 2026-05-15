'use client';

import { useState, useMemo } from 'react';
import { analiseApi, ReferenciaComportamento, SkuComportamento } from '@/services/api';

interface AnaliseSuspensaoProps {
  ano: number;
  selectedEmpresas: number[];
}

function fmtValor(n: number) {
  if (n === 0) return '—';
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtMesLabel(mesStr: string) {
  const [ano, mes] = mesStr.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${nomes[parseInt(mes) - 1]}/${ano.slice(2)}`;
}

function SkuExpandido({ sku, meses, corteYearMonth }: { sku: SkuComportamento; meses: string[]; corteYearMonth: string }) {
  return (
    <tr className={sku.suspenso ? 'bg-gray-100' : 'bg-gray-50'}>
      <td className="px-3 py-1.5 pl-10 text-xs text-gray-500 whitespace-nowrap">
        {sku.cd_produto}
        {sku.suspenso && (
          <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-gray-800 text-white">SUSP</span>
        )}
      </td>
      <td className="px-3 py-1.5 text-xs text-gray-600 max-w-[140px] truncate" title={sku.descricao}>{sku.descricao}</td>
      <td className="px-3 py-1.5 text-xs text-gray-500">{sku.cor}</td>
      <td className="px-3 py-1.5 text-xs text-gray-500">{sku.tam}</td>
      {meses.map(mes => {
        const v = sku.meses[mes];
        const isAntes = mes <= corteYearMonth;
        return (
          <td key={mes} className={`px-3 py-1.5 text-right text-xs ${isAntes ? 'text-gray-600' : 'text-blue-700'}`}>
            {v?.vl_total ? fmtValor(v.vl_total) : <span className="text-gray-300">—</span>}
          </td>
        );
      })}
    </tr>
  );
}

function ReferenciaRow({
  item,
  meses,
  corteYearMonth,
  expanded,
  onToggle,
  totalPorMes
}: {
  item: ReferenciaComportamento;
  meses: string[];
  corteYearMonth: string;
  expanded: boolean;
  onToggle: () => void;
  totalPorMes: Record<string, { vl_total: number; qt_liquida: number }>;
}) {
  // Pre-compute qty representativity per month to enable variation lookup
  const pctQtdPorMes: Record<string, number> = {};
  meses.forEach(mes => {
    const v = item.meses[mes];
    const qty = v?.qt_liquida ?? 0;
    const mesTotal = totalPorMes[mes] || { qt_liquida: 0 };
    pctQtdPorMes[mes] = qty > 0 && mesTotal.qt_liquida > 0 ? (qty / mesTotal.qt_liquida) * 100 : 0;
  });

  return (
    <>
      <tr className="cursor-pointer hover:bg-rose-50 border-t border-gray-200" onClick={onToggle}>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs w-3">{expanded ? '▼' : '▶'}</span>
            <div>
              <span className="text-sm font-semibold text-rose-600">{item.referencia}</span>
              <span className="ml-2 text-xs text-gray-400">{item.grupo}</span>
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5 text-center text-xs">
          <span className="font-bold text-gray-800">{item.skusSuspensos}</span>
          <span className="text-gray-400">/{item.totalSkus}</span>
        </td>
        {meses.map((mes, idx) => {
          const v = item.meses[mes];
          const isAntes = mes <= corteYearMonth;
          const isDepois = mes > corteYearMonth;
          const total = v?.vl_total ?? 0;
          const qty = v?.qt_liquida ?? 0;
          const suspVl = v?.suspensos?.vl_total ?? 0;
          const pctSusp = total > 0 && suspVl > 0 ? (suspVl / total) * 100 : 0;
          const mesTotal = totalPorMes[mes] || { vl_total: 0, qt_liquida: 0 };
          const pctValor = total > 0 && mesTotal.vl_total > 0 ? (total / mesTotal.vl_total) * 100 : 0;
          const pctQtd = pctQtdPorMes[mes] ?? 0;

          // Variation flag: month-over-month change in qty representativity, only after cutoff
          let variacaoPct: number | null = null;
          if (isDepois && idx > 0) {
            const prevPct = pctQtdPorMes[meses[idx - 1]] ?? 0;
            if (prevPct > 0) {
              variacaoPct = ((pctQtd - prevPct) / prevPct) * 100;
            }
          }
          const showFlag = variacaoPct !== null && Math.abs(variacaoPct) > 10;

          return (
            <td key={mes} className={`px-3 py-2.5 text-right align-top ${isAntes ? 'bg-amber-50' : 'bg-blue-50'}`}>
              <div className="flex items-center justify-end gap-1">
                <span className={`text-sm font-medium ${isAntes ? 'text-gray-800' : 'text-blue-800'}`}>
                  {total > 0 ? fmtValor(total) : <span className="text-gray-300 text-xs">—</span>}
                </span>
                {showFlag && (
                  <span className={`px-1 py-0.5 rounded text-[9px] font-bold leading-none ${
                    variacaoPct! > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {variacaoPct! > 0 ? '↑' : '↓'}{Math.abs(variacaoPct!).toFixed(0)}%
                  </span>
                )}
              </div>
              {total > 0 && (
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {pctValor.toFixed(1)}% vl · {pctQtd.toFixed(1)}% qt
                </div>
              )}
              {suspVl > 0 && (
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {fmtValor(suspVl)} <span className="text-gray-400">({pctSusp.toFixed(0)}% susp)</span>
                </div>
              )}
            </td>
          );
        })}
      </tr>
      {expanded && item.skus.map(sku => (
        <SkuExpandido key={sku.cd_produto} sku={sku} meses={meses} corteYearMonth={corteYearMonth} />
      ))}
    </>
  );
}

export default function AnaliseSuspensao({ ano, selectedEmpresas }: AnaliseSuspensaoProps) {
  const [dataCorte, setDataCorte] = useState(`${ano}-03-31`);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof analiseApi.getComportamentoSuspensao>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedRefs, setExpandedRefs] = useState<Set<string>>(new Set());

  const carregar = async () => {
    setLoading(true);
    setError(null);
    setExpandedRefs(new Set());
    try {
      const resultado = await analiseApi.getComportamentoSuspensao(ano, dataCorte, selectedEmpresas);
      setData(resultado);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar análise');
    } finally {
      setLoading(false);
    }
  };

  const toggleRef = (ref: string) => {
    setExpandedRefs(prev => {
      const next = new Set(prev);
      next.has(ref) ? next.delete(ref) : next.add(ref);
      return next;
    });
  };

  const meses = data?.meses ?? [];
  const corteYearMonth = data?.corteYearMonth ?? '';

  const totalPorMes = useMemo(() => {
    const totals: Record<string, { vl_total: number; qt_liquida: number }> = {};
    meses.forEach(mes => {
      totals[mes] = (data?.referencias ?? []).reduce(
        (acc, r) => ({
          vl_total: acc.vl_total + (r.meses[mes]?.vl_total ?? 0),
          qt_liquida: acc.qt_liquida + (r.meses[mes]?.qt_liquida ?? 0)
        }),
        { vl_total: 0, qt_liquida: 0 }
      );
    });
    return totals;
  }, [data, meses]);

  const totalSuspVlAntes = data
    ? data.referencias.reduce((s, r) =>
        s + meses.filter(m => m <= corteYearMonth).reduce((ms, m) => ms + (r.meses[m]?.suspensos?.vl_total ?? 0), 0), 0)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comportamento de Suspensoes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Venda mensal das referencias com SKUs suspensos. Fundo <span className="bg-amber-100 px-1 rounded">amarelo</span> = antes do corte, <span className="bg-blue-100 px-1 rounded">azul</span> = apos. Clique para expandir SKUs.
        </p>
      </div>

      {/* Controles */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Data de corte (suspensao):</label>
          <input
            type="date"
            value={dataCorte}
            onChange={e => setDataCorte(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>
        <button
          onClick={carregar}
          disabled={loading}
          className="px-4 py-2 bg-rose-600 text-white text-sm rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {loading ? 'Carregando...' : 'Carregar analise'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {!data && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center text-gray-400">
          <p className="text-lg">Selecione a data de corte e clique em Carregar analise</p>
          <p className="text-sm mt-1">A analise pode levar alguns minutos</p>
        </div>
      )}

      {data && (
        <>
          {/* Cards resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Referencias</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.totalReferencias}</p>
              <p className="text-xs text-gray-400 mt-0.5">com SKUs suspensos</p>
            </div>
            <div className="bg-white rounded-lg border border-amber-200 bg-amber-50 shadow-sm p-4">
              <p className="text-xs text-amber-700 uppercase font-medium">Valor suspenso (antes)</p>
              <p className="text-xl font-bold text-amber-900 mt-1">{fmtValor(totalSuspVlAntes)}</p>
              <p className="text-xs text-amber-600 mt-0.5">contribuicao acumulada antes do corte</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Meses antes</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{meses.filter(m => m <= corteYearMonth).length}</p>
              <p className="text-xs text-gray-400 mt-0.5">periodos analisados</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Meses depois</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{meses.filter(m => m > corteYearMonth).length}</p>
              <p className="text-xs text-gray-400 mt-0.5">periodos apos suspensao</p>
            </div>
          </div>

          {/* Tabela mensal */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 text-sm font-medium text-gray-700">
              {data.totalReferencias} referencia(s) — valor total da referencia por mes (em cinza: contribuicao dos suspensos)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">Referencia</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Susp/Tot</th>
                    {meses.map(mes => (
                      <th
                        key={mes}
                        className={`px-3 py-2 text-right text-xs font-medium uppercase ${mes <= data.corteYearMonth ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}
                      >
                        {fmtMesLabel(mes)}
                        {mes === data.corteYearMonth && <span className="block text-[9px] font-normal">← corte</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.referencias.map(r => (
                    <ReferenciaRow
                      key={r.referencia}
                      item={r}
                      meses={meses}
                      corteYearMonth={corteYearMonth}
                      expanded={expandedRefs.has(r.referencia)}
                      onToggle={() => toggleRef(r.referencia)}
                      totalPorMes={totalPorMes}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
