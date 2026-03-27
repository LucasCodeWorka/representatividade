const express = require('express');
const router = express.Router();

const flagsService = require('../services/flagsService');

router.get('/', async (_req, res) => {
  try {
    const flags = await flagsService.listFlags();
    res.json({ success: true, total: flags.length, flags });
  } catch (error) {
    console.error('Erro ao listar flags:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar flags',
      message: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const flag = await flagsService.createFlag(req.body);
    res.status(201).json({ success: true, flag });
  } catch (error) {
    console.error('Erro ao criar flag:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar flag',
      message: error.message
    });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const flag = await flagsService.updateFlag(req.params.id, req.body);
    res.json({ success: true, flag });
  } catch (error) {
    console.error('Erro ao atualizar flag:', error);
    const status = error.message === 'Flag nao encontrada' ? 404 : 500;
    res.status(status).json({
      success: false,
      error: 'Erro ao atualizar flag',
      message: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await flagsService.deleteFlag(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir flag:', error);
    const status = error.message === 'Flag nao encontrada' ? 404 : 500;
    res.status(status).json({
      success: false,
      error: 'Erro ao excluir flag',
      message: error.message
    });
  }
});

module.exports = router;
