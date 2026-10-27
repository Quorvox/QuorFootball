// Мини-замена Express для приложения без сервера: ровно то, что используют наши маршруты.
// Router(), use(), get/post/put/delete, параметры вида :id, next(), res.status().json().

function compile(path) {
  const keys = [];
  const src = path.replace(/\/:([A-Za-z0-9_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; });
  return { re: new RegExp('^' + src + '/?$'), keys };
}

class Router {
  constructor() { this.stack = []; }

  use(fn) {
    if (fn instanceof Router) this.stack.push({ mw: (req, res, next) => fn.handle(req, res, next) });
    else this.stack.push({ mw: fn });
    return this;
  }

  handle(req, res, done) {
    let i = 0;
    const next = (err) => {
      if (err) return done(err);
      const layer = this.stack[i++];
      if (!layer) return done();
      try {
        if (layer.mw) return Promise.resolve(layer.mw(req, res, next)).catch(done);
        if (layer.method !== req.method) return next();
        const m = layer.re.exec(req.path);
        if (!m) return next();
        req.params = {};
        layer.keys.forEach((k, n) => { req.params[k] = decodeURIComponent(m[n + 1]); });
        let j = 0;
        const run = (e) => {
          if (e) return done(e);
          const fn = layer.fns[j++];
          if (!fn) return next();
          return Promise.resolve(fn(req, res, run)).catch(done);
        };
        return run();
      } catch (e) { return done(e); }
    };
    next();
  }
}

for (const method of ['get', 'post', 'put', 'delete']) {
  Router.prototype[method] = function (path, ...fns) {
    this.stack.push({ method: method.toUpperCase(), ...compile(path), fns });
    return this;
  };
}

function express() { throw new Error('В приложении express() не нужен, только Router'); }
express.Router = () => new Router();
express.json = () => (req, res, next) => next();

module.exports = express;
module.exports.Router = express.Router;
