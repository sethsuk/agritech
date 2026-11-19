/**
 * Put filter state in the URL without a navigation.
 *
 * `router.replace` is a Next.js navigation: every filter tap fetched the page's server
 * payload (`GET /page?…&_rsc=…`) and `useSearchParams` only updated once it came back —
 * a visible lag on a phone, even though the data itself was already cached. The native
 * History API is supported by the App Router (Next ≥ 14.1): it keeps `useSearchParams`
 * in sync and makes no request. Replace, not push, so Back leaves the page rather than
 * stepping through every filter tap.
 */
export function replaceQuery(qs: URLSearchParams | string, opts: { scrollTop?: boolean } = {}) {
  const s = qs.toString();
  window.history.replaceState(null, "", s ? `${window.location.pathname}?${s}` : window.location.pathname);
  if (opts.scrollTop) window.scrollTo({ top: 0 });
}
