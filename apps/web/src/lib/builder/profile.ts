// F-101, F-069, F-156 (audyt P1-2): JEDNO zrodlo prawdy dla profilu setu ("Do czego?"). Kreator zapisuje profil razem
// z taktyl.set.v1, a dodatkowo w ciasteczku `taktyl_profil`, ktore czyta serwer: blok "Dokończ set" na karcie produktu
// i w koszyku dobiera pozostale elementy do TEGO profilu (API `complete-set?profile=`), a nie do domyslnego profilu
// produktu. Ciasteczko funkcjonalne (wybor klienta w kreatorze), bez danych osobowych; lista na stronie /cookies.
import { profileIdSchema, type ProfileId } from "@taktyl/contracts";

export const PROFILE_COOKIE = "taktyl_profil";
/** 30 dni: tyle samo, ile ma sens niedokonczony set. */
const MAX_AGE_S = 60 * 60 * 24 * 30;

/** Wartosc z ciasteczka albo adresu; nieznany profil = null (API wybierze profil produktu). */
export function parseProfile(raw: string | null | undefined): ProfileId | null {
  const r = profileIdSchema.safeParse(raw ?? undefined);
  return r.success ? r.data : null;
}

/** Przegladarka: zapis albo usuniecie (null) profilu. Bledy (zablokowane ciasteczka) sa ciche. */
export function writeProfileCookie(profile: string | null): void {
  try {
    const value = parseProfile(profile);
    document.cookie = value
      ? `${PROFILE_COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE_S}; SameSite=Lax`
      : `${PROFILE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    /* profil w ciasteczku to dodatek */
  }
}
