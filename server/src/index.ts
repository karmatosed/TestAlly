import app from './app.js';
import { getLlmApiBaseUrl } from './lib/llmConfig.js';

const PORT = Number(process.env.API_PORT ?? 3001);

const server = app.listen(PORT, () => {
  console.log(`TestAlly server running on port ${PORT}`);
  const llmBase = getLlmApiBaseUrl();
  if (llmBase) {
    console.log(`LLM API base URL: ${llmBase.origin}`);
  } else {
    console.log(
      'LLM_API_URL not set — configure LLM_API_URL (and optional LLM_TOKEN) for generation',
    );
  }
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `\n[TestAlly] Port ${PORT} is already in use (EADDRINUSE). The API never starts, so Chat/infer cannot reach any LLM.\n` +
        `  • Stop whatever owns the port:  lsof -i :${PORT}   then kill that PID, or stop Docker using it.\n` +
        `  • Or use another port: set API_PORT=3002 in repo-root .env (Vite reads API_PORT for /api proxy).\n`,
    );
  }
});
