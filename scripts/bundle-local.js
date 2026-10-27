// Собирает автономный слой (маршруты сервера + sql.js) в один файл для приложения и для тестов.
const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const at = (p) => path.join(root, p);

// что подменяем при сборке: серверные модули -> их версии для приложения
const SWAP = new Map([
  [at('db'), at('local/db.js')],
  [at('lib/auth'), at('local/auth.js')],
  [at('lib/files'), at('local/files.js')],
  [at('routes/reports'), at('local/reports.js')],
  [at('routes/notify'), at('local/notify.js')],
]);
const BARE = { express: at('local/express.js'), fs: at('local/stub-fs.js'), path: at('local/stub-path.js') };

const swapPlugin = {
  name: 'swap-server-modules',
  setup(build) {
    build.onResolve({ filter: /^(\.\.?\/|express$|fs$|path$)/ }, (args) => {
      if (BARE[args.path]) return { path: BARE[args.path] };
      if (!args.path.startsWith('.')) return null;
      const abs = path.resolve(args.resolveDir, args.path).replace(/\.js$/, '');
      return SWAP.has(abs) ? { path: SWAP.get(abs) } : null;
    });
  },
};

function bundle({ platform, outfile, minify }) {
  return esbuild.build({
    entryPoints: [at('local/index.js')],
    bundle: true,
    format: 'iife',
    platform,
    outfile,
    minify,
    target: platform === 'browser' ? ['chrome90'] : ['node22'],
    loader: { '.wasm': 'binary' },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [swapPlugin],
    logLevel: 'warning',
  });
}

module.exports = { bundle };

if (require.main === module) {
  bundle({ platform: 'browser', outfile: at('www/local-api.js'), minify: true }).then(() => console.log('local-api.js собран'));
}
