const express = require('express');
const router = express.Router();

const cenariosService = require('../services/cenariosService');

router.get('/', async (_req, res) => {
  try {
    const cenarios = await cenariosService.listScenarios();
    res.json({ success: true, total: cenarios.length, cenarios });
  } catch (error) {
    console.error('Erro ao listar cenarios:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar cenarios',
      message: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const cenario = await cenariosService.createScenario(req.body);
    res.status(201).json({ success: true, cenario });
  } catch (error) {
    console.error('Erro ao criar cenario:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar cenario',
      message: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await cenariosService.deleteScenario(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir cenario:', error);
    const status = error.message === 'Cenario nao encontrado' ? 404 : 500;
    res.status(status).json({
      success: false,
      error: 'Erro ao excluir cenario',
      message: error.message
    });
  }
});

module.exports = router;
