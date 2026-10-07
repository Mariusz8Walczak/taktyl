// F-221, F-247 (docs/05 §8; TAKTYL-32): /o-sklepie - strona informacyjna z API (tag content:o-sklepie). Tresc i baner demo
// renderuje wspolny komponent serwerowy; brak strony w API to 404.
import { InfoPage, infoMetadata } from "../../../components/informacyjne/info-page";

export const generateMetadata = () => infoMetadata("o-sklepie");

export default function Page() {
  return <InfoPage slug="o-sklepie" />;
}
