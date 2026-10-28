import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import 'dotenv/config'
import fs from 'fs'
import path from 'path'

function contentDevApiPlugin(): Plugin {
  return {
    name: 'content-dev-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();

        // 1. Content Intelligence: Analyze Idea
        if (req.method === 'POST' && req.url === '/api/content-intelligence/analyze-idea') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const { handleAnalyzeIdea } = await import('./api/content_intelligence.js');
              const body = JSON.parse(bodyStr || '{}');
              const result = await handleAnalyzeIdea(body);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = typeof result.status === 'number' ? result.status : 200;
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 2. Content Intelligence: Video File Upload
        if (req.method === 'POST' && req.url.startsWith('/api/content-intelligence/upload-video')) {
          const uploadDir = path.join(process.cwd(), 'uploads', 'content_videos');
          if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

          const urlObj = new URL(req.url, 'http://localhost');
          const rawFilename = urlObj.searchParams.get('filename') || 'uploaded_video.mp4';
          const cleanExt = path.extname(rawFilename).toLowerCase() || '.mp4';
          const safeExt = ['.mp4', '.mov', '.webm', '.m4v'].includes(cleanExt) ? cleanExt : '.mp4';
          const targetFilename = `video_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${safeExt}`;
          const targetPath = path.join(uploadDir, targetFilename);

          const writeStream = fs.createWriteStream(targetPath);
          req.pipe(writeStream);

          writeStream.on('finish', () => {
            const stats = fs.statSync(targetPath);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              videoFileUrl: `/uploads/content_videos/${targetFilename}`,
              fileName: rawFilename,
              fileSize: stats.size,
              fileFormat: safeExt.replace('.', '')
            }));
          });

          writeStream.on('error', (err: any) => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          });
          return;
        }

        // Static serve for uploads
        if (req.method === 'GET' && req.url.startsWith('/uploads/')) {
          const cleanUrl = req.url.split('?')[0];
          const filePath = path.join(process.cwd(), cleanUrl);
          if (fs.existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.mp4': 'video/mp4',
              '.mov': 'video/quicktime',
              '.webm': 'video/webm',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png'
            };
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }

        // 3. Content Intelligence: Analyze Reference
        if (req.method === 'POST' && req.url === '/api/content-intelligence/analyze-reference') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const { handleAnalyzeReference } = await import('./api/content_intelligence.js');
              const body = JSON.parse(bodyStr || '{}');
              const result = await handleAnalyzeReference(body);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = typeof result.status === 'number' ? result.status : 200;
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 4. Content Intelligence: Retrieve Video from URL (Apify)
        if (req.method === 'POST' && req.url === '/api/content-intelligence/retrieve-video') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const { handleRetrieveVideo } = await import('./api/content_intelligence.js');
              const body = JSON.parse(bodyStr || '{}');
              const result = await handleRetrieveVideo(body);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = typeof result.status === 'number' ? result.status : 200;
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 5. Content Intelligence: Improve Idea (Etapa 1)
        if (req.method === 'POST' && req.url === '/api/content-intelligence/improve-idea') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const { handleImproveIdea } = await import('./api/content_intelligence.js');
              const body = JSON.parse(bodyStr || '{}');
              const result = await handleImproveIdea(body);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = typeof result.status === 'number' ? result.status : 200;
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 6. Content Intelligence: Explore Formats (Etapa 2)
        if (req.method === 'POST' && req.url === '/api/content-intelligence/explore-formats') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const { handleExploreFormats } = await import('./api/content_intelligence.js');
              const body = JSON.parse(bodyStr || '{}');
              const result = await handleExploreFormats(body);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = typeof result.status === 'number' ? result.status : 200;
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 7. Content Intelligence: Develop Proposal (Etapa 3)
        if (req.method === 'POST' && req.url === '/api/content-intelligence/develop-proposal') {
          let bodyStr = '';
          req.on('data', chunk => { bodyStr += chunk; });
          req.on('end', async () => {
            try {
              const { handleDevelopProposal } = await import('./api/content_intelligence.js');
              const body = JSON.parse(bodyStr || '{}');
              const result = await handleDevelopProposal(body);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = typeof result.status === 'number' ? result.status : 200;
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 3. Content Kanban: Local Dev Persistence
        if (req.url === '/api/content-kanban') {
          const kanbanFile = path.join(process.cwd(), 'data', 'content_kanban.json');
          if (req.method === 'GET') {
            try {
              if (fs.existsSync(kanbanFile)) {
                const data = fs.readFileSync(kanbanFile, 'utf8');
                res.setHeader('Content-Type', 'application/json');
                res.end(data);
                return;
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ columns: [], cards: [] }));
              return;
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
              return;
            }
          }

          if (req.method === 'POST') {
            let bodyStr = '';
            req.on('data', chunk => { bodyStr += chunk; });
            req.on('end', () => {
              try {
                const body = JSON.parse(bodyStr || '{}');
                const dir = path.dirname(kanbanFile);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(kanbanFile, JSON.stringify(body, null, 2), 'utf8');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }
        }

        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), contentDevApiPlugin()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  server: {
    open: true, // Opens browser automatically
    host: true, // Listen on all local IPs
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
