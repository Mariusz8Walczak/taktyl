// F-221, F-247 (docs/05 §8; TAKTYL-32): /polityka-prywatnosci - strona informacyjna z API (tag content:polityka-prywatnosci). Tresc i baner demo
// renderuje wspolny komponent serwerowy; brak strony w API to 404.
import { InfoPage, infoMetadata } from "../../../components/informacyjne/info-page";

export const generateMetadata = () => infoMetadata("polityka-prywatnosci");

export default function Page() {
  return <InfoPage slug="polityka-prywatnosci" />;
}
