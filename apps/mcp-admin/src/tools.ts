// I-014 (docs/24): narzedzia MCP backoffice = pelny panel przez /v1/admin/* (docs/16 §3). Cienkie nakladki: walidacja wejscia
// schematami z @taktyl/contracts, zadnej logiki biznesowej i zadnego dostepu do bazy. Role egzekwuje API (viewer tylko GET).
// Operacje nieodwracalne albo szerokie (usuwanie, reset demo, uzytkownicy i role, ustawienia, anulowanie zamowienia,
// zastepowanie calych list) wymagaja `confirm: true`.
import {
  categoryPatchSchema,
  contentCreateSchema,
  contentPatchSchema,
  createUserRequestSchema,
  descriptionPutSchema,
  dictionaryPatchSchema,
  faqPutSchema,
  messagePatchSchema,
  orderNoteRequestSchema,
  orderTransitionRequestSchema,
  presetUpdateSchema,
  productCreateSchema,
  productPatchSchema,
  reviewsPutSchema,
  revalidateRequestSchema,
  rulesPatchSchema,
  setPriceRequestSchema,
  setStockRequestSchema,
  settingsPatchSchema,
  updateUserRequestSchema,
  variantCreateSchema,
  variantPatchSchema,
} from "@taktyl/contracts";
import {
  defineTool,
  idParam,
  orderNumberParam,
  productIdParam,
  seg,
  skuParam,
  type ApiClient,
  type Risk,
  type Tool,
} from "@taktyl/mcp-core";
import { z } from "zod";

type Role = "viewer" | "editor" | "owner";

const version = z
  .number()
  .int()
  .min(1)
  .describe(
    "Wersja zasobu (pole version / ETag z odczytu); wysylana jako If-Match. Wymagana, zeby nie nadpisac cudzej zmiany.",
  );
const optVersion = version.optional();
const ifMatch = (v: number | undefined): Record<string, string> =>
  v === undefined ? {} : { "if-match": `"${v}"` };

const page = {
  page: z.number().int().min(1).optional().describe("Numer strony (od 1)."),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Wynikow na strone (1-100, domyslnie 25)."),
};

export function adminTools(api: ApiClient): Tool[] {
  const send = async (
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ) =>
    (
      await api.request(method, path, {
        ...(body === undefined ? {} : { body }),
        ...(headers ? { headers } : {}),
      })
    ).data;

  const list = (
    name: string,
    title: string,
    description: string,
    path: string,
    extra: z.ZodRawShape = {},
    role: Role = "viewer",
    paged = true,
  ) =>
    defineTool({
      name,
      title,
      description: `${description} (rola: ${role}+)`,
      risk: "read",
      role,
      inputSchema: paged ? { ...extra, ...page } : extra,
      run: (i: Record<string, unknown>) =>
        api.get(path, { query: i as Record<string, string | number | boolean | undefined> }),
    });

  const mutate = <S extends z.ZodRawShape>(o: {
    name: string;
    title: string;
    description: string;
    role: Role;
    risk: Risk;
    shape: S;
    idempotent?: boolean;
    needsConfirm?: (i: z.infer<z.ZodObject<S>>) => boolean;
    call: (i: z.infer<z.ZodObject<S>>) => Promise<unknown>;
  }) =>
    defineTool({
      name: o.name,
      title: o.title,
      description: `${o.description} (rola: ${o.role}+; zapisuje wpis w dzienniku zmian)`,
      risk: o.risk,
      role: o.role,
      ...(o.idempotent === undefined ? {} : { idempotent: o.idempotent }),
      inputSchema: o.shape,
      ...(o.needsConfirm ? { needsConfirm: o.needsConfirm } : {}),
      run: (i) => o.call(i),
    });

  return [
    // ---- sesja, pulpit, dziennik ----
    defineTool({
      name: "whoami",
      title: "Biezacy uzytkownik",
      description:
        "Biezacy uzytkownik backpanelu i jego rola (owner, editor, viewer). Rola decyduje, ktore narzedzia zadzialaja.",
      risk: "read",
      role: "viewer",
      inputSchema: {},
      run: async () => {
        const me = (await api.get("/v1/admin/auth/me")) as { csrf_token?: string };
        const { csrf_token: _t, ...rest } = me;
        return rest;
      },
    }),
    defineTool({
      name: "get_dashboard",
      title: "Pulpit",
      description:
        "Liczby z pulpitu: zamowienia do obslugi, niskie stany, brakujace zdjecia, nieudane webhooki, przychod (rola: viewer+).",
      risk: "read",
      role: "viewer",
      inputSchema: {},
      run: () => api.get("/v1/admin/dashboard"),
    }),
    list(
      "list_audit",
      "Dziennik zmian",
      "Dziennik zmian (kto, kiedy, encja, before/after) z filtrami; dla viewer pola osobowe sa zamaskowane.",
      "/v1/admin/audit",
      {
        entity: z.string().max(40).optional().describe("Typ encji, np. product, variant, order."),
        entity_id: z.string().max(80).optional(),
        actor_id: z.string().max(80).optional(),
        from: z.string().max(40).optional().describe("Od (ISO 8601 z przesunieciem)."),
        to: z.string().max(40).optional().describe("Do (ISO 8601 z przesunieciem)."),
      },
    ),

    // ---- uzytkownicy (owner) ----
    list(
      "list_users",
      "Konta backpanelu",
      "Lista kont i ich rol.",
      "/v1/admin/users",
      {},
      "owner",
      false,
    ),
    mutate({
      name: "create_user",
      title: "Nowe konto backpanelu",
      description:
        "Tworzy konto z rola i haslem poczatkowym (min. 12 znakow). Nadaje dostep do panelu, dlatego wymaga confirm. Haslo nie jest zapisywane w dzienniku ani w logach serwera MCP.",
      role: "owner",
      risk: "destructive",
      shape: { user: createUserRequestSchema },
      call: (i) => send("POST", "/v1/admin/users", i.user),
    }),
    mutate({
      name: "update_user",
      title: "Zmiana konta (rola, dezaktywacja, reset hasla)",
      description:
        "Zmienia role, dezaktywuje konto albo resetuje haslo (reset_password: true zwraca temporary_password jednorazowo i konczy sesje konta). Nie mozna odebrac roli ostatniemu ownerowi.",
      role: "owner",
      risk: "destructive",
      idempotent: false,
      shape: { id: idParam, patch: updateUserRequestSchema },
      call: (i) => send("PATCH", `/v1/admin/users/${seg(i.id)}`, i.patch),
    }),

    // ---- katalog ----
    list(
      "list_products",
      "Produkty (panel)",
      "Lista produktow z filtrami: category, status (active/archived), missing_image=1, low_stock=1, promo=1, q (wyszukiwanie), sort (np. -updated_at).",
      "/v1/admin/products",
      {
        category: z.enum(["klawiatury", "myszki", "podkladki"]).optional(),
        status: z.enum(["active", "archived"]).optional(),
        missing_image: z.literal("1").optional(),
        low_stock: z.literal("1").optional(),
        promo: z.literal("1").optional(),
        q: z.string().trim().min(1).max(80).optional(),
        sort: z
          .string()
          .regex(/^-?[a-z_]+$/)
          .optional(),
      },
    ),
    defineTool({
      name: "get_product",
      title: "Produkt (panel)",
      description:
        "Produkt z wariantami, stanami, historia cen i zdjeciami (rola: viewer+). Zwraca tez version potrzebna do edycji.",
      risk: "read",
      role: "viewer",
      inputSchema: { id: productIdParam },
      run: (i) => api.get(`/v1/admin/products/${seg(i.id)}`),
    }),
    mutate({
      name: "create_product",
      title: "Nowy produkt",
      description:
        "Tworzy produkt (atrybuty zgodne ze schematem kategorii). Bez wariantow zostaje zarchiwizowany do czasu dodania pierwszego wariantu (create_variant). Nie dopisuj produktow do seeda: zmiany robi sie tylko przez panel/API.",
      role: "editor",
      risk: "write",
      idempotent: false,
      shape: { product: productCreateSchema },
      call: (i) => send("POST", "/v1/admin/products", i.product),
    }),
    mutate({
      name: "update_product",
      title: "Edycja produktu",
      description:
        "Zmienia nazwe, slug, opis krotki, atrybuty (scalane plytko), plakietki, fit, zawartosc, GPSR, wariant domyslny, status.",
      role: "editor",
      risk: "write",
      idempotent: true,
      shape: { id: productIdParam, version, patch: productPatchSchema },
      call: (i) => send("PATCH", `/v1/admin/products/${seg(i.id)}`, i.patch, ifMatch(i.version)),
    }),
    mutate({
      name: "delete_product",
      title: "Usuniecie produktu",
      description:
        "Twarde usuniecie produktu, tylko gdy nie ma zamowien (inaczej 409, uzyj update_product ze status=archived). Nieodwracalne.",
      role: "owner",
      risk: "destructive",
      idempotent: true,
      shape: { id: productIdParam },
      call: (i) => send("DELETE", `/v1/admin/products/${seg(i.id)}`),
    }),
    mutate({
      name: "set_product_description",
      title: "Opis produktu",
      description:
        "Ustawia opis produktu (akapity rozdzielone pusta linia; HTML jest usuwany). Opis ma powstawac z atrybutow produktu. Prawdziwe marki i twierdzenia medyczne sa blokowane (422), styl i dlugosc to ostrzezenia.",
      role: "editor",
      risk: "write",
      idempotent: true,
      shape: { id: productIdParam, version, description: descriptionPutSchema },
      call: (i) =>
        send(
          "PUT",
          `/v1/admin/products/${seg(i.id)}/description`,
          i.description,
          ifMatch(i.version),
        ),
    }),
    mutate({
      name: "create_variant",
      title: "Nowy wariant",
      description:
        "Dodaje wariant produktu (SKU wg wzoru z docs/04 §3.1, kolor, przelacznik albo rozmiar, cena i stan).",
      role: "editor",
      risk: "write",
      idempotent: false,
      shape: { product_id: productIdParam, variant: variantCreateSchema },
      call: (i) => send("POST", `/v1/admin/products/${seg(i.product_id)}/variants`, i.variant),
    }),
    mutate({
      name: "update_variant",
      title: "Edycja wariantu",
      description:
        "Zmienia kolor, przelacznik, rozmiar, klucz zdjec albo dostepnosc (active/disabled). Cene i stan zmieniaja set_price i set_stock.",
      role: "editor",
      risk: "write",
      idempotent: true,
      shape: { sku: skuParam, version, patch: variantPatchSchema },
      call: (i) => send("PATCH", `/v1/admin/variants/${seg(i.sku)}`, i.patch, ifMatch(i.version)),
    }),
    mutate({
      name: "delete_variant",
      title: "Usuniecie wariantu",
      description: "Usuwa wariant, tylko gdy nie ma zamowien (inaczej wylacza). Nieodwracalne.",
      role: "owner",
      risk: "destructive",
      idempotent: true,
      shape: { sku: skuParam },
      call: (i) => send("DELETE", `/v1/admin/variants/${seg(i.sku)}`),
    }),
    mutate({
      name: "set_price",
      title: "Zmiana ceny wariantu",
      description:
        "Ustawia nowa cene (price_gr w groszach, regular_price_gr to cena przed obnizka lub null). Zamyka biezacy wiersz historii cen i dopisuje nowy; najnizsza cena z 30 dni liczy serwer. Zmiana jest widoczna w sklepie w ciagu 5 s.",
      role: "editor",
      risk: "write",
      idempotent: true,
      shape: { sku: skuParam, version: optVersion, price: setPriceRequestSchema },
      call: (i) =>
        send("PUT", `/v1/admin/variants/${seg(i.sku)}/price`, i.price, ifMatch(i.version)),
    }),
    defineTool({
      name: "get_price_history",
      title: "Historia cen wariantu",
      description:
        "Historia cen wariantu i wyliczona najnizsza cena z 30 dni z oknem obliczenia (rola: viewer+).",
      risk: "read",
      role: "viewer",
      inputSchema: { sku: skuParam },
      run: (i) => api.get(`/v1/admin/variants/${seg(i.sku)}/price-history`),
    }),
    mutate({
      name: "set_stock",
      title: "Korekta stanu wariantu",
      description:
        "Ustawia stan magazynowy (liczba calkowita >= 0) z powodem; zapisuje ruch magazynowy typu adjustment.",
      role: "editor",
      risk: "write",
      idempotent: true,
      shape: { sku: skuParam, version: optVersion, stock: setStockRequestSchema },
      call: (i) =>
        send("PUT", `/v1/admin/variants/${seg(i.sku)}/stock`, i.stock, ifMatch(i.version)),
    }),
    defineTool({
      name: "get_stock_movements",
      title: "Ruchy magazynowe wariantu",
      description:
        "Historia ruchow magazynowych wariantu: korekta, sprzedaz, anulowanie (rola: viewer+).",
      risk: "read",
      role: "viewer",
      inputSchema: { sku: skuParam },
      run: (i) => api.get(`/v1/admin/variants/${seg(i.sku)}/stock-movements`),
    }),
    defineTool({
      name: "list_presets",
      title: "Gotowe sety (panel)",
      description: "Gotowe sety ze skladem, profilem i cena liczona (rola: viewer+).",
      risk: "read",
      role: "viewer",
      inputSchema: {},
      run: () => api.get("/v1/admin/presets"),
    }),
    mutate({
      name: "update_preset",
      title: "Edycja gotowego setu",
      description:
        "Zmienia nazwe, notatke, profil albo sklad (dokladnie 3 SKU z trzech kategorii). Cena jest liczona, nie edytowalna.",
      role: "editor",
      risk: "write",
      idempotent: true,
      shape: { id: idParam, version, patch: presetUpdateSchema },
      call: (i) => send("PUT", `/v1/admin/presets/${seg(i.id)}`, i.patch, ifMatch(i.version)),
    }),
    mutate({
      name: "update_category",
      title: "Edycja kategorii",
      description: "Zmienia nazwe, H1, wstep albo kolejnosc kategorii.",
      role: "editor",
      risk: "write",
      idempotent: true,
      shape: {
        id: z.enum(["klawiatury", "myszki", "podkladki"]),
        version: optVersion,
        patch: categoryPatchSchema,
      },
      call: (i) => send("PATCH", `/v1/admin/categories/${seg(i.id)}`, i.patch, ifMatch(i.version)),
    }),
    mutate({
      name: "update_switch",
      title: "Edycja przelacznika (slownik)",
      description: "Zmienia etykiete, nazwe albo opis przelacznika w slowniku.",
      role: "editor",
      risk: "write",
      idempotent: true,
      shape: { id: idParam, version: optVersion, patch: dictionaryPatchSchema },
      call: (i) => send("PATCH", `/v1/admin/switches/${seg(i.id)}`, i.patch, ifMatch(i.version)),
    }),
    mutate({
      name: "update_color",
      title: "Edycja koloru (slownik)",
      description: "Zmienia etykiete albo probke (swatch) koloru w slowniku.",
      role: "editor",
      risk: "write",
      idempotent: true,
      shape: { id: idParam, version: optVersion, patch: dictionaryPatchSchema },
      call: (i) => send("PATCH", `/v1/admin/colors/${seg(i.id)}`, i.patch, ifMatch(i.version)),
    }),
    mutate({
      name: "update_rules",
      title: "Reguly dopasowania",
      description:
        "Zmienia profile i parametry regul dopasowania kreatora setu (nieznana regula = 422). Wplywa na caly sklep, dlatego wymaga confirm.",
      role: "owner",
      risk: "write",
      idempotent: true,
      needsConfirm: () => true,
      shape: { version: optVersion, patch: rulesPatchSchema },
      call: (i) => send("PATCH", "/v1/admin/rules", i.patch, ifMatch(i.version)),
    }),

    // ---- zamowienia ----
    list(
      "list_orders",
      "Zamowienia (panel)",
      "Lista zamowien z filtrami; e-mail klienta jest zawsze zamaskowany.",
      "/v1/admin/orders",
      {
        status: z
          .string()
          .regex(/^[a-z_]{3,30}$/)
          .optional()
          .describe("Np. paid, processing, shipped, delivered, cancelled."),
        from: z.string().max(10).optional().describe("Od daty RRRR-MM-DD (Europe/Warsaw)."),
        to: z.string().max(10).optional().describe("Do daty RRRR-MM-DD."),
        number: z.string().max(20).optional(),
        payment_type: z
          .string()
          .regex(/^[a-z_]{3,30}$/)
          .optional(),
        shipping_method: z
          .string()
          .regex(/^[a-z0-9_-]{2,30}$/)
          .optional(),
        sort: z
          .string()
          .regex(/^-?[a-z_]+$/)
          .optional(),
      },
    ),
    defineTool({
      name: "get_order",
      title: "Zamowienie (panel)",
      description:
        "Szczegoly zamowienia: pozycje, rabaty, dostawa, platnosc, historia statusow, notatki i dozwolone przejscia. Dla roli viewer dane osobowe sa zamaskowane (rola: viewer+).",
      risk: "read",
      role: "viewer",
      inputSchema: { number: orderNumberParam },
      run: (i) => api.get(`/v1/admin/orders/${seg(i.number)}`),
    }),
    mutate({
      name: "transition_order",
      title: "Zmiana statusu zamowienia",
      description:
        "Przechodzi na processing, shipped, delivered albo cancelled (dozwolone przejscia w allowed_transitions z get_order). Anulowanie wymaga note (min. 5 znakow), zwraca stan do magazynu i wymaga confirm.",
      role: "editor",
      risk: "write",
      idempotent: false,
      needsConfirm: (i) => i.transition.to === "cancelled",
      shape: { number: orderNumberParam, transition: orderTransitionRequestSchema },
      call: (i) => send("POST", `/v1/admin/orders/${seg(i.number)}/transition`, i.transition),
    }),
    mutate({
      name: "add_order_note",
      title: "Notatka do zamowienia",
      description: "Dodaje notatke wewnetrzna do zamowienia (tresc nie trafia do dziennika).",
      role: "editor",
      risk: "write",
      idempotent: false,
      shape: { number: orderNumberParam, note: orderNoteRequestSchema },
      call: (i) => send("POST", `/v1/admin/orders/${seg(i.number)}/note`, i.note),
    }),

    // ---- tresci ----
    list(
      "list_content",
      "Tresci (strony i poradniki)",
      "Strony informacyjne/prawne (type=page) i artykuly poradnika (type=guide).",
      "/v1/admin/content",
      { type: z.enum(["page", "guide"]).optional() },
      "viewer",
      false,
    ),
    defineTool({
      name: "get_content",
      title: "Pojedyncza tresc",
      description: "Strona albo artykul z wersja (version) do edycji (rola: viewer+).",
      risk: "read",
      role: "viewer",
      inputSchema: { id: idParam },
      run: (i) => api.get(`/v1/admin/content/${seg(i.id)}`),
    }),
    mutate({
      name: "create_content",
      title: "Nowa strona albo artykul",
      description:
        "Tworzy strone lub artykul poradnika (Markdown ograniczony i sanityzowany; odpowiedz niesie warnings).",
      role: "editor",
      risk: "write",
      idempotent: false,
      shape: { content: contentCreateSchema },
      call: (i) => send("POST", "/v1/admin/content", i.content),
    }),
    mutate({
      name: "update_content",
      title: "Edycja tresci",
      description:
        "Edytuje, publikuje albo cofa do szkicu. Naglowek 'Wzor tresci...' (demo_notice) jest nieusuwalny.",
      role: "editor",
      risk: "write",
      idempotent: true,
      shape: { id: idParam, version, patch: contentPatchSchema },
      call: (i) => send("PATCH", `/v1/admin/content/${seg(i.id)}`, i.patch, ifMatch(i.version)),
    }),
    mutate({
      name: "delete_content",
      title: "Usuniecie artykulu",
      description:
        "Usuwa artykul poradnika. Strony informacyjne i prawne mozna tylko archiwizowac (409 system_page). Nieodwracalne.",
      role: "owner",
      risk: "destructive",
      idempotent: true,
      shape: { id: idParam },
      call: (i) => send("DELETE", `/v1/admin/content/${seg(i.id)}`),
    }),
    defineTool({
      name: "get_faq",
      title: "FAQ (panel)",
      description: "FAQ w kolejnosci, takze szkice (rola: viewer+).",
      risk: "read",
      role: "viewer",
      inputSchema: {},
      run: () => api.get("/v1/admin/faq"),
    }),
    mutate({
      name: "put_faq",
      title: "Zapis calego FAQ",
      description:
        "Zastepuje cala liste FAQ: dodaje, zmienia i USUWA pominiete pozycje. Najpierw odczytaj get_faq i przeslij pelna liste.",
      role: "editor",
      risk: "write",
      idempotent: true,
      needsConfirm: () => true,
      shape: { faq: faqPutSchema },
      call: (i) => send("PUT", "/v1/admin/faq", i.faq),
    }),
    list(
      "list_reviews",
      "Opinie demo (panel)",
      "Opinie demonstracyjne pogrupowane po produkcie, ze srednia i liczba.",
      "/v1/admin/reviews",
      { product_id: productIdParam.optional() },
      "viewer",
      false,
    ),
    mutate({
      name: "put_reviews",
      title: "Zapis opinii produktu",
      description:
        "Ustawia zestaw 3-6 opinii demonstracyjnych produktu (oceny 3-5, flaga demo wymuszona). Zastepuje poprzedni zestaw.",
      role: "editor",
      risk: "write",
      idempotent: true,
      needsConfirm: () => true,
      shape: { product_id: productIdParam, version: optVersion, reviews: reviewsPutSchema },
      call: (i) =>
        send(
          "PUT",
          `/v1/admin/products/${seg(i.product_id)}/reviews`,
          i.reviews,
          ifMatch(i.version),
        ),
    }),
    list(
      "list_messages",
      "Zgloszenia z formularzy",
      "Wiadomosci z formularza kontaktu i zapisy newslettera; viewer widzi e-mail zamaskowany, a tresc ukryta.",
      "/v1/admin/messages",
      { kind: z.enum(["contact", "newsletter"]).optional() },
    ),
    mutate({
      name: "update_message",
      title: "Oznaczenie zgloszenia jako obsluzone",
      description: "Ustawia handled=true/false dla wiadomosci kontaktowej.",
      role: "editor",
      risk: "write",
      idempotent: true,
      shape: { id: idParam, patch: messagePatchSchema },
      call: (i) => send("PATCH", `/v1/admin/messages/${seg(i.id)}`, i.patch),
    }),
    mutate({
      name: "delete_message",
      title: "Usuniecie zgloszenia",
      description:
        "Usuwa zgloszenie (RODO w demo). Nieodwracalne; w dzienniku zostaje tylko rodzaj, id i data.",
      role: "owner",
      risk: "destructive",
      idempotent: true,
      shape: { id: idParam },
      call: (i) => send("DELETE", `/v1/admin/messages/${seg(i.id)}`),
    }),

    // ---- ustawienia, media, cache, demo ----
    defineTool({
      name: "get_settings",
      title: "Ustawienia sklepu (panel)",
      description:
        "Pelne ustawienia: rabat setu, prog dostawy, metody dostawy i platnosci, kody rabatowe z logika, punkty odbioru, etykieta demo, dane firmy. Zawiera version (rola: viewer+).",
      risk: "read",
      role: "viewer",
      inputSchema: {},
      run: () => api.get("/v1/admin/settings"),
    }),
    mutate({
      name: "update_settings",
      title: "Zmiana ustawien sklepu",
      description:
        "Zmienia ustawienia sklepu (listy metod, kodow i punktow zastepuja cale listy, wiec najpierw odczytaj get_settings). Etykieta demo nie moze byc pusta. Wplywa na caly sklep, dlatego wymaga confirm.",
      role: "owner",
      risk: "write",
      idempotent: true,
      needsConfirm: () => true,
      shape: { version, patch: settingsPatchSchema },
      call: (i) => send("PATCH", "/v1/admin/settings", i.patch, ifMatch(i.version)),
    }),
    list(
      "list_media",
      "Zdjecia (manifest)",
      "Sloty zdjec z manifestu: klucz, rodzaj, wymiary, priorytet, status (gotowe/brak). Wgrywanie plikow odbywa sie w panelu.",
      "/v1/admin/media",
      {
        status: z.enum(["gotowe", "brak"]).optional(),
        kind: z.enum(["packshot", "topdown", "texture"]).optional(),
      },
    ),
    mutate({
      name: "delete_media",
      title: "Usuniecie zdjecia",
      description:
        "Usuwa plik zdjecia dla klucza manifestu (status brak, wraca placeholder). Nieodwracalne.",
      role: "owner",
      risk: "destructive",
      idempotent: true,
      shape: {
        key: z
          .string()
          .regex(/^[a-z0-9_.-]{3,120}$/)
          .describe("Klucz z list_media, np. k-bazalt-75_grafit_01-34"),
      },
      call: (i) => send("DELETE", `/v1/admin/media/${seg(i.key)}`),
    }),
    mutate({
      name: "revalidate_tags",
      title: "Reczne odswiezenie cache sklepu",
      description:
        "Wysyla znaczniki cache (np. catalog, presets, product:bazalt-75) do kolejki outbox; sklep odswiezy dane. Diagnostyka.",
      role: "owner",
      risk: "write",
      idempotent: true,
      shape: { request: revalidateRequestSchema },
      call: (i) => send("POST", "/v1/admin/revalidate", i.request),
    }),
    mutate({
      name: "reset_demo",
      title: "Reset danych demo",
      description:
        "Przywraca dane demo do seeda (produkty, ceny, stany, zamowienia, sesje). Dziala tylko przy DEMO_MODE=true w API. NIEODWRACALNE: kasuje wszystkie zmiany i zamowienia.",
      role: "owner",
      risk: "destructive",
      idempotent: true,
      shape: {},
      call: () => send("POST", "/v1/admin/demo/reset", { confirm: "reset" }),
    }),
  ];
}
