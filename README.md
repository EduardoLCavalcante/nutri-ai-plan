# Nutri AI Plan

Aplicativo educacional para criar um plano alimentar diário e tirar dúvidas de nutrição. As chamadas à IA usam o modelo `openai/gpt-oss-20b` na Groq por meio do servidor Node; a chave de acesso nunca deve ser colocada em variáveis `VITE_*` nem no navegador.

## Sua ação: configurar a chave Groq

1. Revogue a chave antiga do Hugging Face compartilhada no chat, caso ainda esteja ativa.
2. Crie uma chave em [Groq API Keys](https://console.groq.com/keys) e confira o acesso ao modelo [`openai/gpt-oss-20b`](https://console.groq.com/docs/model/openai/gpt-oss-20b).
3. Copie `.env.example` para `.env.local` e preencha `GROQ_API_KEY`. `.env.local` está ignorado pelo Git. Em produção, configure `GROQ_API_KEY` como segredo do ambiente Node.

```sh
npm ci
npm run dev
```

O projeto requer Node.js 22.9 ou superior. Em desenvolvimento, o site abre em `http://127.0.0.1:8080`; o Vite encaminha `/api` para o servidor Node em `127.0.0.1:3001`. Reinicie `npm run dev` após mudar `.env.local`. Sem chave, o site abre, mas as ações de IA exibem um erro de configuração.

## Produção

```sh
npm ci
npm run build
npm start
```

`npm start` serve a pasta `dist` e os endpoints `/api` no mesmo host. A porta padrão é 3001; configure `PORT` e `HOST` conforme seu servidor. O `HOST` padrão em produção é `0.0.0.0`; em desenvolvimento, a API escuta somente no loopback. Coloque HTTPS e limites adicionais de tráfego no proxy/serviço de hospedagem quando publicar.

Uma hospedagem que publica apenas arquivos estáticos, inclusive o fluxo de publicação estática do Lovable, **não executa** `server/index.mjs`; nela, `/api/meal-plan` e `/api/chat` não funcionarão. Use uma hospedagem Node para o site e a API juntos ou adapte os endpoints a funções de servidor da plataforma, mantendo `GROQ_API_KEY` exclusivamente no servidor.

## Verificação

```sh
npm run test:server
npm run lint
npm run build
```

Os testes do servidor simulam a Groq e não precisam de chave real. Para gerar respostas, idade, medidas, objetivo, restrições, plano e mensagens de chat são enviados ao provedor de IA; o nome informado no formulário fica apenas no navegador. Planos e respostas de chat são educacionais e não substituem acompanhamento de nutricionista.
