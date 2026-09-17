import { createAppServer } from './app.mjs';

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT deve ser um número entre 1 e 65535.');
  process.exit(1);
}

const host = process.env.NUTRI_DEV === '1' ? '127.0.0.1' : (process.env.HOST || '0.0.0.0');
const server = createAppServer();
server.listen(port, host, () => {
  console.log(`Servidor ativo em http://${host}:${port}`);
  if (!process.env.GROQ_API_KEY) {
    console.warn('GROQ_API_KEY ausente: configure sua chave Groq no arquivo .env.local.');
  }
});
