// F-240, F-242 (docs/10 §2): fragment trybu zgody wstrzykiwany w <head> PRZED czymkolwiek innym (layout.tsx).
// Stala tresc (bez danych z zadania), wiec nadaje sie do skrotu CSP (sha256) albo nonce; w demo CSP nie ma.
// Powracajacy uzytkownik: zapisana decyzja jest odtwarzana od razu po `default` (wait_for_update 500).
// TAKTYL-84: ten sam skrypt oznacza <html data-zgody-zapisane>, zeby zgody.css schowal baner z HTML-a przed pierwszym
// malowaniem (baner jest renderowany na serwerze w stanie domyslnym, patrz consent-manager.tsx).
export const CONSENT_BOOTSTRAP_SCRIPT =
  "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}" +
  "gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});" +
  "try{var c=JSON.parse(localStorage.getItem('taktyl.consent.v1')||'null');" +
  "if(c&&c.v===1){document.documentElement.setAttribute('data-zgody-zapisane','');var m=c.marketing===true?'granted':'denied';" +
  "gtag('consent','update',{ad_storage:m,ad_user_data:m,ad_personalization:m,analytics_storage:c.analytics===true?'granted':'denied'})}}catch(e){}";
