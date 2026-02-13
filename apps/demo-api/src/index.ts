import { Hono } from 'hono';

const app = Hono();

app.get('/', (c) => c.text('Hello from Demo API!'));

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

app.get('/api/greet/:name', (c) => {
  const name = c.req.param('name');
  return c.json({ message: `Hello, ${name}!` });
});

export default app;
