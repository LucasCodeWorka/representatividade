const express = require('express');
const router = express.Router();
const produtoService = require('../services/produtoService');

// GET /api/produtos/representatividade
// Retorna análise Pareto com todos os dados
router.get('/representatividade', async (req, res) => {
  try {
    const ano = parseInt(req.query.ano) || 2026;
    const aplicarFiltro = req.query.filtro !== 'false';
    const empresas = typeof req.query.empresas === 'string' && req.query.empresas.trim() !== ''
      ? req.query.empresas.split(',').map(e => parseInt(e, 10)).filter(Number.isInteger)
      : [];

    console.log(`Buscando representatividade para ${ano} (filtro: ${aplicarFiltro}, empresas: ${empresas.length > 0 ? empresas.join(',') : 'all'})`);

    const resultado = await produtoService.getRepresentatividade(ano, aplicarFiltro, empresas);

    res.json({
      success: true,
      ano,
      ...resultado
    });
  } catch (error) {
    console.error('Erro no endpoint representatividade:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar representatividade',
      message: error.message
    });
  }
});

// GET /api/produtos/empresas
// Lista empresas disponiveis para filtro
router.get('/empresas', async (req, res) => {
  try {
    const empresas = await produtoService.getEmpresas();
    res.json({ success: true, total: empresas.length, empresas });
  } catch (error) {
    console.error('Erro no endpoint empresas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar empresas',
      message: error.message
    });
  }
});

// GET /api/produtos/classificacao
// Retorna lista de produtos classificados (EM LINHA e não EDICAO LIMITADA)
router.get('/classificacao', async (req, res) => {
  try {
    const ano = parseInt(req.query.ano) || 2026;

    console.log(`Buscando classificação para ${ano}`);

    const produtos = await produtoService.getProdutosClassificados(ano);

    res.json({
      success: true,
      ano,
      total: produtos.length,
      produtos
    });
  } catch (error) {
    console.error('Erro no endpoint classificação:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar classificação',
      message: error.message
    });
  }
});

// GET /api/produtos/vendas
// Retorna vendas agregadas por produto
router.get('/vendas', async (req, res) => {
  try {
    const ano = parseInt(req.query.ano) || 2026;

    console.log(`Buscando vendas para ${ano}`);

    const vendas = await produtoService.getVendasPorProduto(ano);

    res.json({
      success: true,
      ano,
      total: vendas.length,
      vendas
    });
  } catch (error) {
    console.error('Erro no endpoint vendas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar vendas',
      message: error.message
    });
  }
});

// GET /api/produtos/referencia/:referencia
// Retorna SKUs com venda de uma referência com representatividade
router.get('/referencia/:referencia', async (req, res) => {
  try {
    const { referencia } = req.params;
    const ano = parseInt(req.query.ano) || 2026;

    console.log(`Buscando SKUs da referência ${referencia} para ${ano}`);

    const resultado = await produtoService.getSkusPorReferencia(referencia, ano);

    res.json({
      success: true,
      referencia,
      ano,
      ...resultado
    });
  } catch (error) {
    console.error('Erro no endpoint referência:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar SKUs da referência',
      message: error.message
    });
  }
});

// GET /api/produtos/cache/status
// Retorna status do cache
router.get('/cache/status', (req, res) => {
  const status = produtoService.getStatusCache();
  res.json({ success: true, ...status });
});

// POST /api/produtos/cache/carregar
// Pré-carrega o cache completo
router.post('/cache/carregar', async (req, res) => {
  try {
    const ano = parseInt(req.body.ano) || 2026;
    console.log(`[CACHE] Requisição de pré-carregamento para ano ${ano}`);

    const resultado = await produtoService.preCarregarCache(ano);

    res.json({
      success: true,
      message: 'Cache carregado com sucesso!',
      ...resultado
    });
  } catch (error) {
    console.error('Erro ao pré-carregar cache:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao carregar cache',
      message: error.message
    });
  }
});

// POST /api/produtos/cache/limpar
// Limpa todos os caches
router.post('/cache/limpar', (req, res) => {
  produtoService.limparCache();
  res.json({ success: true, message: 'Cache limpo com sucesso' });
});

// POST /api/produtos/cache/force-reload
// Força recalculo IMEDIATO sem usar cache
router.post('/cache/force-reload', async (req, res) => {
  try {
    console.log('[FORCE RELOAD] Limpando cache...');
    produtoService.limparCache();

    console.log('[FORCE RELOAD] Recalculando representatividade...');
    const ano = parseInt(req.body.ano) || 2026;
    const resultado = await produtoService.getRepresentatividade(ano, true, []);

    res.json({
      success: true,
      message: 'Cache recarregado com dados frescos',
      totalProdutos: resultado.produtos.length,
      amostra: resultado.produtos[0]
    });
  } catch (error) {
    console.error('[FORCE RELOAD] Erro:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
