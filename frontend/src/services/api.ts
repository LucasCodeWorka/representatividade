import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000, // 2 minutos (consultas podem ser lentas)
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

export const produtosApi = {
  async getRepresentatividade(ano: number = 2026, filtro: boolean = true): Promise<RepresentatividadeResponse> {
    const response = await api.get<RepresentatividadeResponse>('/produtos/representatividade', {
      params: { ano, filtro }
    });
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

export default api;
