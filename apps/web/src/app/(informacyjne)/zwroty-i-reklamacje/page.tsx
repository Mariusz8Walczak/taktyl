// F-221, F-247 (docs/05 §8; TAKTYL-32): /zwroty-i-reklamacje - strona informacyjna z API (tag content:zwroty-i-reklamacje). Tresc i baner demo
// renderuje wspolny komponent serwerowy; brak strony w API to 404.
import { InfoPage, infoMetadata } from "../../../components/informacyjne/info-page";

export const generateMetadata = () => infoMetadata("zwroty-i-reklamacje");

export default function Page() {
  return <InfoPage slug="zwroty-i-reklamacje" />;
}
