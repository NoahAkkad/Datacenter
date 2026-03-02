const hasValidated = { value: false };

function assertEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not defined`);
  }
  return value;
}

function validateRuntimeEnv() {
  if (hasValidated.value) return;

  assertEnv('JWT_SECRET');

  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL && !process.env.DB_PATH) {
    console.warn(
      '[env] DATABASE_URL is not set. Configure a cloud database (or DB_PATH for file-backed deployments) to avoid ephemeral storage issues in serverless production.'
    );
  }

  hasValidated.value = true;
}

function getJwtSecret() {
  validateRuntimeEnv();
  return assertEnv('JWT_SECRET');
}

module.exports = { validateRuntimeEnv, getJwtSecret };
