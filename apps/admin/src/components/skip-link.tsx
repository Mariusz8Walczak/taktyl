// docs/15 §13, F-245: odnosnik "Przejdz do tresci" jako pierwszy element w kolejnosci Tab.
export const MAIN_ID = "tresc-glowna";

export function SkipLink() {
  return (
    <a className="skip-link" href={`#${MAIN_ID}`}>
      Przejdź do treści
    </a>
  );
}
