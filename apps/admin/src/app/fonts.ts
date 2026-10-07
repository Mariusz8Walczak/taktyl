// docs/06 §3: font Archivo (SIL OFL) ladowany lokalnie z @taktyl/tokens, jak w sklepie (WEB-003). Zero obcych domen.
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
