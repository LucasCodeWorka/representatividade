-- Script de inicialização do banco de dados
-- Execute este script após criar o banco de dados PostgreSQL no Render

-- Criação da tabela de produtos (exemplo)
-- Ajuste conforme sua estrutura real de banco de dados

CREATE TABLE IF NOT EXISTS produtos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  codigo VARCHAR(100),
  categoria VARCHAR(100),
  valor_vendido DECIMAL(10, 2),
  quantidade INTEGER,
  data_venda DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Adicione aqui outras tabelas que seu sistema precisa
-- CREATE TABLE IF NOT EXISTS ...

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria);
CREATE INDEX IF NOT EXISTS idx_produtos_data_venda ON produtos(data_venda);
