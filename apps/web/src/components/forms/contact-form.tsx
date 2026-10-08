"use client";
// F-221 (wzorzec: formularz kontaktowy `contact-form`, docs/08 §6): e-mail, temat, wiadomosc. BEZ pola zgody i bez
// honeypota (API-015: strictObject, nieznane pola = 422). Walidacja po opuszczeniu pola i przy wysylce, komunikat
// pod polem (aria-describedby przez Field), fokus na pierwszy blad. Po 201: komunikat z API i jedno `generate_lead`.
import { Alert, Button, Field } from "@taktyl/ui";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import "../../styles/formularze.css";
import { failureText, submitForm, trackLead } from "../../lib/forms/client";
import type { FormFailure } from "../../lib/forms/client";
import {
  CONTACT_ORDER,
  LIMITS,
  firstErrorKey,
  validateContact,
  validateContactField,
} from "../../lib/forms/validate";
import type { ContactField, ContactValues, FieldErrors } from "../../lib/forms/validate";

const IDS: Record<ContactField, string> = {
  email: "kontakt-email",
  subject: "kontakt-temat",
  message: "kontakt-wiadomosc",
};
const EMPTY: ContactValues = { email: "", subject: "", message: "" };

export function ContactForm() {
  const [values, setValues] = useState<ContactValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<ContactField>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const sending = useRef(false);

  const set = (key: ContactField, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const blur = (key: ContactField) => {
    const msg = validateContactField(key, values);
    setErrors((e) => ({ ...e, [key]: msg ?? undefined }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending.current) return;
    setFailure(null);
    setDone(null);
    const errs = validateContact(values);
    setErrors(errs);
    const first = firstErrorKey(errs, CONTACT_ORDER);
    if (first) {
      document.getElementById(IDS[first])?.focus();
      return;
    }
    sending.current = true;
    setBusy(true);
    const res = await submitForm("contact", {
      email: values.email.trim(),
      subject: values.subject.trim(),
      message: values.message.trim(),
    });
    sending.current = false;
    setBusy(false);
    if (res.ok) {
      setDone(res.message);
      setValues(EMPTY);
      trackLead("contact");
      return;
    }
    setFailure(res);
  }

  return (
    <form
      className="formularz"
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="formularz-kontaktowy-tytul"
    >
      <h2 id="formularz-kontaktowy-tytul" className="formularz__tytul">
        Napisz do nas
      </h2>
      {done ? (
        <Alert variant="sukces" title="Wiadomość przyjęta">
          {done}
        </Alert>
      ) : null}
      {failure ? <Alert variant="blad">{failureText(failure)}</Alert> : null}
      <Field
        id={IDS.email}
        label="E-mail"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        maxLength={LIMITS.emailMax}
        value={values.email}
        error={errors.email}
        onChange={(e) => set("email", e.target.value)}
        onBlur={() => blur("email")}
        required
      />
      <Field
        id={IDS.subject}
        label="Temat"
        name="subject"
        maxLength={LIMITS.subjectMax}
        value={values.subject}
        error={errors.subject}
        onChange={(e) => set("subject", e.target.value)}
        onBlur={() => blur("subject")}
        required
      />
      <Field
        id={IDS.message}
        as="textarea"
        label="Wiadomość"
        name="message"
        rows={6}
        maxLength={LIMITS.messageMax}
        value={values.message}
        error={errors.message}
        hint="Wpisz dane przykładowe, nie własne. Wiadomość usuwamy po 30 dniach."
        onChange={(e) => set("message", e.target.value)}
        onBlur={() => blur("message")}
        required
      />
      <Button type="submit" loading={busy}>
        {busy ? "Wysyłanie…" : "Wyślij wiadomość"}
      </Button>
    </form>
  );
}
