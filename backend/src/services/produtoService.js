const pool = require('../config/database');

// Cache para armazenar produtos classificados (evita chamadas repetidas às funções pesadas)
let classificacaoCache = {
  data: null,
  timestamp: null,
  ttl: 30 * 60 * 1000 // 30 minutos
};

// Cache COMPLETO de representatividade (dados prontos para uso)
let representatividadeCache = {
  comFiltro: null,      // dados com filtro EM LINHA
  semFiltro: null,      // dados sem filtro
  ano: null,
  timestamp: null,
  ttl: 60 * 60 * 1000,  // 1 hora
  loading: false
};

// Cache de referências já consultadas
let referenciasCache = new Map(); // Map<referencia, { data, timestamp }>
const REFERENCIA_TTL = 60 * 60 * 1000; // 1 hora

const produtoService = {
  /**
   * Busca produtos EM LINHA (status) e que NÃO são EDICAO LIMITADA (continuidade)
   * Executa as funções pesadas f_dic_prd_classificacao separadamente
   */
  async getProdutosClassificados(ano = 2026) {
    // Verifica cache
    if (classificacaoCache.data &&
        classificacaoCache.timestamp &&
        (Date.now() - classificacaoCache.timestamp) < classificacaoCache.ttl) {
      console.log('Usando cache de classificação');
      return classificacaoCache.data;
    }

    console.log('Buscando classificação de produtos (otimizado)...');
    const dataInicio = `${ano}-01-01`;

    // OTIMIZADO: Primeiro busca produtos distintos, depois aplica filtros de classificação
    // Isso evita chamar as funções pesadas para cada linha de transação
    const queryProdutosDistintos = `
      WITH produtos_vendidos AS (
        SELECT DISTINCT cd_produto
        FROM vr_tra_transitem
        WHERE dt_transacao >= $1
      )
      SELECT cd_produto
      FROM produtos_vendidos
      WHERE f_dic_prd_classificacao(cd_produto, 'DS', 27) = 'EM LINHA'
        AND f_dic_prd_classificacao(cd_produto, 'DS', 802) <> 'EDICAO LIMITADA'
    `;

    try {
      console.log('Executando query otimizada...');
      const result = await pool.query(queryProdutosDistintos, [dataInicio]);

      const produtosFiltrados = result.rows.map(r => r.cd_produto);

      // Atualiza cache
      classificacaoCache = {
        data: produtosFiltrados,
        timestamp: Date.now(),
        ttl: 30 * 60 * 1000
      };

      console.log(`${produtosFiltrados.length} produtos classificados encontrados`);
      return produtosFiltrados;
    } catch (error) {
      console.error('Erro ao buscar classificação:', error);
      throw error;
    }
  },

  /**
   * Busca vendas agregadas por produto
   */
  async getVendasPorProduto(ano = 2026, produtosFiltrados = null) {
    const dataInicio = `${ano}-01-01`;

    // Se não temos produtos filtrados, busca todos
    const usarFiltro = produtosFiltrados && produtosFiltrados.length > 0;

    // Query de vendas de transações (empresas diferentes de 1)
    // Usa vl_totalliquido do item (valor total já calculado)
    let queryTransacoes = `
      SELECT
        i.cd_produto,
        SUM(i.qt_solicitada * CASE WHEN T.tp_modalidade = '3' THEN -1 ELSE 1 END) AS qt_liquida,
        SUM(i.vl_totalliquido * CASE WHEN T.tp_modalidade = '3' THEN -1 ELSE 1 END) AS vl_total
      FROM vr_tra_transacao T
      JOIN vr_tra_transitem i ON T.nr_transacao = i.nr_transacao AND T.cd_empresa = i.cd_empresa
      WHERE T.cd_empresa <> 1
        AND T.cd_operacao NOT IN (140,76,25,26,27,273,44,240,241,242,243,244,245,239,238,237,236)
        AND i.dt_transacao >= $1
        AND i.cd_compvend <> 1
        AND T.tp_situacao <> 6
        AND T.tp_modalidade IN ('3','4')
        ${usarFiltro ? 'AND i.cd_produto = ANY($2)' : ''}
      GROUP BY i.cd_produto
    `;

    // Query de vendas de pedidos (empresa 1)
    // Usa vl_solicitado do item de pedido
    let queryPedidos = `
      SELECT
        i.cd_produto,
        SUM(i.qt_solicitada) AS qt_liquida,
        SUM(i.vl_solicitado) AS vl_total
      FROM vr_ped_pedidoc2 C
      LEFT JOIN vr_ped_pedidoi i ON C.cd_empresa = i.cd_empresa AND i.cd_pedido = C.cd_pedido
      WHERE C.dt_pedido >= $1
        AND C.cd_cliente <> 110000001
        AND C.cd_representant <> 32098
        AND C.tp_situacao <> 6
        AND C.cd_empresa = 1
        AND C.cd_operacao IN (1,18,52,166,148,98,55,97,30,79,93,137,141,142,156,159,310,598,180,58,69,85,124,182)
        ${usarFiltro ? 'AND i.cd_produto = ANY($2)' : ''}
      GROUP BY i.cd_produto
    `;

    try {
      const params = usarFiltro ? [dataInicio, produtosFiltrados] : [dataInicio];

      const [resultTransacoes, resultPedidos] = await Promise.all([
        pool.query(queryTransacoes, params),
        pool.query(queryPedidos, params)
      ]);

      // Agregar resultados
      const vendasMap = new Map();

      resultTransacoes.rows.forEach(row => {
        const atual = vendasMap.get(row.cd_produto) || { qt_liquida: 0, vl_total: 0 };
        vendasMap.set(row.cd_produto, {
          qt_liquida: atual.qt_liquida + parseFloat(row.qt_liquida || 0),
          vl_total: atual.vl_total + parseFloat(row.vl_total || 0)
        });
      });

      resultPedidos.rows.forEach(row => {
        const atual = vendasMap.get(row.cd_produto) || { qt_liquida: 0, vl_total: 0 };
        vendasMap.set(row.cd_produto, {
          qt_liquida: atual.qt_liquida + parseFloat(row.qt_liquida || 0),
          vl_total: atual.vl_total + parseFloat(row.vl_total || 0)
        });
      });

      // Converter para array e ordenar
      const vendas = Array.from(vendasMap.entries())
        .map(([cd_produto, dados]) => ({ cd_produto, qt_liquida: dados.qt_liquida, vl_total: dados.vl_total }))
        .filter(v => v.qt_liquida > 0)
        .sort((a, b) => b.qt_liquida - a.qt_liquida);

      return vendas;
    } catch (error) {
      console.error('Erro ao buscar vendas:', error);
      throw error;
    }
  },

  /**
   * Busca detalhes dos produtos (descrição, cor, tamanho)
   */
  async getDetalhesProdutos(cdProdutos) {
    if (!cdProdutos || cdProdutos.length === 0) {
      return new Map();
    }

    const query = `
      SELECT
        cd_produto,
        nm_produto AS descricao,
        ds_cor AS cor,
        ds_tamanho AS tam,
        f_dic_prd_nivel(cd_produto, 'CD') AS referencia,
        f_dic_prd_classificacao(cd_produto, 'DS', 25) AS grupo,
        CASE WHEN f_dic_prd_classificacao(cd_produto, 'CD', 124) = '007' THEN true ELSE false END AS suspenso
      FROM vr_prd_prdgrade
      WHERE cd_produto = ANY($1)
    `;

    try {
      const result = await pool.query(query, [cdProdutos]);

      const detalhesMap = new Map();
      result.rows.forEach(row => {
        detalhesMap.set(row.cd_produto, {
          descricao: row.descricao,
          cor: row.cor,
          tam: row.tam,
          referencia: row.referencia,
          grupo: row.grupo,
          suspenso: row.suspenso
        });
      });

      return detalhesMap;
    } catch (error) {
      console.error('Erro ao buscar detalhes:', error);
      throw error;
    }
  },

  /**
   * Calcula representatividade (análise Pareto) - COM CACHE
   */
  async getRepresentatividade(ano = 2026, aplicarFiltroClassificacao = true) {
    const cacheKey = aplicarFiltroClassificacao ? 'comFiltro' : 'semFiltro';

    // Verifica cache
    if (representatividadeCache[cacheKey] &&
        representatividadeCache.ano === ano &&
        representatividadeCache.timestamp &&
        (Date.now() - representatividadeCache.timestamp) < representatividadeCache.ttl) {
      console.log(`[CACHE HIT] Retornando representatividade do cache (${cacheKey})`);
      return representatividadeCache[cacheKey];
    }

    try {
      console.log(`[CACHE MISS] Calculando representatividade (${cacheKey})...`);

      // Passo 1: Buscar produtos classificados (se aplicar filtro)
      let produtosFiltrados = null;
      if (aplicarFiltroClassificacao) {
        produtosFiltrados = await this.getProdutosClassificados(ano);
      }

      // Passo 2: Buscar vendas
      const vendas = await this.getVendasPorProduto(ano, produtosFiltrados);

      if (vendas.length === 0) {
        return { produtos: [], metricas: { totalSkus: 0, skus80Percent: 0, totalVendido: 0 } };
      }

      // Passo 3: Buscar detalhes dos produtos
      const cdProdutos = vendas.map(v => v.cd_produto);
      const detalhes = await this.getDetalhesProdutos(cdProdutos);

      // Passo 4: Calcular representatividade POR VALOR (não por quantidade)
      const totalQtd = vendas.reduce((sum, v) => sum + v.qt_liquida, 0);
      const totalValor = vendas.reduce((sum, v) => sum + v.vl_total, 0);

      // Ordenar por VALOR (não por quantidade)
      vendas.sort((a, b) => b.vl_total - a.vl_total);

      let acumulado = 0;
      let skus80Percent = 0;
      let achou80 = false;

      const produtos = vendas.map((venda, index) => {
        // Percentual calculado sobre VALOR
        const percentIndividual = totalValor > 0 ? (venda.vl_total / totalValor) * 100 : 0;
        acumulado += percentIndividual;

        if (!achou80 && acumulado >= 80) {
          skus80Percent = index + 1;
          achou80 = true;
        }

        const detalhe = detalhes.get(venda.cd_produto) || {};

        return {
          cd_produto: venda.cd_produto,
          descricao: detalhe.descricao || '-',
          cor: detalhe.cor || '-',
          tam: detalhe.tam || '-',
          referencia: detalhe.referencia || '-',
          grupo: detalhe.grupo || '-',
          suspenso: !!detalhe.suspenso,
          qt_liquida: Math.round(venda.qt_liquida),
          vl_total: Math.round(venda.vl_total * 100) / 100,
          percent_individual: Math.round(percentIndividual * 100) / 100,
          percent_acumulado: Math.round(acumulado * 100) / 100,
          classificacao: acumulado <= 80 ? 'A' : acumulado <= 95 ? 'B' : 'C'
        };
      });

      const resultado = {
        produtos,
        metricas: {
          totalSkus: produtos.length,
          skus80Percent: skus80Percent || produtos.length,
          totalVendido: Math.round(totalQtd),
          totalValor: Math.round(totalValor * 100) / 100,
          skusCandidatosDescontinuacao: produtos.filter(p => p.classificacao === 'C').length
        }
      };

      // Salva no cache
      representatividadeCache[cacheKey] = resultado;
      representatividadeCache.ano = ano;
      representatividadeCache.timestamp = Date.now();
      console.log(`[CACHE] Representatividade salva no cache (${cacheKey})`);

      return resultado;
    } catch (error) {
      console.error('Erro ao calcular representatividade:', error);
      throw error;
    }
  },

  /**
   * Pré-carrega o cache completo (com e sem filtro)
   */
  async preCarregarCache(ano = 2026) {
    console.log('[CACHE] Iniciando pré-carregamento...');
    representatividadeCache.loading = true;

    try {
      // Carrega com filtro
      console.log('[CACHE] Carregando dados COM filtro...');
      await this.getRepresentatividade(ano, true);

      // Carrega sem filtro
      console.log('[CACHE] Carregando dados SEM filtro...');
      await this.getRepresentatividade(ano, false);

      representatividadeCache.loading = false;
      console.log('[CACHE] Pré-carregamento concluído!');

      return {
        success: true,
        ano,
        comFiltro: representatividadeCache.comFiltro?.produtos?.length || 0,
        semFiltro: representatividadeCache.semFiltro?.produtos?.length || 0,
        timestamp: new Date(representatividadeCache.timestamp).toISOString()
      };
    } catch (error) {
      representatividadeCache.loading = false;
      throw error;
    }
  },

  /**
   * Retorna status do cache
   */
  getStatusCache() {
    const agora = Date.now();
    const tempoRestante = representatividadeCache.timestamp
      ? Math.max(0, representatividadeCache.ttl - (agora - representatividadeCache.timestamp))
      : 0;

    return {
      carregado: !!(representatividadeCache.comFiltro || representatividadeCache.semFiltro),
      loading: representatividadeCache.loading,
      ano: representatividadeCache.ano,
      comFiltro: representatividadeCache.comFiltro?.produtos?.length || 0,
      semFiltro: representatividadeCache.semFiltro?.produtos?.length || 0,
      timestamp: representatividadeCache.timestamp
        ? new Date(representatividadeCache.timestamp).toISOString()
        : null,
      expiraEm: tempoRestante > 0 ? Math.round(tempoRestante / 1000 / 60) + ' minutos' : 'expirado',
      referenciasEmCache: referenciasCache.size
    };
  },

  /**
   * Busca SKUs de uma referência COM VENDA e calcula representatividade - COM CACHE
   */
  async getSkusPorReferencia(referencia, ano = 2026) {
    const cacheKey = `${referencia}_${ano}`;

    // Verifica cache de referência
    if (referenciasCache.has(cacheKey)) {
      const cached = referenciasCache.get(cacheKey);
      if ((Date.now() - cached.timestamp) < REFERENCIA_TTL) {
        console.log(`[CACHE HIT] Retornando referência ${referencia} do cache`);
        return cached.data;
      }
      referenciasCache.delete(cacheKey);
    }

    console.log(`[CACHE MISS] Buscando referência ${referencia}...`);
    const dataInicio = `${ano}-01-01`;

    const query = `
      WITH vendas_sku AS (
        SELECT
          i.cd_produto,
          SUM(i.qt_solicitada * CASE WHEN T.tp_modalidade = '3' THEN -1 ELSE 1 END) AS qt_liquida,
          SUM(i.vl_totalliquido * CASE WHEN T.tp_modalidade = '3' THEN -1 ELSE 1 END) AS vl_total
        FROM vr_tra_transacao T
        JOIN vr_tra_transitem i ON T.nr_transacao = i.nr_transacao AND T.cd_empresa = i.cd_empresa
        WHERE T.cd_empresa <> 1
          AND T.cd_operacao NOT IN (140,76,25,26,27,273,44,240,241,242,243,244,245,239,238,237,236)
          AND i.dt_transacao >= $2
          AND i.cd_compvend <> 1
          AND T.tp_situacao <> 6
          AND T.tp_modalidade IN ('3','4')
        GROUP BY i.cd_produto
        UNION ALL
        SELECT
          i.cd_produto,
          SUM(i.qt_solicitada) AS qt_liquida,
          SUM(i.vl_solicitado) AS vl_total
        FROM vr_ped_pedidoc2 C
        LEFT JOIN vr_ped_pedidoi i ON C.cd_empresa = i.cd_empresa AND i.cd_pedido = C.cd_pedido
        WHERE C.dt_pedido >= $2
          AND C.cd_cliente <> 110000001
          AND C.cd_representant <> 32098
          AND C.tp_situacao <> 6
          AND C.cd_empresa = 1
          AND C.cd_operacao IN (1,18,52,166,148,98,55,97,30,79,93,137,141,142,156,159,310,598,180,58,69,85,124,182)
        GROUP BY i.cd_produto
      ),
      vendas_agregadas AS (
        SELECT cd_produto, SUM(qt_liquida) AS qt_liquida, SUM(vl_total) AS vl_total
        FROM vendas_sku
        GROUP BY cd_produto
        HAVING SUM(qt_liquida) > 0
      )
      SELECT
        p.cd_produto,
        p.nm_produto AS descricao,
        p.ds_cor AS cor,
        p.ds_tamanho AS tam,
        f_dic_prd_nivel(p.cd_produto, 'CD') AS referencia,
        f_dic_prd_classificacao(p.cd_produto, 'DS', 25) AS grupo,
        CASE WHEN f_dic_prd_classificacao(p.cd_produto, 'CD', 124) = '007' THEN true ELSE false END AS suspenso,
        v.qt_liquida,
        v.vl_total
      FROM vr_prd_prdgrade p
      INNER JOIN vendas_agregadas v ON p.cd_produto = v.cd_produto
      WHERE f_dic_prd_nivel(p.cd_produto, 'CD') = $1
      ORDER BY v.qt_liquida DESC
    `;

    try {
      const result = await pool.query(query, [referencia, dataInicio]);

      // Calcular representatividade dentro da referência POR VALOR
      const totalQtd = result.rows.reduce((sum, r) => sum + parseFloat(r.qt_liquida || 0), 0);
      const totalVl = result.rows.reduce((sum, r) => sum + parseFloat(r.vl_total || 0), 0);

      // Ordenar por VALOR
      result.rows.sort((a, b) => parseFloat(b.vl_total || 0) - parseFloat(a.vl_total || 0));

      let acumulado = 0;
      const skus = result.rows.map(row => {
        // Percentual calculado sobre VALOR
        const percentIndividual = totalVl > 0 ? (parseFloat(row.vl_total || 0) / totalVl) * 100 : 0;
        acumulado += percentIndividual;

        return {
          cd_produto: row.cd_produto,
          descricao: row.descricao,
          cor: row.cor,
          tam: row.tam,
          referencia: row.referencia,
          grupo: row.grupo,
          suspenso: !!row.suspenso,
          qt_liquida: Math.round(parseFloat(row.qt_liquida)),
          vl_total: Math.round(parseFloat(row.vl_total || 0) * 100) / 100,
          percent_individual: Math.round(percentIndividual * 100) / 100,
          percent_acumulado: Math.round(acumulado * 100) / 100,
          classificacao: acumulado <= 80 ? 'A' : acumulado <= 95 ? 'B' : 'C'
        };
      });

      const resultado = {
        skus,
        metricas: {
          totalSkus: skus.length,
          totalQtd: Math.round(totalQtd),
          totalVl: Math.round(totalVl * 100) / 100
        }
      };

      // Salva no cache de referências
      referenciasCache.set(cacheKey, {
        data: resultado,
        timestamp: Date.now()
      });
      console.log(`[CACHE] Referência ${referencia} salva no cache`);

      return resultado;
    } catch (error) {
      console.error('Erro ao buscar SKUs por referência:', error);
      throw error;
    }
  },

  /**
   * Limpa todos os caches
   */
  limparCache() {
    classificacaoCache = { data: null, timestamp: null, ttl: 30 * 60 * 1000 };
    representatividadeCache = {
      comFiltro: null,
      semFiltro: null,
      ano: null,
      timestamp: null,
      ttl: 60 * 60 * 1000,
      loading: false
    };
    referenciasCache.clear();
    console.log('[CACHE] Todos os caches foram limpos');
  }
};

module.exports = produtoService;
