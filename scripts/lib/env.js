/**
 * Shared helpers for standalone scripts that need .env / environment variables.
 */

function loadEnvFile() {
  if (typeof process.loadEnvFile !== 'function') {
    console.warn('[env] process.loadEnvFile is not available; ensure env vars are exported.')
    return
  }

  try {
    process.loadEnvFile()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[env] Failed to load .env file: ${message}`)
  }
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.RAILWAY_PROXY_URL
}

module.exports = { loadEnvFile, requireEnv, getDatabaseUrl }
