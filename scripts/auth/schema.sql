CREATE TABLE IF NOT EXISTS auth_users (
  id uuid PRIMARY KEY,
  google_sub text UNIQUE NOT NULL,
  email text NOT NULL,
  name text NOT NULL,
  picture text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  origin text NOT NULL,
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_login_transactions (
  state_hash text PRIMARY KEY,
  browser_hash text NOT NULL,
  origin text NOT NULL,
  verifier text NOT NULL,
  nonce text NOT NULL,
  return_to text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS account_favorites (
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  case_id varchar(160) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, case_id)
);
CREATE TABLE IF NOT EXISTS favorite_imports (
  import_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  origin text NOT NULL,
  completed boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS favorite_import_batches (
  import_id uuid NOT NULL REFERENCES favorite_imports(import_id) ON DELETE CASCADE,
  batch_id integer NOT NULL,
  PRIMARY KEY (import_id, batch_id)
);
