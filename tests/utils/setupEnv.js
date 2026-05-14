// Inject required env vars so config.js validates during integration tests.
// These values are fake/test-only; real HTTP calls to the VF Engine are mocked.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.VFENGINE_BASE_URL = process.env.VFENGINE_BASE_URL || 'https://vfengine.test.local';
process.env.VFENGINE_JWT_SECRET = process.env.VFENGINE_JWT_SECRET || 'test-vf-jwt-secret-32-chars-xxxxxx';
process.env.VFENGINE_WEBHOOK_SECRET = process.env.VFENGINE_WEBHOOK_SECRET || 'test-webhook-secret-minimum-32-chars';
process.env.VFENGINE_OPERATOR_ID = process.env.VFENGINE_OPERATOR_ID || 'test-operator-id';
