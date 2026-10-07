# Polityka bezpieczeństwa

Taktyl to sklep demonstracyjny: nie ma prawdziwych płatności ani prawdziwych danych klientów. Mimo to kod jest publiczny i traktujemy zgłoszenia poważnie.

## Jak zgłosić podatność

Użyj prywatnego zgłoszenia na GitHubie: zakładka **Security → Report a vulnerability** (GitHub Security Advisories). **Nie zakładaj publicznego issue** i nie publikuj szczegółów przed poprawką.

W zgłoszeniu podaj: opis, kroki odtworzenia, wpływ, wersję (commit) i środowisko (Docker).

## Czego oczekiwać

- Potwierdzenie w ciągu 7 dni.
- Ocena i plan w ciągu 14 dni.
- Poprawka i advisory po naprawie; za zgodą zgłaszającego podziękowanie w notkach.

## Zakres

W zakresie: kod w repozytorium, konfiguracja Docker i CI, backpanel (logowanie, sesje, role), API.
Poza zakresem: ataki na infrastrukturę osób trzecich, inżynieria społeczna, testy DoS, brak nagłówków na własnych kopiach demo.

## Sekrety

W repozytorium nie ma sekretów; `.env.example` zawiera tylko placeholdery. Jeśli znajdziesz działający sekret, zgłoś to tą samą drogą.
