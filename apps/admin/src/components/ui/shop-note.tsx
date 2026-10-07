// ADR-0003, skill taktyl-admin-sklep-sync: skutek zapisu widoczny w sklepie - zdanie o odswiezeniu, odnosnik "Podglad w sklepie"
// i lista znacznikow odswiezanych po zapisie (nazwy z docs/14 par. 6).
export function ShopNote({ url, tags }: { url: string; tags: readonly string[] }) {
  return (
    <aside className="adm-karta adm-stos" aria-labelledby="sklep">
      <h2 id="sklep">W sklepie</h2>
      <a className="tk-link" href={url} target="_blank" rel="noreferrer">
        Podgląd w sklepie
      </a>
      <p className="adm-powod">Zmiana pojawi się w sklepie w ciągu kilku sekund.</p>
      <h3>Odświeżane po zapisie</h3>
      <ul className="adm-lista adm-tekst-xs">
        {tags.map((t) => (
          <li key={t}>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
