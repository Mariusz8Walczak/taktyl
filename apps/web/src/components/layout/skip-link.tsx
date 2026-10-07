// F-245, wzorzec: odnosnik "skip link" (wlasny, kilka linii CSS; docs/08: szablon go nie ma). Pierwszy element body.
export const MAIN_ID = "tresc";

export function SkipLink() {
  return (
    <a className="skip-link" href={`#${MAIN_ID}`}>
      Przejdź do treści
    </a>
  );
}
