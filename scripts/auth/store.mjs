import { randomUUID } from 'node:crypto'
import pg from 'pg'

export function createAccountStore(connectionString) {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 3000,
    query_timeout: 5000,
    idleTimeoutMillis: 30000,
  })
  // Pool errors must not terminate public browsing or leak connection details.
  pool.on('error', () => {})
  return {
    close: () => pool.end(),
    async putLogin(value) {
      await pool.query('DELETE FROM auth_login_transactions WHERE expires_at <= now()')
      await pool.query(
        'INSERT INTO auth_login_transactions (state_hash,browser_hash,origin,verifier,nonce,return_to,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [
          value.stateHash,
          value.browserHash,
          value.origin,
          value.verifier,
          value.nonce,
          value.returnTo,
          value.expiresAt,
        ],
      )
    },
    async consumeLogin(stateHash, browserHash, origin) {
      const { rows } = await pool.query(
        'DELETE FROM auth_login_transactions WHERE state_hash=$1 AND browser_hash=$2 AND origin=$3 AND expires_at>now() RETURNING *',
        [stateHash, browserHash, origin],
      )
      return rows[0]
    },
    async createSession(profile, session) {
      const db = await pool.connect()
      try {
        await db.query('BEGIN')
        const { rows } = await db.query(
          'INSERT INTO auth_users (id,google_sub,email,name,picture) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (google_sub) DO UPDATE SET email=EXCLUDED.email,name=EXCLUDED.name,picture=EXCLUDED.picture RETURNING id',
          [randomUUID(), profile.sub, profile.email, profile.name, profile.picture],
        )
        await db.query('DELETE FROM auth_sessions WHERE expires_at <= now()')
        if (session.oldTokenHash)
          await db.query('DELETE FROM auth_sessions WHERE token_hash=$1 AND origin=$2', [
            session.oldTokenHash,
            session.origin,
          ])
        await db.query(
          'INSERT INTO auth_sessions (token_hash,user_id,origin,csrf_token,expires_at) VALUES ($1,$2,$3,$4,$5)',
          [session.tokenHash, rows[0].id, session.origin, session.csrfToken, session.expiresAt],
        )
        await db.query('COMMIT')
      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      } finally {
        db.release()
      }
    },
    async session(tokenHash, origin) {
      const { rows } = await pool.query(
        'SELECT s.csrf_token,u.id,u.email,u.name,u.picture FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.origin=$2 AND s.expires_at>now()',
        [tokenHash, origin],
      )
      return rows[0]
    },
    async logout(tokenHash) {
      await pool.query('DELETE FROM auth_sessions WHERE token_hash=$1', [tokenHash])
    },
    async favorites(userId) {
      const { rows } = await pool.query(
        'SELECT case_id FROM account_favorites WHERE user_id=$1 ORDER BY case_id',
        [userId],
      )
      return rows.map((row) => row.case_id)
    },
    async favorite(userId, caseId, add) {
      if (!add) {
        await pool.query('DELETE FROM account_favorites WHERE user_id=$1 AND case_id=$2', [userId, caseId])
        return
      }
      // Serialize writes and imports per account, including the capacity check.
      const db = await pool.connect()
      try {
        await db.query('BEGIN')
        await db.query('SELECT id FROM auth_users WHERE id=$1 FOR UPDATE', [userId])
        const { rows } = await db.query(
          'SELECT count(*)::integer AS count FROM account_favorites WHERE user_id=$1',
          [userId],
        )
        const existing = await db.query('SELECT 1 FROM account_favorites WHERE user_id=$1 AND case_id=$2', [
          userId,
          caseId,
        ])
        if (rows[0].count >= 10000 && !existing.rowCount)
          throw Object.assign(new Error('Favorite limit reached'), { status: 409 })
        await db.query(
          'INSERT INTO account_favorites (user_id,case_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [userId, caseId],
        )
        await db.query('COMMIT')
      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      } finally {
        db.release()
      }
    },
    async importFavorites(userId, origin, importId, batchId, ids, final) {
      const db = await pool.connect()
      try {
        await db.query('BEGIN')
        await db.query('SELECT id FROM auth_users WHERE id=$1 FOR UPDATE', [userId])
        await db.query(
          'INSERT INTO favorite_imports (import_id,user_id,origin) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [importId, userId, origin],
        )
        const { rows } = await db.query('SELECT * FROM favorite_imports WHERE import_id=$1 FOR UPDATE', [
          importId,
        ])
        if (rows[0].user_id !== userId || rows[0].origin !== origin)
          throw Object.assign(new Error('Import belongs to another account'), { status: 409 })
        const receipt = await db.query(
          'INSERT INTO favorite_import_batches (import_id,batch_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING batch_id',
          [importId, batchId],
        )
        if (!rows[0].completed && receipt.rowCount) {
          const size = await db.query(
            'SELECT count(*)::integer AS count FROM (SELECT case_id FROM account_favorites WHERE user_id=$1 UNION SELECT unnest($2::text[])) f',
            [userId, ids],
          )
          if (size.rows[0].count > 10000)
            throw Object.assign(new Error('Favorite limit reached'), { status: 409 })
          await db.query(
            'INSERT INTO account_favorites (user_id,case_id) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING',
            [userId, ids],
          )
          if (final)
            await db.query('UPDATE favorite_imports SET completed=true WHERE import_id=$1', [importId])
        }
        await db.query('COMMIT')
      } catch (error) {
        await db.query('ROLLBACK')
        throw error
      } finally {
        db.release()
      }
    },
  }
}
