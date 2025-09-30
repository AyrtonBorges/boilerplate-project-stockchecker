'use strict';
const https = require('https');
const crypto = require('crypto');

module.exports = function (app) {
  // Armazenamento em memória: { SYMBOL -> Set(hashIp) }
  const likesByStock = new Map();

  function hashIp(ip) {
    return crypto.createHash('sha256').update(String(ip || '')).digest('hex').slice(0, 32);
  }

  function getClientIpHash(req) {
    // Express com trust proxy habilitado
    const ip = req.ip || req.connection?.remoteAddress || '';
    return hashIp(ip);
  }

  function getLikesCount(symbol, ipHashToAddOrNull) {
    const key = symbol.toUpperCase();
    if (!likesByStock.has(key)) likesByStock.set(key, new Set());
    const set = likesByStock.get(key);
    if (ipHashToAddOrNull) set.add(ipHashToAddOrNull);
    return set.size;
  }

  function getStockPrice(symbol) {
    const sym = symbol.toUpperCase();
    const url = `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${sym}/quote`;
    return new Promise((resolve) => {
      https
        .get(url, (r) => {
          let data = '';
          r.on('data', (d) => (data += d));
          r.on('end', () => {
            try {
              const j = JSON.parse(data);
              const price =
                Number(j.latestPrice ??
                  j.close ??
                  j.iexClose ??
                  j.delayedPrice ??
                  j.previousClose);
              resolve(Number.isFinite(price) ? price : 0);
            } catch {
              resolve(0);
            }
          });
        })
        .on('error', () => resolve(0));
    });
  }

  app.route('/api/stock-prices').get(async function (req, res) {
    try {
      let { stock, like } = req.query;
      const likeFlag =
        like === true ||
        like === 'true' ||
        like === '1' ||
        like === 'on';

      const ipHash = likeFlag ? getClientIpHash(req) : null;

      // Dois símbolos: stock=GOOG&stock=MSFT
      if (Array.isArray(stock)) {
        const s1 = String(stock[0] || '').toUpperCase();
        const s2 = String(stock[1] || '').toUpperCase();

        const [p1, p2] = await Promise.all([getStockPrice(s1), getStockPrice(s2)]);

        const l1 = getLikesCount(s1, ipHash);
        const l2 = getLikesCount(s2, ipHash);

        return res.json({
          stockData: [
            { stock: s1, price: p1, rel_likes: l1 - l2 },
            { stock: s2, price: p2, rel_likes: l2 - l1 }
          ]
        });
      }

      // Um símbolo: stock=GOOG
      const sym = String(stock || '').toUpperCase();
      const price = await getStockPrice(sym);
      const likes = getLikesCount(sym, ipHash);

      return res.json({
        stockData: { stock: sym, price, likes }
      });
    } catch (e) {
      return res.status(500).json({ error: 'internal error' });
    }
  });
};
