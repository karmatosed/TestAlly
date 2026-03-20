import express from 'express';

const app = express();
const PORT = process.env.API_PORT ?? 3001;

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`TestAlly server running on port ${PORT}`);
});
