export const advertisingHead = '<link rel="stylesheet" href="/advertising.css"><script type="module" src="/advertising.js"></script>'

export function advertisingSlot(locale, placement = 'catalog') {
  return `<div class="h3-ad-slot" data-ad-placement="${placement}" hidden><small>${locale === 'en' ? 'Advertisement' : '广告'}</small><ins class="adsbygoogle" data-ad-format="auto" data-full-width-responsive="true"></ins></div>`
}

export function siteLinks(locale) {
  const en = locale === 'en'
  const prefix = en ? '/en' : ''
  return `<nav class="h3-site-links" aria-label="${en ? 'Site information' : '网站说明'}"><a href="${prefix}/about/">${en ? 'About' : '关于本站'}</a><a href="${prefix}/contact/">${en ? 'Contact and copyright' : '联系与版权'}</a><a href="/privacy.html">${en ? 'Privacy policy' : '隐私说明'}</a><button type="button" data-ad-privacy="${en ? 'en' : 'zh'}">${en ? 'Ad privacy choices' : '广告隐私选择'}</button><button type="button" data-ad-privacy="${en ? 'en' : 'zh'}" data-ad-us-privacy hidden>${en ? 'Do not sell or share my personal information' : '不出售或分享我的个人信息'}</button><span data-ad-privacy-status aria-live="polite"></span></nav>`
}
