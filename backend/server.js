// Email Header Analyzer - Ana sunucu giris noktasi
// Tum is mantigi routes/services/utils klasorlerine bolunmustur, bu dosya sadece kurulumdan sorumludur.

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');

const analyzeRouter = require('./routes/analyze');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '1mb' })); // Header metinleri buyuk olabilir, makul bir limit belirlendi
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// --- Route'lar ---
app.use('/api/analyze', analyzeRouter);

// --- 404 yakalayici ---
app.use((req, res) => {
  res.status(404).json({ error: 'Route bulunamadi.' });
});

// --- Merkezi hata yakalayici ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Gecersiz JSON govdesi (express.json) istemci hatasidir, 400 donmeli - 500 degil
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Istek govdesi gecerli bir JSON degil.' });
  }

  console.error('Beklenmeyen hata:', err);
  res.status(500).json({ error: 'Sunucu tarafinda beklenmeyen bir hata olustu.' });
});

app.listen(PORT, () => {
  console.log(`Email Header Analyzer sunucusu http://localhost:${PORT} adresinde calisiyor.`);
});
