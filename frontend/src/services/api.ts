import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 300000, // 5 minutos (queries pesadas do banco podem demorar)
});

export interface Produto {
  cd_produto: number;
  descricao: string;
  cor: string;
  tam: string;
  referencia: string;
  grupo: string;
  qt_liquida: number;
  vl_total: number;
  percent_individual: number;
  percent_acumulado: number;
  classificacao: 'A' | 'B' | 'C';
  suspenso?: boolean;
}

export interface SkuReferencia {
  cd_produto: number;
  descricao: string;
  cor: string;
  tam: string;
  referencia: string;
  grupo: string;
  qt_liquida: number;
  vl_total: number;
  percent_individual: number;
  percent_acumulado: number;
  classificacao: 'A' | 'B' | 'C';
  suspenso?: boolean;
}

export interface ReferenciaMetricas {
  totalSkus: number;
  totalQtd: number;
  totalVl: number;
}

export interface ReferenciaResponse {
  success: boolean;
  referencia: string;
  ano: number;
  skus: SkuReferencia[];
  metricas: ReferenciaMetricas;
}

export interface Metricas {
  totalSkus: number;
  skus80Percent: number;
  totalVendido: number;
  totalValor: number;
  skusCandidatosDescontinuacao: number;
}

export interface RepresentatividadeResponse {
  success: boolean;
  ano: number;
  produtos: Produto[];
  metricas: Metricas;
}

export interface CacheStatus {
  success: boolean;
  carregado: boolean;
  loading: boolean;
  ano: number | null;
  empresas?: string;
  comFiltro: number;
  semFiltro: number;
  timestamp: string | null;
  expiraEm: string;
  referenciasEmCache: number;
}

export interface CacheCarregarResponse {
  success: boolean;
  message: string;
  ano: number;
  comFiltro: number;
  semFiltro: number;
  timestamp: string;
}

export interface Empresa {
  idempresa: number;
  empresa: string;
  suplojas: string;
  area: string;
}

export interface EmpresasResponse {
  success: boolean;
  total: number;
  empresas: Empresa[];
}

export type FlagTargetType = 'SKU' | 'COR' | 'REFERENCIA';
export type WorkflowStage = 'PCP' | 'DIRETORIA';
export type FlagStatus = 'pendente_diretoria' | 'aprovado' | 'rejeitado';

export interface RetiradaFlag {
  id: string;
  targetType: FlagTargetType;
  stage: WorkflowStage;
  referencia: string | null;
  cor: string | null;
  cd_produto: number | null;
  status: FlagStatus;
  reason: string;
  notes: string;
  snapshot: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface FlagsResponse {
  success: boolean;
  total: number;
  flags: RetiradaFlag[];
}

export interface FlagResponse {
  success: boolean;
  flag: RetiradaFlag;
}

export interface ScenarioItem {
  cd_produto: number;
  referencia: string;
  grupo: string;
  descricao: string;
  cor: string;
  tam: string;
  qt_liquida: number;
  vl_total: number;
  percent_individual: number;
  percent_acumulado: number;
  classificacao: string;
  suspenso: boolean;
}

export interface ScenarioSummary {
  totalSkus: number;
  totalQtd: number;
  totalValor: number;
  referencias: number;
  representatividadePercent: number;
}

export interface Scenario {
  id: string;
  nome: string;
  origem: string;
  ano: number;
  summary: ScenarioSummary;
  items: ScenarioItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ScenariosResponse {
  success: boolean;
  total: number;
  cenarios: Scenario[];
}

export interface ScenarioResponse {
  success: boolean;
  cenario: Scenario;
}

export const produtosApi = {
  async getRepresentatividade(ano: number = 2026, filtro: boolean = true, empresas: number[] = []): Promise<RepresentatividadeResponse> {
    const response = await api.get<RepresentatividadeResponse>('/produtos/representatividade', {
      params: {
        ano,
        filtro,
        empresas: empresas.length > 0 ? empresas.join(',') : undefined
      }
    });
    return response.data;
  },

  async getEmpresas(): Promise<EmpresasResponse> {
    const response = await api.get<EmpresasResponse>('/produtos/empresas');
    return response.data;
  },

  async getSkusPorReferencia(referencia: string, ano: number = 2026): Promise<ReferenciaResponse> {
    const response = await api.get<ReferenciaResponse>(`/produtos/referencia/${encodeURIComponent(referencia)}`, {
      params: { ano }
    });
    return response.data;
  },

  async getCacheStatus(): Promise<CacheStatus> {
    const response = await api.get<CacheStatus>('/produtos/cache/status');
    return response.data;
  },

  async carregarCache(ano: number = 2026): Promise<CacheCarregarResponse> {
    const response = await api.post<CacheCarregarResponse>('/produtos/cache/carregar', { ano });
    return response.data;
  },

  async limparCache(): Promise<void> {
    await api.post('/produtos/cache/limpar');
  }
};

export const flagsApi = {
  async list(): Promise<FlagsResponse> {
    const response = await api.get<FlagsResponse>('/flags');
    return response.data;
  },

  async create(payload: Partial<RetiradaFlag>): Promise<FlagResponse> {
    const response = await api.post<FlagResponse>('/flags', payload);
    return response.data;
  },

  async update(id: string, payload: Partial<RetiradaFlag>): Promise<FlagResponse> {
    const response = await api.patch<FlagResponse>(`/flags/${id}`, payload);
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/flags/${id}`);
  }
};

export const cenariosApi = {
  async list(): Promise<ScenariosResponse> {
    const response = await api.get<ScenariosResponse>('/cenarios');
    return response.data;
  },

  async create(payload: {
    nome: string;
    origem: string;
    ano: number;
    summary: ScenarioSummary;
    items: ScenarioItem[];
  }): Promise<ScenarioResponse> {
    const response = await api.post<ScenarioResponse>('/cenarios', payload);
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/cenarios/${id}`);
  }
};

export type MesDados = { qt_liquida: number; vl_total: number };
export type MesDadosComSuspenso = MesDados & { suspensos: MesDados };

export interface SkuComportamento {
  cd_produto: number;
  descricao: string;
  cor: string;
  tam: string;
  suspenso: boolean;
  meses: Record<string, MesDados>;
}

export interface ReferenciaComportamento {
  referencia: string;
  grupo: string;
  totalSkus: number;
  skusSuspensos: number;
  meses: Record<string, MesDadosComSuspenso>;
  skus: SkuComportamento[];
}

export interface ComportamentoSuspensaoResponse {
  success: boolean;
  referencias: ReferenciaComportamento[];
  meses: string[];
  corteYearMonth: string;
  dataCorte: string;
  totalReferencias: number;
}

export const analiseApi = {
  async getComportamentoSuspensao(ano: number = 2026, dataCorte: string, empresas: number[] = []): Promise<ComportamentoSuspensaoResponse> {
    const response = await api.get<ComportamentoSuspensaoResponse>('/produtos/comportamento-suspensao', {
      params: {
        ano,
        dataCorte,
        empresas: empresas.length > 0 ? empresas.join(',') : undefined
      },
      timeout: 300000
    });
    return response.data;
  }
};

export default api;
