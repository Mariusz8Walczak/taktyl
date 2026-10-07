// docs/06 §3, docs/11 pulapka 4: font Archivo (SIL OFL) ladowany LOKALNIE z pakietu @taktyl/tokens, z preloadem
// (next/font generuje <link rel="preload" as="font" type="font/woff2" crossorigin>). Zero obcych domen.
// Os szerokosci 100-125% musi trafic do @font-face (declarations), inaczej naglowki 125% nie dzialaja.
import localFont from "next/font/local";

export const archivo = localFont({
  src: "../../../../packages/tokens/assets/fonts/archivo-pl-400-700-w100-125.woff2",
  weight: "400 700",
  style: "normal",
  display: "swap",
  preload: true,
  variable: "--font-archivo",
  declarations: [{ prop: "font-stretch", value: "100% 125%" }],
});
