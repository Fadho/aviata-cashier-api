// cluster for production app
// You can comment out this file while testing
// this will ensure the backend app will run faster
const __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const cluster1 = __importDefault(require('cluster'));
const os1 = __importDefault(require('os'));

const numCpu = os1.default.cpus().length;
if (cluster1.default.isPrimary) {
  // for on each cpu thread
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < numCpu; i++) {
    cluster1.default.fork();
  }
  // listen to dying worker and fork on another worker
  cluster1.default.on('exist', () => {
    cluster1.default.fork();
  });
} else {
  // eslint-disable-next-line global-require
  require('./index');
}
// # sourceMappingURL=cluster.js.map
