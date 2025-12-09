import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// API route handler plugin
function apiPlugin(): Plugin {
  return {
    name: 'api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res, next) => {
        if (req.method === 'POST') {
          try {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', async () => {
              try {
                console.log('Processing chat request, body length:', body.length);
                const { handleChatRequest } = await import('./src/api/chat.ts');
                const request = new Request('http://localhost/api/chat', {
                  method: 'POST',
                  headers: req.headers as Record<string, string>,
                  body: body,
                });
                const response = await handleChatRequest(request);
                
                console.log('Response status:', response.status);
                
                // Set status and headers
                res.statusCode = response.status;
                response.headers.forEach((value, key) => {
                  res.setHeader(key, value);
                });
                
                // Stream the response body
                if (response.body) {
                  const reader = response.body.getReader();
                  const pump = async () => {
                    try {
                      while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                          res.end();
                          break;
                        }
                        res.write(Buffer.from(value));
                      }
                    } catch (err) {
                      console.error('Stream error:', err);
                      res.end();
                    }
                  };
                  await pump();
                } else {
                  console.log('No response body');
                  res.end();
                }
              } catch (err) {
                console.error('Request processing error:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Internal server error', details: err instanceof Error ? err.message : String(err) }));
              }
            });
          } catch (error) {
            console.error('API error:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        } else {
          next();
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    tailwindcss(),
    apiPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@core": path.resolve(__dirname, "../core")
    },
  },
})
