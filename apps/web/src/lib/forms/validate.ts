// F-221, F-223 (docs/01 §4: komunikat mowi, co poprawic): walidacja formularza kontaktu i newslettera po stronie
// klienta. Limity jak w kontrakcie API (contactFormSchema): temat 2-120, wiadomosc 5-2000, e-mail do 254 znakow.
// Czyste funkcje; komunikaty sa po polsku i nie zawieraja wpisanych danych.

export type ContactField = "email" | "subject" | "message";
export type NewsletterField = "email" | "consent";
export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export interface ContactValues {
  email: string;
  subject: string;
  message: string;
}

export const LIMITS = {
  subjectMin: 2,
  subjectMax: 120,
  messageMin: 5,
  messageMax: 2000,
  emailMax: 254,
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (v === "") return "Wpisz adres e-mail.";
  if (v.length > LIMITS.emailMax || !EMAIL.test(v)) {
    return "Sprawdź adres e-mail. Powinien mieć postać nazwa@taktyl.example.";
  }
  return null;
}

export function validateContactField(key: ContactField, values: ContactValues): string | null {
  switch (key) {
    case "email":
      return validateEmail(values.email);
    case "subject": {
      const n = values.subject.trim().length;
      if (n === 0) return "Wpisz temat wiadomości.";
      if (n < LIMITS.subjectMin) return "Temat jest za krótki. Wpisz co najmniej 2 znaki.";
      if (n > LIMITS.subjectMax) return "Temat jest za długi. Skróć go do 120 znaków.";
      return null;
    }
    case "message": {
      const n = values.message.trim().length;
      if (n === 0) return "Napisz wiadomość.";
      if (n < LIMITS.messageMin) return "Wiadomość jest za krótka. Wpisz co najmniej 5 znaków.";
      if (n > LIMITS.messageMax) return "Wiadomość jest za długa. Skróć ją do 2000 znaków.";
      return null;
    }
  }
}

export const CONTACT_ORDER: readonly ContactField[] = ["email", "subject", "message"];

export function validateContact(values: ContactValues): FieldErrors<ContactField> {
  const errors: FieldErrors<ContactField> = {};
  for (const k of CONTACT_ORDER) {
    const msg = validateContactField(k, values);
    if (msg) errors[k] = msg;
  }
  return errors;
}

export function validateNewsletter(email: string, consent: boolean): FieldErrors<NewsletterField> {
  const errors: FieldErrors<NewsletterField> = {};
  const e = validateEmail(email);
  if (e) errors.email = e;
  if (!consent) errors.consent = "Zaznacz zgodę, żeby zapisać się na newsletter.";
  return errors;
}

export function firstErrorKey<K extends string>(
  errors: FieldErrors<K>,
  order: readonly K[],
): K | null {
  return order.find((k) => errors[k]) ?? null;
}
