// Jest setup file, runs before every test file.

// server/services/ses.ts builds the Resend client at import time and throws without a key,
// so anything that imports the resolver graph needs one. Always overwrite, never default:
// Prisma loads the local .env on import, and a real key there would let a test send real mail
// locally and pass while CI (no .env) fails. Prisma's loader does not overwrite set variables.
process.env.RESEND_API_KEY = 're_test_dummy';
