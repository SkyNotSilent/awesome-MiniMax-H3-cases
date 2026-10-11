import type { Account } from './use-account'
import type { Language } from './i18n'

const accountCopy = {
  zh: {
    login: 'Google 登录',
    logout: '退出登录',
    switch: '切换账号',
    saved: '我的收藏',
    gate: '登录后查看你的收藏',
    sync: '收藏与你的账号绑定，可在不同设备上继续查看。',
    retry: '重试',
    loading: '正在读取账号…',
    unavailable: '登录或收藏服务暂时不可用，请稍后重试。',
    failed: '登录未完成，请重新登录。',
    save: '收藏未保存成功，请重试。',
    import: '旧收藏尚未导入完成，本机数据已保留。请使用首次导入的账号重试。',
    legacy: '导入旧站收藏',
    privacy: '账号与收藏隐私说明',
    privacyText:
      '登录后，本站保存你的 Google 账号标识、邮箱、姓名、头像和收藏，用于账号识别与跨设备同步。登录会话最长保留 30 天，退出会撤销当前会话；账号和收藏保留至你请求删除。Google 凭据不会保存在浏览器中。首次登录会自动合并当前浏览器旧收藏，旧站收藏需在旧站登录同一账号导入。',
    deletion: '请求删除账号数据',
  },
  en: {
    login: 'Sign in with Google',
    logout: 'Sign out',
    switch: 'Switch account',
    saved: 'Saved cases',
    gate: 'Sign in to view your saved cases',
    sync: 'Saved cases belong to your account and sync across devices.',
    retry: 'Retry',
    loading: 'Loading account…',
    unavailable: 'Sign-in or saved cases are temporarily unavailable. Please retry.',
    failed: 'Sign-in was not completed. Please sign in again.',
    save: 'Your change could not be saved. Please retry.',
    import:
      'Old saved cases have not finished importing. Browser data is retained. Retry with the account that started the import.',
    legacy: 'Import old-site saved cases',
    privacy: 'Account and saved-case privacy',
    privacyText:
      'We store your Google account identifier, email, name, avatar and saved cases to identify your account and sync across devices. Sessions last up to 30 days; signing out revokes the current session. Account information and saved cases remain until you request deletion. Google credentials are not stored in your browser. First sign-in merges old saved cases from this browser. Sign in with the same account on the old site to import its saved cases.',
    deletion: 'Request account data deletion',
  },
}
export function AccountControls({ account, language }: { account: Account; language: Language }) {
  const t = accountCopy[language]
  if (!account.user)
    return (
      <button
        className="account-login account-login-nav"
        aria-label={t.login}
        title={t.login}
        type="button"
        disabled={account.loading}
        onClick={() => account.login()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.73-.06-1.42-.19-2.09H12v3.96h5.92c-.26 1.28-1.03 2.37-2.19 3.1v2.58h3.56c2.08-1.92 3.27-4.75 3.27-7.55Z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.58c-.99.66-2.25 1.06-3.72 1.06-2.87 0-5.3-1.94-6.17-4.55H2.15v2.68C3.96 20.53 7.69 23 12 23Z" />
          <path fill="#FBBC05" d="M5.83 14.27a6.6 6.6 0 0 1 0-4.54V7.05H2.15a11 11 0 0 0 0 9.9l3.68-2.68Z" />
          <path fill="#EA4335" d="M12 5.18c1.62 0 3.07.56 4.21 1.64l3.16-3.16C17.45 1.86 14.97 1 12 1 7.69 1 3.96 3.47 2.15 7.05l3.68 2.68C6.7 7.12 9.13 5.18 12 5.18Z" />
        </svg>
        <span className="account-login-label">{t.login}</span>
        <span className="account-login-compact">{language === 'zh' ? '登录' : 'Sign in'}</span>
      </button>
    )
  return (
    <details className="account-menu">
      <summary aria-label={account.user.name}>
        {account.user.picture ? (
          <img src={account.user.picture} alt="" width="24" height="24" referrerPolicy="no-referrer" />
        ) : (
          <span aria-hidden="true">●</span>
        )}
        <span>{account.user.name}</span>
      </summary>
      <div className="account-menu-panel">
        <small>{account.user.email}</small>
        <a href={`${language === 'en' ? '/en/' : '/'}?collection=favorites&added=all`}>{t.saved}</a>
        <button type="button" onClick={() => account.login()}>
          {t.switch}
        </button>
        <button
          type="button"
          onClick={() => {
            void account.logout()
          }}
        >
          {t.logout}
        </button>
      </div>
    </details>
  )
}
export function AccountNotice({ account, language }: { account: Account; language: Language }) {
  if (!account.error) return null
  const t = accountCopy[language]
  const message =
    account.error === 'login'
      ? t.failed
      : account.error === 'save'
        ? t.save
        : account.error === 'import'
          ? t.import
          : t.unavailable
  return (
    <div className="account-notice shell" role="alert">
      <span>{message}</span>
      <button type="button" onClick={account.retry}>
        {t.retry}
      </button>
    </div>
  )
}
export function AccountPrivacy({ language }: { language: Language }) {
  const t = accountCopy[language]
  return (
    <details className="account-privacy shell" id="account-privacy">
      <summary>{t.privacy}</summary>
      <p>{t.privacyText}</p>
      <a href="/privacy.html">{t.privacy}</a>
      <br />
      <a href="https://github.com/SkyNotSilent/awesome-MiniMax-H3-cases/security/advisories/new">
        {t.deletion}
      </a>
    </details>
  )
}
export function FavoriteGate({ account, language }: { account: Account; language: Language }) {
  const t = accountCopy[language]
  return (
    <div className="favorite-gate" role="status">
      <h2>{account.loading ? t.loading : account.user ? t.unavailable : t.gate}</h2>
      <p>{t.sync}</p>
      <button
        className="account-login"
        type="button"
        disabled={account.loading}
        onClick={() => (account.user ? account.retry() : account.login())}
      >
        {account.user ? t.retry : t.login}
      </button>
    </div>
  )
}
export function LegacyFavoritesLink({ language }: { language: Language }) {
  if (window.location.hostname === 'h3-field-notes-production.up.railway.app') return null
  return (
    <a
      className="legacy-favorites-link"
      href={`https://h3-field-notes-production.up.railway.app/${language === 'en' ? 'en/' : ''}?collection=favorites&added=all`}
      target="_blank"
      rel="noreferrer"
    >
      {accountCopy[language].legacy}
    </a>
  )
}
