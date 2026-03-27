# Guia de Deploy no Render

## Pré-requisitos

1. Conta no [Render](https://render.com) (gratuita)
2. Conta no [GitHub](https://github.com) (se ainda não tiver)
3. Git instalado localmente

## Passo 1: Preparar o Repositório Git

Se ainda não tiver um repositório Git, execute:

```bash
cd c:\Users\ce_lu\representatividade-app
git init
git add .
git commit -m "Initial commit - ready for deploy"
```

Depois, crie um repositório no GitHub e faça o push:

```bash
git remote add origin https://github.com/SEU-USUARIO/representatividade-app.git
git branch -M main
git push -u origin main
```

## Passo 2: Criar Banco de Dados PostgreSQL no Render

1. Acesse [Render Dashboard](https://dashboard.render.com/)
2. Clique em **"New +"** → **"PostgreSQL"**
3. Preencha os dados:
   - **Name**: `representatividade-db`
   - **Database**: `representatividade`
   - **User**: `representatividade_user`
   - **Region**: Oregon (US West)
   - **Plan**: Free
4. Clique em **"Create Database"**
5. Aguarde a criação (1-2 minutos)
6. Copie a **Internal Database URL** (você vai precisar)

### Inicializar o Banco de Dados

1. No painel do banco de dados, clique em **"Connect"** → **"External Connection"**
2. Use um cliente PostgreSQL (como DBeaver, pgAdmin ou psql) para conectar
3. Execute o script [backend/init.sql](backend/init.sql) para criar as tabelas

**Ou use o PSQL Command direto no Render:**
```bash
psql -h <HOST> -U representatividade_user -d representatividade -f backend/init.sql
```

## Passo 3: Deploy do Backend (API)

1. No Render Dashboard, clique em **"New +"** → **"Web Service"**
2. Conecte seu repositório do GitHub
3. Configure o serviço:
   - **Name**: `representatividade-backend`
   - **Region**: Oregon (US West)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. **Variáveis de Ambiente** (Environment Variables):
   Clique em "Advanced" e adicione:
   ```
   NODE_ENV=production
   PORT=3001
   DB_HOST=<host do seu banco>
   DB_PORT=5432
   DB_NAME=representatividade
   DB_USER=representatividade_user
   DB_PASSWORD=<senha do banco>
   ```

   **Dica**: Use a Internal Database URL copiada anteriormente para extrair os valores.

5. Clique em **"Create Web Service"**
6. Aguarde o deploy (3-5 minutos)
7. Copie a URL do backend (será algo como: `https://representatividade-backend.onrender.com`)

### Testar o Backend

Acesse no navegador:
```
https://representatividade-backend.onrender.com/api/health
```

Deve retornar:
```json
{
  "status": "ok",
  "timestamp": "2026-03-27T..."
}
```

## Passo 4: Deploy do Frontend (Next.js)

1. No Render Dashboard, clique em **"New +"** → **"Web Service"**
2. Conecte o mesmo repositório do GitHub
3. Configure o serviço:
   - **Name**: `representatividade-frontend`
   - **Region**: Oregon (US West)
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. **Variáveis de Ambiente**:
   ```
   NEXT_PUBLIC_API_URL=https://representatividade-backend.onrender.com/api
   ```

   **IMPORTANTE**: Substitua pela URL real do seu backend criado no Passo 3!

5. Clique em **"Create Web Service"**
6. Aguarde o deploy (5-10 minutos - Next.js demora mais)
7. Seu app estará disponível em: `https://representatividade-frontend.onrender.com`

## Passo 5: Configurar CORS no Backend (se necessário)

Se tiver problemas de CORS, verifique se o backend está configurado corretamente. O arquivo [backend/src/index.js](backend/src/index.js) já usa `cors()`, mas você pode especificar a origem:

```javascript
app.use(cors({
  origin: 'https://representatividade-frontend.onrender.com'
}));
```

## Atualizações Futuras

Sempre que fizer mudanças no código:

```bash
git add .
git commit -m "Descrição das mudanças"
git push origin main
```

O Render detectará automaticamente e fará o redeploy!

## Planos Free - Limitações

- O banco de dados free expira após 90 dias
- Os serviços dormem após 15 minutos de inatividade
- Primeira requisição após dormir pode demorar 30-60 segundos
- Limite de 750 horas/mês por serviço

## Alternativa: Deploy via Blueprint (render.yaml)

Você também pode usar o arquivo [render.yaml](render.yaml) criado na raiz do projeto:

1. No Render Dashboard, clique em **"New +"** → **"Blueprint"**
2. Conecte seu repositório
3. O Render detectará automaticamente o `render.yaml`
4. Clique em **"Apply"**
5. Todos os serviços serão criados automaticamente!

Essa é a forma mais rápida!

## Problemas Comuns

### Backend não conecta ao banco
- Verifique as credenciais do banco nas variáveis de ambiente
- Certifique-se que está usando a **Internal Database URL**

### Frontend não conecta ao backend
- Verifique se `NEXT_PUBLIC_API_URL` está correto
- Teste a URL do backend diretamente no navegador

### Erro 503 ou serviço offline
- Serviços free dormem após inatividade
- Aguarde 30-60 segundos para "acordar"

## Suporte

- [Documentação Render](https://render.com/docs)
- [Render Community](https://community.render.com/)

---

Bom deploy! 🚀
