---
name: taktyl-start
description: Wczytuje kontekst projektu Taktyl przed pierwszym zadaniem w sesji - kolejność czytania dokumentów, reguły nadrzędne, stos i zasady Dockera. Użyj na początku każdej nowej sesji albo gdy nie wiesz, który dokument dotyczy zadania.
---

# taktyl-start

## Kolejność czytania (pierwsze zadanie w sesji)
1. `CLAUDE.md` (reguły 1-11, definicja ukończenia, aneks po ADR).
2. `README.md`.
3. `docs/01` ... `docs/12` po kolei (marka, funkcje, kreator, dane, mapa strony, design, animacje, szablon, grafika, pomiar, pułapki, kryteria odbioru).
4. `docs/adr/0001` ... `0009` (stos, monorepo, propagacja zmian, Crafto i licencja, baza, backpanel, koszyk i zamówienia, repo, Docker).
5. `docs/13` ... `docs/21` (PRD, architektura, backpanel, API, model danych, przepływy, repozytorium, zespół i skille, plan).
6. `docs/decyzje.md` (decyzje i pytania otwarte).

Przed **każdym kolejnym** zadaniem czytasz dokument, którego zadanie dotyczy (np. kreator -> `docs/03`; zamówienie -> `docs/05` §7, `docs/02` §9, ADR-0007).

## Najważniejsze reguły w skrócie
- Zero grafiki własnej; ikony tylko z fontu szablonu; zdjęcia tylko z `assets/manifest.json`, brak = placeholder.
- Wygląd tylko z tokenów (`assets/tokens.css`); poza nim zero `#hex` i `rgb(`.
- Dane z seedu `data/*.json`; w runtime baza; nie dopisujesz produktów, cen, stanów, marek.
- Zero prawdziwych marek, logotypów płatności i przewoźników, adresów, NIP-ów; e-mail tylko `taktyl.example`.
- Ruch tylko z katalogu A-01...A-18; `transform` i `opacity`; `prefers-reduced-motion`.
- Polszczyzna przez `Intl`; kwoty w groszach.
- Każda funkcja ma ID (`F-`, `A-`, `B-`, `I-`) w komentarzu i commicie.
- Zdarzenia tylko z `docs/10`. Sklep jest demonstracyjny (pasek demo, symulacja płatności, `noindex`).
- Brak w dokumentach = pytanie (`Q-xx` w `docs/decyzje.md`), nie zgadywanie.
- Wszystko działa w Dockerze (ADR-0009); nie zakładaj lokalnego Node ani Postgresa.
- Repo jest publiczne: przed commitem `taktyl-straznik-repo`.
- Wersje zależności i obrazów (ADR-0010, I-008): przed przypięciem wersji sprawdź najnowszą stabilną (`npm view <pkg> version`, `npm view <pkg> dist-tags`, `docker buildx imagetools inspect <obraz>`); nie polegaj na pamięci.

## Kontrola na starcie
- [ ] Wiem, które ID (`F-xxx`/`B-xxx`/`I-xxx`) realizuję.
- [ ] Przeczytałem dokument zadania i powiązane ADR.
- [ ] Zadanie w task-managerze (projekt `taktyl`) ma kryteria odbioru i priorytet (Definition of Ready).
- [ ] Wiem, którego specjalisty z `.claude/agents/` potrzebuję.
