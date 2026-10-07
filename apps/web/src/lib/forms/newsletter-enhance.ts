// F-223, docs/10 (generate_lead): logika formularza newslettera podpieta pod znaczniki z serwera (bez Reacta, dzieki
// temu ladowana leniwie i mala). Walidacja po opuszczeniu pola i przy wysylce, komunikat pod polem z
// aria-describedby i aria-invalid, fokus na pierwszy blad, po 201 komunikat z API i jedno `generate_lead`.
import { failureText, submitForm, trackLead } from "./client";
import { validateEmail } from "./validate";

const CONSENT_ERROR = "Zaznacz zgodę, żeby zapisać się na newsletter.";

export function enhanceNewsletter(form: HTMLFormElement): () => void {
  const email = form.querySelector<HTMLInputElement>('input[name="email"]');
  const consent = form.querySelector<HTMLInputElement>('input[name="consent"]');
  const emailErr = form.querySelector<HTMLElement>('[data-blad="email"]');
  const consentErr = form.querySelector<HTMLElement>('[data-blad="consent"]');
  const status = form.querySelector<HTMLElement>("[data-stan]");
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!email || !consent || !emailErr || !consentErr || !status || !button) return () => {};
  let sending = false;

  const show = (input: HTMLInputElement, slot: HTMLElement, message: string | null) => {
    if (message) {
      slot.textContent = message;
      slot.hidden = false;
      input.setAttribute("aria-invalid", "true");
      input.setAttribute("aria-describedby", slot.id);
    } else {
      slot.textContent = "";
      slot.hidden = true;
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
  };
  const checkEmail = () => {
    const msg = validateEmail(email.value);
    show(email, emailErr, msg);
    return msg;
  };
  const checkConsent = () => {
    const msg = consent.checked ? null : CONSENT_ERROR;
    show(consent, consentErr, msg);
    return msg;
  };

  const onEmailBlur = () => void checkEmail();
  const onEmailInput = () => {
    if (!emailErr.hidden) checkEmail();
  };
  const onConsentChange = () => {
    if (!consentErr.hidden) checkConsent();
  };
  const onSubmit = async (e: Event) => {
    e.preventDefault();
    if (sending) return;
    status.textContent = "";
    const emailMsg = checkEmail();
    const consentMsg = checkConsent();
    if (emailMsg) return void email.focus();
    if (consentMsg) return void consent.focus();
    sending = true;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    const res = await submitForm("newsletter", { email: email.value.trim() });
    sending = false;
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (res.ok) {
      status.textContent = res.message;
      form.reset();
      trackLead("newsletter");
    } else {
      status.textContent = failureText(res);
    }
  };

  email.addEventListener("blur", onEmailBlur);
  email.addEventListener("input", onEmailInput);
  consent.addEventListener("change", onConsentChange);
  form.addEventListener("submit", onSubmit);
  return () => {
    email.removeEventListener("blur", onEmailBlur);
    email.removeEventListener("input", onEmailInput);
    consent.removeEventListener("change", onConsentChange);
    form.removeEventListener("submit", onSubmit);
  };
}
