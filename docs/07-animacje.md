# 07 · Animacje

Zasada: **ruch odpowiada na działanie klienta i pokazuje, co się zmieniło.** Jeden zaplanowany moment bez działania klienta (A-02 w pierwszym ekranie) i jeden moment nagrody (A-16 po skompletowaniu setu). Nic poza tym nie rusza się samo.

Sygnatura Taktyla to **wciśnięcie klawisza**: przyciski mają dolną krawędź jak keycap i przy kliknięciu zjeżdżają o 2 px. Ten jeden gest powtarza się wszędzie i wystarcza, żeby strona „klikała” pod palcem.

Wszystko obejrzysz w `podglad/podglad-palety-i-animacji.html`.

## 1. Reguły techniczne

- Animujesz `transform` i `opacity`. Kolory (`background-color`, `border-color`, `outline-color`, `box-shadow` krawędzi klawisza) wolno płynnie zmieniać — nie przeliczają układu. **Nigdy** `width`, `height`, `top`, `left`, `margin`, `padding`, `font-size`.
- Czasy i krzywe wyłącznie z tokenów: `--d-klik` 90 ms, `--d-s` 160 ms, `--d-m` 220 ms, `--d-l` 300 ms, `--d-scena` 900 ms (tylko A-02 i A-16); `--e-wyjscie`, `--e-wejscie`, `--e-osadzenie`.
- Elementy wchodzące: `--e-wyjscie` albo `--e-osadzenie`. Znikające: `--e-wejscie`, krócej niż wejście.
- `prefers-reduced-motion: reduce` — tokeny czasu spadają do zera (`assets/tokens.css`), sekwencje pokazują stan końcowy, licznik ceny pokazuje wartość od razu.
- Żadnej biblioteki animacji. GSAP, WOW.js, AOS, Anime, Swiper-efekty z szablonu — usunięte (`docs/08` §4). CSS + kilkanaście linii JS.
- `will-change` tylko na czas trwania animacji, zdejmowane po `animationend` / `transitionend`.
- Żadna animacja nie zaczyna się od `opacity: 0` na elemencie z pierwszego ekranu — opóźniłaby pomiar największego elementu treści (LCP). Pierwszy ekran rusza się wyłącznie przesunięciem.

## 2. Katalog

| ID | Gdzie | Wyzwalacz | Co się dzieje | Czas · krzywa |
|---|---|---|---|---|
| **A-01** | każdy przycisk główny i poboczny | `:active`, Enter/Spacja | `translateY(2px)`, krawędź klawisza z 3 px na 1 px | `--d-klik` · `--e-wyjscie` |
| **A-02** | pierwszy ekran, `DeskStage` | załadowanie strony, raz na sesję, gdy podgląd jest w widoku | mata `scale(.985→1)`; po 120 ms klawiatura opada `translateY(-28px→0)`; po 260 ms myszka wjeżdża `translateX(36px→0)`; po 520 ms obrys strefy myszki i plakietka „Pasuje · zapas 28,3 cm” pojawiają się | razem ≤ `--d-scena`; mata `--e-wyjscie`, klawiatura i myszka `--e-osadzenie` |
| **A-03** | „Dodaj do koszyka” | dodanie | etykieta przycisku → „Dodano” z ikoną potwierdzenia na 1,2 s; licznik w nagłówku podskakuje `scale(1→1.25→1)`; szuflada koszyka wjeżdża z prawej `translateX(100%→0)`, tło `opacity 0→1` | przycisk `--d-s`; licznik `--d-m` · `--e-osadzenie`; szuflada `--d-m` · `--e-wyjscie` |
| **A-04** | „Razem” w kreatorze i koszyku | zmiana kwoty | cyfry przewijają się od starej do nowej wartości (JS, sekcja 3.3), cyfry tabelaryczne — szerokość się nie zmienia | `--d-l` |
| **A-05** | kafel wyboru, próbka koloru | wybór | obrys i tło przechodzą do stanu wybranego; znacznik w rogu `scale(.6→1)` + `opacity` | kolory `--d-s`; znacznik `--d-m` · `--e-osadzenie` |
| **A-06** | `DeskStage` | zmiana elementu setu | stary element: `opacity 1→0`, `translateY(0→6px)`; nowy (po `img.decode()`): `translateY(-12px→0)`, `opacity 0→1`. Podkładka: przenikanie | wyjście `--d-s` · `--e-wejscie`; wejście `--d-m` · `--e-osadzenie` |
| **A-07** | pasek kroków kreatora | przejście kroku | wypełnienie `scaleX` od lewej (`transform-origin: left`) | `--d-l` · `--e-wyjscie` |
| **A-08** | lista wyników dopasowania | zmiana wyniku | nowy komunikat `opacity 0→1` + `translateY(4px→0)` w **zarezerwowanym** miejscu; zmiana ikony stanu przez przenikanie | `--d-s` · `--e-wyjscie` |
| **A-09** | karta produktu na listingu | najechanie, tylko `(hover: hover) and (pointer: fine)` | drugie ujęcie `opacity 0→1`; pasek „Szybko dodaj” `translateY(100%→0)` u dołu zdjęcia. Bez unoszenia karty, bez powiększania zdjęcia | `--d-m` / `--d-s` |
| **A-10** | serce „ulubione” | dodanie (nie przy usuwaniu) | `scale(1→1.3→1)` + wypełnienie | `--d-m` · `--e-osadzenie` |
| **A-11** | pasek do darmowej dostawy | zmiana koszyka | wypełnienie `scaleX` do nowej proporcji; po przekroczeniu progu zmienia się tylko tekst | `--d-l` · `--e-wyjscie` |
| **A-12** | menu rozwijane, szuflady, okna | otwarcie / zamknięcie | menu: `opacity` + `translateY(-4px→0)`; szuflada: `translateX`; okno: `opacity` + `scale(.98→1)`; tło `opacity` | otwarcie `--d-s`/`--d-m` · `--e-wyjscie`; zamknięcie `--d-s` · `--e-wejscie` |
| **A-13** | zdjęcie w galerii | ruch kursora nad zdjęciem, tylko `pointer: fine` | `scale(1.8)` z `transform-origin` w punkcie kursora (zmienne `--x`, `--y`) | wejście `--d-s` |
| **A-14** | siatka listingu | zmiana filtra lub sortowania | `document.startViewTransition()`; karty mają unikalne `view-transition-name`; bez wsparcia — zmiana natychmiastowa | `--d-m` |
| **A-15** | toast | pojawienie się / zniknięcie | `translateY(16px→0)` + `opacity`; znika samym `opacity` | `--d-m` / `--d-s` |
| **A-16** | podsumowanie kreatora | przejście z 2 na 3 kategorie (nie przy wczytaniu gotowego kompletu) | jednorazowy obieg pierścienia w kolorze `--akcent` wokół karty podsumowania (`conic-gradient` z animowanym kątem `@property`), równocześnie wjeżdża linia „Rabat za set −133,70 zł” | `--d-scena` · `--e-wyjscie`, 1 raz |
| **A-17** | `<kbd>` przy wyszukiwarce i w liście skrótów | użycie skrótu | klawisz wciska się jak A-01 | `--d-klik` |
| **A-18** | podpowiedzi wyszukiwarki, panel „Szybko dodaj” | ładowanie dłuższe niż 300 ms | szkielet z przesuwanym połyskiem (pseudoelement z `translateX`) | pętla tylko w trakcie ładowania |

## 3. Wzorce kodu

### 3.1. A-01 — wciśnięcie klawisza

```css
.btn-glowny{
  background:var(--akcent); color:var(--akcent-tekst);
  border-radius:var(--r); min-height:48px;
  box-shadow:var(--krawedz-klawisza);
  transition:transform var(--d-klik) var(--e-wyjscie),
             box-shadow var(--d-klik) var(--e-wyjscie),
             background-color var(--d-s) var(--e-wyjscie);
}
.btn-glowny:hover{ background:var(--akcent-hover); }
.btn-glowny:active,
.btn-glowny.is-wcisniety{ transform:translateY(2px); box-shadow:var(--krawedz-klawisza-wcisniety); }
```

```js
// Enter nie wyzwala :active — dodaj klasę na czas jednego „kliknięcia”
document.addEventListener('keydown', e => {
  const b = e.target.closest?.('.btn-glowny, .btn-poboczny');
  if (!b || (e.key !== 'Enter' && e.key !== ' ')) return;
  b.classList.add('is-wcisniety');
  setTimeout(() => b.classList.remove('is-wcisniety'), 90);
});
```

### 3.2. A-02 — set ląduje na biurku

```css
.scena-start .scena__mata      { animation:mata-wejscie   400ms var(--e-wyjscie) both; }
.scena-start .scena__klawiatura{ animation:opadanie       420ms var(--e-osadzenie) 120ms both; }
.scena-start .scena__myszka    { animation:wjazd-z-prawej 380ms var(--e-osadzenie) 260ms both; }
.scena-start .scena__strefa,
.scena-start .scena__wynik     { animation:pojawienie     220ms var(--e-wyjscie) 520ms both; }

@keyframes mata-wejscie   { from{ transform:scale(.985); } }
@keyframes opadanie       { from{ transform:translateY(-28px); } }
@keyframes wjazd-z-prawej { from{ transform:translateX(36px); } }
@keyframes pojawienie     { from{ opacity:0; transform:translateY(4px); } } /* tylko małe elementy, nie LCP */
```

Klasę `scena-start` dodaje skrypt raz na sesję (`sessionStorage`, w `try/catch`), gdy `IntersectionObserver` zgłosi widoczność podglądu. Klawiatura, mata i myszka są widoczne od pierwszej klatki — ruszają się tylko przesunięciem.

### 3.3. A-04 — przewijana cena

```js
const zl = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
export function animujKwote(el, odGr, doGr, ms = 300) {
  const live = el.closest('[data-kwota]')?.querySelector('[data-kwota-live]'); // ukryty region aria-live
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || odGr === doGr) {
    el.textContent = zl.format(doGr / 100); if (live) live.textContent = el.textContent; return;
  }
  const t0 = performance.now(), ease = t => 1 - Math.pow(1 - t, 3);
  const krok = now => {
    const t = Math.min(1, (now - t0) / ms);
    el.textContent = zl.format(Math.round(odGr + (doGr - odGr) * ease(t)) / 100);
    if (t < 1) requestAnimationFrame(krok);
    else if (live) live.textContent = el.textContent;   // czytnik słyszy tylko wynik
  };
  requestAnimationFrame(krok);
}
```

Element z kwotą ma `font-variant-numeric: tabular-nums` i `aria-hidden="true"`; obok ukryty wizualnie `<span data-kwota-live aria-live="polite">`.

### 3.4. A-16 — set kompletny

```css
@property --kat{ syntax:'<angle>'; inherits:false; initial-value:0deg; }
.podsumowanie{ position:relative; }
.podsumowanie.is-komplet::before{
  content:""; position:absolute; inset:-2px; border-radius:calc(var(--r) + 2px); padding:2px;
  background:conic-gradient(from var(--kat), transparent 0 70%, var(--akcent) 85%, transparent 100%);
  -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite:xor; mask-composite:exclude;
  animation:obieg var(--d-scena) var(--e-wyjscie) 1 forwards; pointer-events:none;
}
@keyframes obieg{ from{ --kat:0deg; opacity:1; } 90%{ opacity:1; } to{ --kat:360deg; opacity:0; } }
```

Klasa `is-komplet` dodawana tylko przy zmianie z 2 na 3 kategorie i zdejmowana po `animationend` z `animationName === 'obieg'` — zdarzenie bąbelkuje z dzieci (wyniki, linia rabatu też się animują), więc bez sprawdzenia nazwy klasa znika po 160 ms. Przeglądarka bez `@property` — brak animacji, nic się nie psuje.

### 3.5. A-14 — przejście siatki

```js
function pokazWyniki(render) {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return render();
  document.startViewTransition(render);
}
```

```css
.karta-produktu{ view-transition-name:var(--vt); }        /* --vt: karta-k-bazalt-75 ustawiane w HTML */
::view-transition-group(*){ animation-duration:var(--d-m); animation-timing-function:var(--e-wyjscie); }
```

## 4. Czego nie animujesz

- Pojawiania się sekcji przy przewijaniu (usuń `data-wow-*`, `.wow`, `data-aos`, ScrollTrigger z szablonu).
- Paralaksy, przechylania kart przy najechaniu (efekt 3D), kursora podążającego za myszą.
- Karuzeli z automatycznym przewijaniem — w pierwszym ekranie nie ma karuzeli w ogóle.
- Przewijanych pasków z hasłami (marquee) — pasek warunków stoi.
- Animowanych gradientów w tle, pulsowania, tęczowego „RGB” w pętli.
- Efektu pisania na klawiaturze w nagłówku.
- Liczników rosnących przy przewinięciu.
- Cen na listingu.
- Przejść między stronami (poza A-14 w obrębie listingu).
- Czegokolwiek dłuższego niż 300 ms poza A-02 i A-16.

## 5. Kontrola

- DevTools → Rendering → „Emulate CSS prefers-reduced-motion: reduce”: wszystkie stany końcowe od razu, nic nie znika.
- DevTools → Performance, nagranie A-02, A-03, A-06: brak fioletowych bloków „Layout” w trakcie animacji, CLS = 0.
- Przejście całej strony klawiaturą: A-01 widoczne przy Enter i Spacji.
