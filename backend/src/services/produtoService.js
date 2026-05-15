const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../../data/representatividade_cache.json');

// Cache para armazenar produtos classificados (evita chamadas repetidas às funções pesadas)
let classificacaoCache = {
  data: null,
  timestamp: null,
  ttl: 4 * 60 * 60 * 1000 // 4 horas (otimizado)
};

// Cache COMPLETO de representatividade (dados prontos para uso)
let representatividadeCache = {
  comFiltro: null,      // dados com filtro EM LINHA
  semFiltro: null,      // dados sem filtro
  ano: null,
  empresasKey: 'all',
  timestamp: null,
  ttl: 4 * 60 * 60 * 1000,  // 4 horas (otimizado)
  loading: false
};

function salvarCacheEmArquivo() {
  try {
    const dados = {
      comFiltro: representatividadeCache.comFiltro,
      semFiltro: representatividadeCache.semFiltro,
      ano: representatividadeCache.ano,
      empresasKey: representatividadeCache.empresasKey,
      timestamp: representatividadeCache.timestamp
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(dados), 'utf8');
    console.log('[CACHE] Salvo em arquivo.');
  } catch (err) {
    console.warn('[CACHE] Não foi possível salvar em arquivo:', err.message);
  }
}

function carregarCacheDoArquivo() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return;
    const dados = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (!dados.timestamp) return;
    representatividadeCache.comFiltro = dados.comFiltro || null;
    representatividadeCache.semFiltro = dados.semFiltro || null;
    representatividadeCache.ano = dados.ano || null;
    representatividadeCache.empresasKey = dados.empresasKey || 'all';
    representatividadeCache.timestamp = dados.timestamp || null;
    console.log(`[CACHE] Carregado do arquivo (salvo em ${new Date(dados.timestamp).toLocaleString('pt-BR')})`);
  } catch (err) {
    console.warn('[CACHE] Não foi possível carregar do arquivo:', err.message);
  }
}

// Carrega cache persistido ao iniciar
carregarCacheDoArquivo();

// Cache de referências já consultadas
let referenciasCache = new Map(); // Map<referencia, { data, timestamp }>
const REFERENCIA_TTL = 60 * 60 * 1000; // 1 hora

const produtoService = {
  normalizeEmpresaIds(empresas = []) {
    if (!Array.isArray(empresas)) return [];
    const ids = empresas
      .map(e => parseInt(e, 10))
      .filter(e => Number.isInteger(e) && e > 0);
    return Array.from(new Set(ids)).sort((a, b) => a - b);
  },

  /**
   * Lista empresas disponiveis para filtro
   */
  async getEmpresas() {
    const query = `
      SELECT
        e.cd_empresa AS idempresa,
        e.nm_grupoempresa AS empresa,
        f_dic_pes_classificacao2(e.cd_pessoa, 'DS', 1000) AS suplojas,
        f_dic_pes_classificacao2(e.cd_pessoa, 'DS', 400) AS area,
        "END".cd_cep,
        e.cd_pessoa,
        "END".nm_logradouro AS rua,
        "END".nr_logradouro AS numero,
        "END".ds_bairro AS bairro,
        "END".nm_municipio AS cidade,
        "END".ds_siglaest AS estado,
        "END".ds_siglalograd
      FROM vr_ger_empresa e
      JOIN vr_pes_endereco "END" ON e.cd_pessoa = "END".cd_pessoa
      WHERE (
        (e.cd_empresa < 50 AND "END".cd_tipoendereco = 1)
        OR e.cd_empresa = ANY (ARRAY[100::bigint,110::bigint,120::bigint])
      )
      ORDER BY e.nm_grupoempresa
    `;

    const result = await pool.query(query);
    return result.rows.map(row => ({
      idempresa: Number(row.idempresa),
      empresa: row.empresa,
      suplojas: row.suplojas || '-',
      area: row.area || '-'
    }));
  },
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

    try {
      console.log('Executando query otimizada com consultas isoladas...');

      // Passo 1: Produtos vendidos (SEM função — rápido)
      const produtosVendidos = await pool.query(`
        SELECT DISTINCT cd_produto
        FROM vr_tra_transitem
        WHERE dt_transacao >= $1
      `, [dataInicio]);

      const vendidosArray = produtosVendidos.rows.map(r => r.cd_produto);
      const vendidosSet = new Set(vendidosArray);

      // Passo 2: Classificações apenas dos produtos vendidos (muito menor universo)
      const [emLinha, emLinhaNaoComprarMp, edicaoLimitada, suspensos] = await Promise.all([
        pool.query(`
          SELECT cd_produto
          FROM vr_prd_prdgrade
          WHERE cd_produto = ANY($1)
            AND f_dic_prd_classificacao(cd_produto, 'DS', 27) = 'EM LINHA'
        `, [vendidosArray]),

        pool.query(`
          SELECT cd_produto
          FROM vr_prd_prdgrade
          WHERE cd_produto = ANY($1)
            AND f_dic_prd_classificacao(cd_produto, 'DS', 27) = 'EM LINHA NAO COMPRAR MP'
        `, [vendidosArray]),

        pool.query(`
          SELECT cd_produto
          FROM vr_prd_prdgrade
          WHERE cd_produto = ANY($1)
            AND f_dic_prd_classificacao(cd_produto, 'DS', 802) = 'EDICAO LIMITADA'
        `, [vendidosArray]),

        pool.query(`
          SELECT cd_produto
          FROM vr_prd_prdgrade
          WHERE cd_produto = ANY($1)
            AND f_dic_prd_classificacao(cd_produto, 'CD', 124) = '007'
        `, [vendidosArray])
      ]);

      // JOIN em memória
      const emLinhaSet = new Set(emLinha.rows.map(r => r.cd_produto));
      const emLinhaNaoComprarSet = new Set(emLinhaNaoComprarMp.rows.map(r => r.cd_produto));
      const edicaoLimitadaSet = new Set(edicaoLimitada.rows.map(r => r.cd_produto));
      const suspensoSet = new Set(suspensos.rows.map(r => r.cd_produto));

      // Regra: EM LINHA sempre entra; EM LINHA NAO COMPRAR MP só entra se também for suspenso
      const produtosFiltrados = Array.from(vendidosSet).filter(cd => {
        if (edicaoLimitadaSet.has(cd)) return false;
        if (emLinhaSet.has(cd)) return true;
        if (emLinhaNaoComprarSet.has(cd) && suspensoSet.has(cd)) return true;
        return false;
      });

      // Atualiza cache
      classificacaoCache = {
        data: produtosFiltrados,
        timestamp: Date.now(),
        ttl: 4 * 60 * 60 * 1000
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
  async getVendasPorProduto(ano = 2026, produtosFiltrados = null, empresas = []) {
    const dataInicio = `${ano}-01-01`;
    const empresasSelecionadas = this.normalizeEmpresaIds(empresas);
    const usarFiltroEmpresas = empresasSelecionadas.length > 0;

    // Se nao temos produtos filtrados, busca todos
    const usarFiltro = produtosFiltrados && produtosFiltrados.length > 0;

    const transParams = [dataInicio];
    if (usarFiltroEmpresas) transParams.push(empresasSelecionadas);
    const produtoParamTrans = usarFiltro ? `$${transParams.length + 1}` : null;
    if (usarFiltro) transParams.push(produtosFiltrados);

    // Query de vendas de transacoes — empresa 1 usa pedidos, não transações
    let queryTransacoes = `
      SELECT
        i.cd_produto,
        SUM(i.qt_solicitada * CASE WHEN T.tp_modalidade = '3' THEN -1 ELSE 1 END) AS qt_liquida,
        SUM(i.vl_totalliquido * CASE WHEN T.tp_modalidade = '3' THEN -1 ELSE 1 END) AS vl_total
      FROM vr_tra_transacao T
      JOIN vr_tra_transitem i ON T.nr_transacao = i.nr_transacao AND T.cd_empresa = i.cd_empresa
      WHERE T.cd_empresa <> 1
        AND ${usarFiltroEmpresas ? 'T.cd_empresa = ANY($2)' : '1=1'}
        AND T.cd_operacao NOT IN (140,76,25,26,27,273,44,240,241,242,243,244,245,239,238,237,236)
        AND i.dt_transacao >= $1
        AND i.cd_compvend <> 1
        AND T.tp_situacao <> 6
        AND T.tp_modalidade IN ('3','4')
        ${usarFiltro ? `AND i.cd_produto = ANY(${produtoParamTrans})` : ''}
      GROUP BY i.cd_produto
    `;

    const pedidoParams = [dataInicio];
    if (usarFiltroEmpresas) pedidoParams.push(empresasSelecionadas);
    const produtoParamPedido = usarFiltro ? `$${pedidoParams.length + 1}` : null;
    if (usarFiltro) pedidoParams.push(produtosFiltrados);

    // Query de vendas de pedidos — apenas empresa 1 (não entra em transações)
    // Se houver filtro de empresas, só inclui pedidos se empresa 1 estiver selecionada
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
        AND ${usarFiltroEmpresas ? '1 = ANY($2)' : '1=1'}
        AND C.cd_operacao IN (1,18,52,166,148,98,55,97,30,79,93,137,141,142,156,159,310,598,180,58,69,85,124,182)
        ${usarFiltro ? `AND i.cd_produto = ANY(${produtoParamPedido})` : ''}
      GROUP BY i.cd_produto
    `;

    try {
      const [resultTransacoes, resultPedidos] = await Promise.all([
        pool.query(queryTransacoes, transParams),
        pool.query(queryPedidos, pedidoParams)
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
        .map(([cd_produto, dados]) => ({ cd_produto: Number(cd_produto), qt_liquida: dados.qt_liquida, vl_total: dados.vl_total }))
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

    console.log(`[DETALHES] Buscando detalhes para ${cdProdutos.length} produtos...`);

    try {
      // OTIMIZAÇÃO: Consultas isoladas em paralelo (mais rápido que funções no SELECT)
      const [detalhesBasicos, referencias, grupos, suspensos] = await Promise.all([
        // 1. Dados básicos do produto (SEM funções) - COALESCE para evitar NULL
        pool.query(`
          SELECT cd_produto,
                 COALESCE(nm_produto, 'SEM DESCRICAO') AS descricao,
                 COALESCE(ds_cor, 'SEM COR') AS cor,
                 COALESCE(ds_tamanho, 'U') AS tam
          FROM vr_prd_prdgrade
          WHERE cd_produto = ANY($1)
        `, [cdProdutos]),

        // 2. Referências (função isolada) - COALESCE para evitar NULL
        pool.query(`
          SELECT cd_produto, COALESCE(f_dic_prd_nivel(cd_produto, 'CD'), 'SEM REF') AS referencia
          FROM vr_prd_prdgrade
          WHERE cd_produto = ANY($1)
        `, [cdProdutos]),

        // 3. Grupos (função isolada) - COALESCE para evitar NULL
        pool.query(`
          SELECT cd_produto, COALESCE(f_dic_prd_classificacao(cd_produto, 'DS', 25), 'SEM GRUPO') AS grupo
          FROM vr_prd_prdgrade
          WHERE cd_produto = ANY($1)
        `, [cdProdutos]),

        // 4. Suspensos (função isolada)
        pool.query(`
          SELECT cd_produto,
            CASE WHEN f_dic_prd_classificacao(cd_produto, 'CD', 124) = '007' THEN true ELSE false END AS suspenso
          FROM vr_prd_prdgrade
          WHERE cd_produto = ANY($1)
        `, [cdProdutos])
      ]);

      // JOIN em memória (rápido)
      const detalhesMap = new Map();
      const refMap = new Map(referencias.rows.map(r => [Number(r.cd_produto), r.referencia]));
      const grupoMap = new Map(grupos.rows.map(r => [Number(r.cd_produto), r.grupo]));
      const suspensoMap = new Map(suspensos.rows.map(r => [Number(r.cd_produto), r.suspenso]));

      detalhesBasicos.rows.forEach(row => {
        const cdProduto = Number(row.cd_produto);
        const ref = refMap.get(cdProduto);
        const grp = grupoMap.get(cdProduto);

        detalhesMap.set(cdProduto, {
          descricao: row.descricao,
          cor: row.cor,
          tam: row.tam,
          referencia: ref !== undefined && ref !== null ? ref : 'SEM REF',
          grupo: grp !== undefined && grp !== null ? grp : 'SEM GRUPO',
          suspenso: suspensoMap.get(cdProduto) || false
        });
      });

      console.log(`[DETALHES] ${detalhesBasicos.rows.length} produtos básicos encontrados`);
      console.log(`[DETALHES] ${referencias.rows.length} referências encontradas`);
      console.log(`[DETALHES] ${grupos.rows.length} grupos encontrados`);
      console.log(`[DETALHES] ${suspensos.rows.length} suspensos encontrados`);
      console.log(`[DETALHES] Amostra primeiro produto:`, detalhesBasicos.rows[0]);
      console.log(`[DETALHES] Amostra primeira referência:`, referencias.rows[0]);

      return detalhesMap;
    } catch (error) {
      console.error('Erro ao buscar detalhes:', error);
      throw error;
    }
  },

  /**
   * Calcula representatividade (análise Pareto) - COM CACHE
   */
  async getRepresentatividade(ano = 2026, aplicarFiltroClassificacao = true, empresas = []) {
    const cacheKey = aplicarFiltroClassificacao ? 'comFiltro' : 'semFiltro';
    const empresasSelecionadas = this.normalizeEmpresaIds(empresas);
    const empresasKey = empresasSelecionadas.length > 0 ? empresasSelecionadas.join(',') : 'all';

    // Verifica cache
    if (representatividadeCache[cacheKey] &&
        representatividadeCache.ano === ano &&
        representatividadeCache.empresasKey === empresasKey &&
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
      const vendas = await this.getVendasPorProduto(ano, produtosFiltrados, empresasSelecionadas);

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
          cd_produto: Number(venda.cd_produto),
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
      representatividadeCache.empresasKey = empresasKey;
      representatividadeCache.timestamp = Date.now();
      console.log(`[CACHE] Representatividade salva no cache (${cacheKey})`);
      salvarCacheEmArquivo();

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
      empresas: representatividadeCache.empresasKey,
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
        -- Apenas empresa 1: não entra em transações, usa pedidos
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
          cd_produto: Number(row.cd_produto),
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
   * Análise de comportamento de referências com SKUs suspensos (antes vs depois do corte)
   */
  async getComportamentoSuspensao(ano = 2026, dataCorte, empresas = []) {
    const dataInicio = `${ano}-01-01`;
    const dataCorteStr = dataCorte || `${ano}-03-31`;
    const hoje = new Date().toISOString().slice(0, 10);
    const empresasSel = this.normalizeEmpresaIds(empresas);
    const usarFiltroEmpresas = empresasSel.length > 0;

    console.log(`[SUSPENSAO] Buscando análise (corte: ${dataCorteStr}, empresas: ${usarFiltroEmpresas ? empresasSel.join(',') : 'all'})`);

    // 1. Produtos com vendas no ano (sem função — rápido)
    const vendidosResult = await pool.query(
      `SELECT DISTINCT cd_produto FROM vr_tra_transitem WHERE dt_transacao >= $1`,
      [dataInicio]
    );
    const vendidosArray = vendidosResult.rows.map(r => r.cd_produto);
    if (vendidosArray.length === 0) return { referencias: [], meses: [], corteYearMonth: dataCorteStr.slice(0, 7), dataCorte: dataCorteStr, totalReferencias: 0 };

    console.log(`[SUSPENSAO] ${vendidosArray.length} produtos com vendas`);

    // 2. Detalhes de todos os vendidos (referência, grupo, suspenso)
    const detalhesMap = await this.getDetalhesProdutos(vendidosArray);

    // 3. Referências que têm ao menos 1 SKU suspenso
    const refComSuspenso = new Set();
    detalhesMap.forEach((detalhe) => {
      if (detalhe.suspenso && detalhe.referencia && detalhe.referencia !== 'SEM REF') {
        refComSuspenso.add(detalhe.referencia);
      }
    });

    console.log(`[SUSPENSAO] ${refComSuspenso.size} referências com suspenso`);
    if (refComSuspenso.size === 0) return { referencias: [], meses: [], corteYearMonth: dataCorteStr.slice(0, 7), dataCorte: dataCorteStr, totalReferencias: 0 };

    // 4. SKUs pertencentes a essas referências
    const skusNasRefs = vendidosArray.filter(cd => {
      const d = detalhesMap.get(Number(cd));
      return d && refComSuspenso.has(d.referencia);
    });

    console.log(`[SUSPENSAO] ${skusNasRefs.length} SKUs nas referências`);

    // 5. Vendas mensais para esses SKUs (2 queries: transações + pedidos)
    const params = usarFiltroEmpresas ? [skusNasRefs, dataInicio, empresasSel] : [skusNasRefs, dataInicio];
    const empTrans = usarFiltroEmpresas ? 'AND T.cd_empresa = ANY($3)' : '';
    const empPed   = usarFiltroEmpresas ? 'AND 1 = ANY($3)' : '';

    const [transResult, pedResult] = await Promise.all([
      pool.query(`
        SELECT i.cd_produto,
          TO_CHAR(DATE_TRUNC('month', i.dt_transacao), 'YYYY-MM') AS mes,
          SUM(i.qt_solicitada * CASE WHEN T.tp_modalidade = '3' THEN -1 ELSE 1 END) AS qt_liquida,
          SUM(i.vl_totalliquido * CASE WHEN T.tp_modalidade = '3' THEN -1 ELSE 1 END) AS vl_total
        FROM vr_tra_transacao T
        JOIN vr_tra_transitem i ON T.nr_transacao = i.nr_transacao AND T.cd_empresa = i.cd_empresa
        WHERE T.cd_empresa <> 1 ${empTrans}
          AND i.cd_produto = ANY($1)
          AND i.dt_transacao >= $2
          AND T.cd_operacao NOT IN (140,76,25,26,27,273,44,240,241,242,243,244,245,239,238,237,236)
          AND i.cd_compvend <> 1 AND T.tp_situacao <> 6 AND T.tp_modalidade IN ('3','4')
        GROUP BY i.cd_produto, DATE_TRUNC('month', i.dt_transacao)
      `, params),

      pool.query(`
        SELECT i.cd_produto,
          TO_CHAR(DATE_TRUNC('month', C.dt_pedido), 'YYYY-MM') AS mes,
          SUM(i.qt_solicitada) AS qt_liquida,
          SUM(i.vl_solicitado) AS vl_total
        FROM vr_ped_pedidoc2 C
        LEFT JOIN vr_ped_pedidoi i ON C.cd_empresa = i.cd_empresa AND i.cd_pedido = C.cd_pedido
        WHERE C.dt_pedido >= $2
          AND i.cd_produto = ANY($1)
          AND C.cd_cliente <> 110000001 AND C.cd_representant <> 32098
          AND C.tp_situacao <> 6 AND C.cd_empresa = 1 ${empPed}
          AND C.cd_operacao IN (1,18,52,166,148,98,55,97,30,79,93,137,141,142,156,159,310,598,180,58,69,85,124,182)
        GROUP BY i.cd_produto, DATE_TRUNC('month', C.dt_pedido)
      `, params)
    ]);

    // 6. Agregar por SKU + mês
    const vendasPorSkuMes = new Map();
    const todosOsMesesSet = new Set();

    [...transResult.rows, ...pedResult.rows].forEach(row => {
      const cd = Number(row.cd_produto);
      if (!vendasPorSkuMes.has(cd)) vendasPorSkuMes.set(cd, new Map());
      const mesMap = vendasPorSkuMes.get(cd);
      const atual = mesMap.get(row.mes) || { qt_liquida: 0, vl_total: 0 };
      mesMap.set(row.mes, {
        qt_liquida: atual.qt_liquida + parseFloat(row.qt_liquida || 0),
        vl_total: atual.vl_total + parseFloat(row.vl_total || 0)
      });
      todosOsMesesSet.add(row.mes);
    });

    const mesesOrdenados = Array.from(todosOsMesesSet).sort();
    const corteYearMonth = dataCorteStr.slice(0, 7); // ex: '2026-03'

    // 7. Agrupar por referência
    const refsMap = new Map();
    skusNasRefs.forEach(cd => {
      const cdNum = Number(cd);
      const d = detalhesMap.get(cdNum) || {};
      const ref = d.referencia || 'SEM REF';
      const isSuspenso = Boolean(d.suspenso);
      const skuMeses = vendasPorSkuMes.get(cdNum) || new Map();

      if (!refsMap.has(ref)) {
        refsMap.set(ref, {
          referencia: ref, grupo: d.grupo || '-',
          totalSkus: 0, skusSuspensos: 0,
          meses: {}, skus: []
        });
      }

      const r = refsMap.get(ref);
      r.totalSkus++;
      if (isSuspenso) r.skusSuspensos++;

      const skuMesesData = {};
      mesesOrdenados.forEach(mes => {
        const v = skuMeses.get(mes) || { qt_liquida: 0, vl_total: 0 };
        if (!r.meses[mes]) {
          r.meses[mes] = { qt_liquida: 0, vl_total: 0, suspensos: { qt_liquida: 0, vl_total: 0 } };
        }
        r.meses[mes].qt_liquida += v.qt_liquida;
        r.meses[mes].vl_total += v.vl_total;
        if (isSuspenso) {
          r.meses[mes].suspensos.qt_liquida += v.qt_liquida;
          r.meses[mes].suspensos.vl_total += v.vl_total;
        }
        skuMesesData[mes] = {
          qt_liquida: Math.round(v.qt_liquida),
          vl_total: Math.round(v.vl_total * 100) / 100
        };
      });

      r.skus.push({
        cd_produto: cdNum,
        descricao: d.descricao || '-',
        cor: d.cor || '-',
        tam: d.tam || '-',
        suspenso: isSuspenso,
        meses: skuMesesData
      });
    });

    // 8. Formatar e ordenar por valor dos suspensos antes do corte
    const referencias = Array.from(refsMap.values()).map(r => ({
      referencia: r.referencia,
      grupo: r.grupo,
      totalSkus: r.totalSkus,
      skusSuspensos: r.skusSuspensos,
      meses: Object.fromEntries(
        Object.entries(r.meses).map(([mes, v]) => [mes, {
          qt_liquida: Math.round(v.qt_liquida),
          vl_total: Math.round(v.vl_total * 100) / 100,
          suspensos: {
            qt_liquida: Math.round(v.suspensos.qt_liquida),
            vl_total: Math.round(v.suspensos.vl_total * 100) / 100
          }
        }])
      ),
      skus: r.skus.sort((a, b) => {
        const somaA = mesesOrdenados.filter(m => m <= corteYearMonth).reduce((s, m) => s + (a.meses[m]?.vl_total || 0), 0);
        const somaB = mesesOrdenados.filter(m => m <= corteYearMonth).reduce((s, m) => s + (b.meses[m]?.vl_total || 0), 0);
        return somaB - somaA;
      })
    })).sort((a, b) => {
      const somaA = mesesOrdenados.filter(m => m <= corteYearMonth).reduce((s, m) => s + (a.meses[m]?.suspensos?.vl_total || 0), 0);
      const somaB = mesesOrdenados.filter(m => m <= corteYearMonth).reduce((s, m) => s + (b.meses[m]?.suspensos?.vl_total || 0), 0);
      return somaB - somaA;
    });

    return {
      referencias,
      meses: mesesOrdenados,
      corteYearMonth,
      dataCorte: dataCorteStr,
      totalReferencias: referencias.length
    };
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
      empresasKey: 'all',
      timestamp: null,
      ttl: 60 * 60 * 1000,
      loading: false
    };
    referenciasCache.clear();
    try { fs.unlinkSync(CACHE_FILE); } catch (_) {}
    console.log('[CACHE] Todos os caches foram limpos');
  }
};

module.exports = produtoService;

