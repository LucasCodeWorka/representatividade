'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Produto } from '@/services/api';

interface ParetoChartProps {
  produtos: Produto[];
  maxItems?: number;
}

export default function ParetoChart({ produtos, maxItems = 50 }: ParetoChartProps) {
  // Pegar apenas os primeiros N produtos para o gráfico
  const data = produtos.slice(0, maxItems).map((p, index) => ({
    nome: `#${index + 1}`,
    cd_produto: p.cd_produto,
    quantidade: p.qt_liquida,
    acumulado: p.percent_acumulado,
    classificacao: p.classificacao,
  }));

  const getBarColor = (classificacao: string) => {
    switch (classificacao) {
      case 'A': return '#22c55e'; // verde
      case 'B': return '#eab308'; // amarelo
      case 'C': return '#ef4444'; // vermelho
      default: return '#94a3b8';
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold mb-4">Curva ABC (Pareto)</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="nome"
              fontSize={10}
              interval={Math.floor(data.length / 10)}
            />
            <YAxis
              yAxisId="left"
              orientation="left"
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3 border rounded shadow-lg">
                      <p className="font-semibold">SKU: {data.cd_produto}</p>
                      <p className="text-sm">Quantidade: {data.quantidade.toLocaleString('pt-BR')}</p>
                      <p className="text-sm">% Acumulado: {data.acumulado}%</p>
                      <p className="text-sm">
                        Classe: <span className={
                          data.classificacao === 'A' ? 'text-green-600' :
                          data.classificacao === 'B' ? 'text-yellow-600' : 'text-red-600'
                        }>{data.classificacao}</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine
              y={80}
              yAxisId="right"
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{ value: '80%', position: 'right', fill: '#ef4444' }}
            />
            <Bar
              yAxisId="left"
              dataKey="quantidade"
              fill="#3b82f6"
              radius={[2, 2, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="acumulado"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded" />
          <span>Quantidade</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-500 rounded" />
          <span>% Acumulado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-red-500 border-dashed" />
          <span>Linha 80%</span>
        </div>
      </div>
    </div>
  );
}
