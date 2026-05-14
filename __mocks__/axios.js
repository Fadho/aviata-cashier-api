// Manual axios mock for Jest. The real axios v1.x is ESM-only and cannot be
// required() in a CommonJS Jest environment without Babel. All integration
// tests mock the services that use axios (e.g. vfengine.service), so the real
// axios implementation is never called during tests.
const axios = {
  create: jest.fn(() => axios),
  get: jest.fn(() => Promise.resolve({ data: {}, status: 200 })),
  post: jest.fn(() => Promise.resolve({ data: {}, status: 200 })),
  put: jest.fn(() => Promise.resolve({ data: {}, status: 200 })),
  patch: jest.fn(() => Promise.resolve({ data: {}, status: 200 })),
  delete: jest.fn(() => Promise.resolve({ data: {}, status: 200 })),
  request: jest.fn(() => Promise.resolve({ data: {}, status: 200 })),
  defaults: { headers: { common: {} } },
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn() },
    response: { use: jest.fn(), eject: jest.fn() },
  },
};

module.exports = axios;
module.exports.default = axios;
