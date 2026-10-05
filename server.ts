import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  const configPath = path.resolve(__dirname, 'src/config/appConfig.json');

  // Read config endpoint
  app.get('/api/config', (_req, res) => {
    try {
      if (fs.existsSync(configPath)) {
        const data = fs.readFileSync(configPath, 'utf-8');
        return res.json(JSON.parse(data));
      }
    } catch (e) {
      console.error('Error reading appConfig.json:', e);
    }
    return res.json({
      spreadsheetId: '1Mt_gbSR3p7hvTGgQ5fXq5MjlECwbKiQGfwPvRkOIXVo',
      appsScriptUrl: 'https://script.google.com/macros/s/AKfycbxMRclYJPcwLfyqNsGkMJoC-foY321YO9V-WBRJnCT2dNsOZHxDpEEPt6MBqTNDBP6iUg/exec',
      orderSheetTab: 'Sheet2',
    });
  });

  // Save config endpoint - permanently writes to src/config/appConfig.json and src/services/sheets.ts
  app.post('/api/save-config', (req, res) => {
    try {
      const { spreadsheetId, appsScriptUrl, orderSheetTab } = req.body;
      let currentConfig: any = {};
      if (fs.existsSync(configPath)) {
        try {
          currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch {}
      }

      const updated = {
        spreadsheetId:
          spreadsheetId !== undefined && spreadsheetId !== null
            ? String(spreadsheetId).trim()
            : currentConfig.spreadsheetId || '',
        appsScriptUrl:
          appsScriptUrl !== undefined && appsScriptUrl !== null
            ? String(appsScriptUrl).trim()
            : currentConfig.appsScriptUrl || '',
        orderSheetTab:
          orderSheetTab !== undefined && orderSheetTab !== null
            ? String(orderSheetTab).trim()
            : currentConfig.orderSheetTab || 'Sheet2',
        updatedAt: new Date().toISOString(),
      };

      fs.mkdirSync(path.dirname(configPath), { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf-8');

      // Also permanently update default constants in src/services/sheets.ts
      const sheetsFilePath = path.resolve(__dirname, 'src/services/sheets.ts');
      if (fs.existsSync(sheetsFilePath)) {
        let sheetsCode = fs.readFileSync(sheetsFilePath, 'utf-8');
        if (updated.spreadsheetId) {
          sheetsCode = sheetsCode.replace(
            /export const DEFAULT_SPREADSHEET_ID = (appConfig\.spreadsheetId \|\| )?['"][^'"]+['"];/,
            `export const DEFAULT_SPREADSHEET_ID = appConfig.spreadsheetId || '${updated.spreadsheetId}';`
          );
        }
        if (updated.appsScriptUrl) {
          sheetsCode = sheetsCode.replace(
            /export const DEFAULT_APPS_SCRIPT_URL =\s*(appConfig\.appsScriptUrl \|\|\s*)?['"][^'"]+['"];/,
            `export const DEFAULT_APPS_SCRIPT_URL = appConfig.appsScriptUrl || '${updated.appsScriptUrl}';`
          );
        }
        fs.writeFileSync(sheetsFilePath, sheetsCode, 'utf-8');
      }

      return res.json({
        success: true,
        config: updated,
        message: 'কনফিগ কোডে স্থায়ীভাবে সংরক্ষণ করা হয়েছে',
      });
    } catch (err: any) {
      console.error('Failed to write appConfig.json and sheets.ts:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(__dirname, 'dist'));
  if (isProd) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
