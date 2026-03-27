# Deploy Rápido no Render - Guia Express

Seu repositório: https://github.com/LucasCodeWorka/representatividade.git

## Passos Rápidos (10 minutos)

### 1. Deploy via Blueprint (SUPER FÁCIL!)

1. Acesse: https://dashboard.render.com/
2. Clique em **"New +"** → **"Blueprint"**
3. Conecte com GitHub (autorize o Render)
4. Selecione o repositório: **LucasCodeWorka/representatividade**
5. O Render detectará automaticamente o arquivo `render.yaml`
6. Clique em **"Apply"**
7. Aguarde! O Render criará:
   - Backend (API) - já configurado com seu banco de dados existente
   - Frontend (Next.js)

**OBS**: Você não precisa criar banco de dados, o sistema já está configurado para usar o seu banco existente em `dbexp.vcenter.com.br`

### 2. Atualizar URL do Backend no Frontend

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
