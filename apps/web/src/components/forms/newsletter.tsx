// F-223 (wzorzec: pole zapisu do newslettera ze stopki szablonu `footer-subscribe`, docs/08 §6): jedno pole e-mail,
// zgoda NIEZAZNACZONA z gory (API-015: zgoda tylko w UI), przycisk "Zapisz się", komunikat potwierdzenia demo.
// Komponent SERWEROWY: znaczniki idą w HTML-u stopki, a logike (walidacja, wysylka, generate_lead) dolacza
// leniwie NewsletterEnhancer po pierwszej interakcji - stopka jest w kazdej stronie, wiec nie dokladamy JS do budzetu.
import { NewsletterEnhancer } from "./newsletter-enhancer";
import "../../styles/formularze.css";

export const NEWSLETTER_FORM_ID = "newsletter-form";

export function Newsletter() {
  return (
    <section className="newsletter" aria-labelledby="newsletter-tytul">
      <h2 id="newsletter-tytul" className="stopka__tytul">
        Newsletter
      </h2>
      <p className="newsletter__opis">
        To sklep demonstracyjny: zapis działa, ale żadne e-maile nie są wysyłane.
      </p>
      <form id={NEWSLETTER_FORM_ID} className="newsletter__formularz" method="post" noValidate>
        <div className="tk-pole newsletter__pole">
          <label className="tk-pole__etykieta" htmlFor="newsletter-email">
            E-mail
          </label>
          <input
            id="newsletter-email"
            className="tk-pole__kontrolka"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            required
          />
          <p className="tk-pole__blad" id="newsletter-email-blad" data-blad="email" hidden></p>
        </div>
        <div className="newsletter__zgoda-grupa">
          <label className="formularz__zgoda">
            <input type="checkbox" id="newsletter-zgoda" name="consent" />
            <span>Chcę dostawać newsletter (w demo nic nie wysyłamy)</span>
          </label>
          <p className="tk-pole__blad" id="newsletter-zgoda-blad" data-blad="consent" hidden></p>
        </div>
        <button type="submit" className="tk-btn tk-btn--glowny newsletter__wyslij">
          Zapisz się
        </button>
        <p className="newsletter__stan" role="status" data-stan></p>
      </form>
      <NewsletterEnhancer formId={NEWSLETTER_FORM_ID} />
    </section>
  );
}
