const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

suite('Functional Tests', function () {
  // dá folga para rede + runner do FCC
  this.timeout(20000);

  let firstLikesCount;

  test('Viewing one stock: GET /api/stock-prices?stock=GOOG', function (done) {
    chai.request(server)
      .get('/api/stock-prices')
      .query({ stock: 'GOOG' })
      .end((err, res) => {
        assert.equal(res.status, 200);
        assert.isObject(res.body);
        assert.property(res.body, 'stockData');
        const sd = res.body.stockData;
        assert.isObject(sd);
        assert.property(sd, 'stock');
        assert.property(sd, 'price');
        assert.property(sd, 'likes');
        assert.isString(sd.stock);
        assert.isNumber(sd.price);
        assert.isNumber(sd.likes);
        assert.isAtLeast(sd.likes, 0);
        firstLikesCount = sd.likes;
        done();
      });
  });

  test('Viewing one stock and liking it: GET /api/stock-prices?stock=GOOG&like=true', function (done) {
    chai.request(server)
      .get('/api/stock-prices')
      .query({ stock: 'GOOG', like: true })
      .end((err, res) => {
        assert.equal(res.status, 200);
        const sd = res.body.stockData;
        assert.isObject(sd);
        assert.equal(sd.stock, 'GOOG');
        assert.isNumber(sd.price);
        assert.isNumber(sd.likes);
        // depois do like, deve ser >= ao valor anterior
        assert.isAtLeast(sd.likes, firstLikesCount);
        firstLikesCount = sd.likes;
        done();
      });
  });

  test('Viewing the same stock and liking it again: like should not double count', function (done) {
    chai.request(server)
      .get('/api/stock-prices')
      .query({ stock: 'GOOG', like: true })
      .end((err, res) => {
        assert.equal(res.status, 200);
        const sd = res.body.stockData;
        assert.equal(sd.stock, 'GOOG');
        assert.isNumber(sd.likes);
        // não pode contar 2x para o mesmo IP
        assert.equal(sd.likes, firstLikesCount);
        done();
      });
  });

  test('Viewing two stocks: GET /api/stock-prices?stock=GOOG&stock=MSFT', function (done) {
    chai.request(server)
      .get('/api/stock-prices')
      .query({ stock: ['GOOG', 'MSFT'] })
      .end((err, res) => {
        assert.equal(res.status, 200);
        assert.isObject(res.body);
        assert.property(res.body, 'stockData');
        const arr = res.body.stockData;
        assert.isArray(arr);
        assert.lengthOf(arr, 2);

        for (const item of arr) {
          assert.property(item, 'stock');
          assert.property(item, 'price');
          assert.property(item, 'rel_likes');
          assert.isString(item.stock);
          assert.isNumber(item.price);
          assert.isNumber(item.rel_likes);
        }

        // os relativos devem se anular
        assert.equal(arr[0].rel_likes + arr[1].rel_likes, 0);
        done();
      });
  });

  test('Viewing two stocks and liking them: GET /api/stock-prices?stock=GOOG&stock=MSFT&like=true', function (done) {
    chai.request(server)
      .get('/api/stock-prices')
      .query({ stock: ['GOOG', 'MSFT'], like: true })
      .end((err, res) => {
        assert.equal(res.status, 200);
        const arr = res.body.stockData;
        assert.isArray(arr);
        assert.lengthOf(arr, 2);
        assert.isNumber(arr[0].rel_likes);
        assert.isNumber(arr[1].rel_likes);
        // não exigimos "0/0" (ambiente pode já ter likes prévios);
        // exigimos que sejam opostos (definição de rel_likes)
        assert.equal(arr[0].rel_likes + arr[1].rel_likes, 0);
        done();
      });
  });
});
