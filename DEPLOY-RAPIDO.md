# Deploy Rápido no Render - Guia Express

Seu repositório: https://github.com/LucasCodeWorka/representatividade.git

## Passos Rápidos (15 minutos)

### 1. Commit e Push dos Arquivos de Configuração

```bash
cd c:\Users\ce_lu\representatividade-app
git add .
git commit -m "Adiciona configuração para deploy no Render"
git push origin main
```

### 2. Deploy via Blueprint (Mais Fácil!)

1. Acesse: https://dashboard.render.com/
2. Clique em **"New +"** → **"Blueprint"**
3. Conecte com GitHub (autorize o Render)
4. Selecione o repositório: **representatividade**
5. O Render detectará automaticamente o arquivo `render.yaml`
6. Clique em **"Apply"**
7. Aguarde! O Render criará:
   - Banco de dados PostgreSQL
   - Backend (API)
   - Frontend (Next.js)

### 3. Inicializar o Banco de Dados

Após a criação do banco:

1. No Dashboard do Render, vá em **"representatividade-db"**
2. Clique na aba **"Connect"**
3. Copie o comando **"External Connection"**
4. Use o PSQL ou DBeaver para conectar
5. Execute o arquivo `backend/init.sql`

**Ou via PSQL:**
```bash
# Substitua pelos dados de conexão do seu banco
psql postgresql://representatividade_user:SENHA@HOST/representatividade < backend/init.sql
```

### 4. Atualizar URL do Backend no Frontend

Após o backend estar rodando:

1. Copie a URL do backend (ex: `https://representatividade-backend-abcd.onrender.com`)
2. No Render Dashboard, vá em **"representatividade-frontend"**
3. Clique em **"Environment"**
4. Edite a variável `NEXT_PUBLIC_API_URL` com a URL correta
5. Clique em **"Save Changes"**
6. O Render fará redeploy automaticamente

### 5. Testar!

- **Backend**: `https://SEU-BACKEND.onrender.com/api/health`
- **Frontend**: `https://SEU-FRONTEND.onrender.com`

## Importante

- Primeira requisição pode demorar 30-60s (serviço "acordando")
- Banco de dados free expira em 90 dias
- Anote as URLs dos serviços para referência

## Se Algo der Errado

Veja os logs no Dashboard:
1. Clique no serviço com problema
2. Aba **"Logs"**
3. Procure por erros em vermelho

---

Qualquer problema, consulte o [DEPLOY-RENDER.md](DEPLOY-RENDER.md) completo!
