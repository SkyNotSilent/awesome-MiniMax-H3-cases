import pg from 'pg'
import { readFile } from 'node:fs/promises'
if (!process.env.AUTH_DATABASE_URL) throw new Error('AUTH_DATABASE_URL is required')
const db = new pg.Client({ connectionString: process.env.AUTH_DATABASE_URL })
try {
  await db.connect()
  await db.query('BEGIN')
  await db.query("SELECT pg_advisory_xact_lock(hashtext('h3-auth-schema-v1'))")
  await db.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'))
  await db.query('COMMIT')
  console.log('Account schema migration completed')
} catch {
  console.error('Account schema migration failed')
  process.exitCode = 1
} finally {
  await db.end()
}
