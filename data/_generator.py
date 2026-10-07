#!/usr/bin/env python3
"""Generator danych katalogu Taktyl (sklep fikcyjny). Jedno źródło prawdy dla data/*.json i assets/manifest.json."""
import json, hashlib, os, sys
from decimal import Decimal, ROUND_HALF_UP

OUT = sys.argv[1]
os.makedirs(os.path.join(OUT, "data"), exist_ok=True)
os.makedirs(os.path.join(OUT, "assets"), exist_ok=True)

def dump(rel, obj):
    with open(os.path.join(OUT, rel), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")

def money(x):
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

COLORS = {
    "grafit":    {"code": "GRF", "label": "Grafit",          "harmony": "grafit",    "swatch": "#2B3038"},
    "mgla":      {"code": "MGL", "label": "Mgła",            "harmony": "mgla",      "swatch": "#D9DDE2"},
    "kobalt":    {"code": "KOB", "label": "Kobalt",          "harmony": "kobalt",    "swatch": "#2B4FD6"},
    "naturalny": {"code": "NAT", "label": "Naturalny korek", "harmony": "neutralny", "swatch": "#B8916A"},
}

SWITCHES = [
    {"id": "slizg",  "code": "SLZ", "name": "Ślizg",  "type": "liniowy",  "type_label": "liniowy",       "force_g": 45,
     "sound": "umiarkowany", "summary": "Gładki skok bez progu. Szybkie, równe wciśnięcie."},
    {"id": "prog",   "code": "PRG", "name": "Próg",   "type": "taktylny", "type_label": "taktylny",      "force_g": 55,
     "sound": "umiarkowany", "summary": "Wyczuwalny próg w połowie skoku. Czujesz zadziałanie bez dobijania do dna."},
    {"id": "trzask", "code": "TRZ", "name": "Trzask", "type": "klikajacy","type_label": "klikający",     "force_g": 60,
     "sound": "głośny", "summary": "Wyraźny klik przy zadziałaniu. Słychać go w całym pokoju."},
    {"id": "szept",  "code": "SZP", "name": "Szept",  "type": "cichy",    "type_label": "cichy liniowy", "force_g": 40,
     "sound": "cichy", "summary": "Wytłumiony skok i powrót. Do open space i pracy nocą."},
]
SW = {s["id"]: s for s in SWITCHES}

PROFILES = ["fps", "gry", "programowanie", "biuro", "cisza"]

def fit(*v):
    return dict(zip(PROFILES, v))

GPSR = {
    "manufacturer": "Taktyl (podmiot fikcyjny)",
    "address": "ul. Klawiszowa 87, 00-000 Warszawa (adres fikcyjny)",
    "contact": "bezpieczenstwo@taktyl.example",
}

KEYBOARDS = [
    dict(id="k-kwarc-60", slug="kwarc-60", name="Kwarc 60", line="Kwarc", code="KWR60",
         size="60", size_label="60%", keys=61, connectivity=["usb-c"], case="tworzywo", mount="tray", hotswap=True,
         keycaps="ABS double-shot", backlight="białe", battery=None, knob=False,
         weight_g=590, dims=dict(w=293, d=102, h=40), colors=["grafit", "mgla"], price=299,
         fit=fit(3, 3, 1, 1, 1), badges=[],
         short="Kompaktowa 60% na przewodzie. Najwięcej miejsca na myszkę przy najniższej cenie w katalogu.",
         in_box=["kabel USB-C – USB-A 1,8 m", "ściągacz do keycapów i przełączników"]),
    dict(id="k-lupek-65", slug="lupek-65", name="Łupek 65", line="Łupek", code="LPK65",
         size="65", size_label="65%", keys=68, connectivity=["usb-c", "2.4ghz", "bt"], case="tworzywo", mount="gasket", hotswap=True,
         keycaps="PBT double-shot", backlight="RGB", battery="4000 mAh", knob=False,
         weight_g=780, dims=dict(w=318, d=108, h=40), colors=["grafit", "mgla", "kobalt"], price=429,
         fit=fit(2, 3, 2, 2, 2), badges=["bestseller"],
         short="65% ze strzałkami i trzema trybami łączności. Mocowanie gasket tłumi stuk, hot-swap pozwala zmienić przełączniki bez lutowania.",
         in_box=["kabel USB-C – USB-A 1,8 m", "odbiornik 2,4 GHz", "ściągacz do keycapów i przełączników"]),
    dict(id="k-bazalt-75", slug="bazalt-75", name="Bazalt 75", line="Bazalt", code="BZL75",
         size="75", size_label="75%", keys=82, connectivity=["usb-c", "2.4ghz", "bt"], case="aluminium", mount="gasket", hotswap=True,
         keycaps="PBT double-shot", backlight="RGB", battery="4000 mAh", knob=True,
         weight_g=1850, dims=dict(w=327, d=140, h=36), colors=["grafit", "mgla", "kobalt"], price=749,
         fit=fit(2, 2, 3, 3, 2), badges=["nowosc"],
         short="Aluminiowa 75% z pokrętłem głośności. Zostaje rząd F, znika blok nawigacji: klawiatura jest o 3,3 cm węższa od TKL.",
         in_box=["kabel USB-C – USB-A 1,8 m", "odbiornik 2,4 GHz", "ściągacz do keycapów i przełączników", "klucz imbusowy"]),
    dict(id="k-kreda-98", slug="kreda-98", name="Kreda 98", line="Kreda", code="KRD98",
         size="98", size_label="1800 (98 klawiszy)", keys=98, connectivity=["usb-c", "2.4ghz", "bt"], case="tworzywo", mount="gasket", hotswap=True,
         keycaps="PBT dye-sub", backlight="białe", battery="3000 mAh", knob=False,
         weight_g=1150, dims=dict(w=385, d=138, h=40), colors=["mgla", "grafit"], price=549,
         fit=fit(0, 1, 2, 3, 3), badges=[],
         short="Układ 1800: blok numeryczny w 38,5 cm szerokości. Dla tych, którzy wpisują liczby, a nie chcą pełnowymiarowej klawiatury.",
         in_box=["kabel USB-C – USB-A 1,8 m", "odbiornik 2,4 GHz", "ściągacz do keycapów i przełączników"]),
    dict(id="k-granit-tkl", slug="granit-tkl", name="Granit TKL", line="Granit", code="GRNTKL",
         size="tkl", size_label="TKL (87 klawiszy)", keys=87, connectivity=["usb-c", "2.4ghz"], case="aluminium", mount="top mount", hotswap=True,
         keycaps="PBT double-shot", backlight="brak", battery="3000 mAh", knob=False,
         weight_g=2100, dims=dict(w=360, d=140, h=38), colors=["grafit", "mgla"], price=699,
         promo=dict(price=599, lowest_30d=699),
         fit=fit(2, 3, 3, 2, 2), badges=[],
         short="TKL w aluminium z mocowaniem top mount. Pełny blok nawigacji, bez bloku numerycznego.",
         in_box=["kabel USB-C – USB-A 1,8 m", "odbiornik 2,4 GHz", "ściągacz do keycapów i przełączników"]),
    dict(id="k-marmur-100", slug="marmur-100", name="Marmur 100", line="Marmur", code="MRM100",
         size="100", size_label="100% (104 klawisze)", keys=104, connectivity=["usb-c"], case="tworzywo", mount="tray", hotswap=False,
         keycaps="ABS double-shot", backlight="białe", battery=None, knob=False,
         weight_g=1050, dims=dict(w=440, d=135, h=38), colors=["grafit", "mgla"], price=349,
         fit=fit(0, 1, 1, 3, 1), badges=[],
         short="Pełnowymiarowa na przewodzie, bez hot-swap. Najprostsza droga do mechanicznej klawiatury z blokiem numerycznym.",
         in_box=["kabel USB-C – USB-A 1,8 m", "ściągacz do keycapów"]),
]

MICE = [
    dict(id="m-jerzyk", slug="jerzyk", name="Jerzyk", code="JRZ", shape="symetryczna", hand="prawa",
         hand_note="przyciski boczne po lewej stronie", size="M", weight_g=49, dims=dict(w=63, d=120, h=38),
         connectivity=["2.4ghz", "usb-c"], dpi_max=26000, polling_hz=4000, battery="do 70 h przy 1000 Hz",
         hand_cm=[18.0, 20.5], grips=["palm", "claw"], colors=["grafit", "mgla"], price=449,
         fit=fit(3, 3, 1, 0, 0), badges=[],
         short="49 g i 4000 Hz z dołączonym odbiornikiem. Do gier, w których mysz prowadzi się ramieniem.",
         in_box=["odbiornik 2,4 GHz z przedłużaczem", "kabel USB-C – USB-A 1,8 m", "zapasowe ślizgacze PTFE"]),
    dict(id="m-mewa", slug="mewa", name="Mewa", code="MEW", shape="symetryczna", hand="obureczna",
         hand_note="przyciski boczne po obu stronach", size="S", weight_g=55, dims=dict(w=60, d=116, h=37),
         connectivity=["2.4ghz", "usb-c"], dpi_max=26000, polling_hz=1000, battery="do 90 h",
         hand_cm=[16.0, 18.5], grips=["claw", "fingertip"], colors=["grafit", "mgla", "kobalt"], price=279,
         fit=fit(3, 2, 1, 1, 1), badges=[],
         short="Mała i lekka, przyciski boczne po obu stronach. Dla dłoni do 18,5 cm i chwytu claw lub fingertip.",
         in_box=["odbiornik 2,4 GHz", "kabel USB-C – USB-A 1,8 m"]),
    dict(id="m-pustulka", slug="pustulka", name="Pustułka", code="PST", shape="ergonomiczna", hand="prawa",
         hand_note="profil pod prawą dłoń", size="L", weight_g=62, dims=dict(w=66, d=126, h=43),
         connectivity=["2.4ghz", "bt", "usb-c"], dpi_max=26000, polling_hz=1000, battery="do 100 h",
         hand_cm=[19.0, 21.5], grips=["palm"], colors=["grafit", "mgla"], price=399,
         fit=fit(2, 3, 2, 2, 1), badges=["bestseller"],
         short="Profilowana pod prawą dłoń, 62 g. Do długich sesji z chwytem palm.",
         in_box=["odbiornik 2,4 GHz", "kabel USB-C – USB-A 1,8 m"]),
    dict(id="m-wrobel", slug="wrobel", name="Wróbel", code="WRB", shape="symetryczna", hand="obureczna",
         hand_note="przyciski boczne po lewej stronie", size="M", weight_g=68, dims=dict(w=64, d=121, h=39),
         connectivity=["przewod"], dpi_max=12000, polling_hz=1000, battery=None,
         hand_cm=[17.5, 19.5], grips=["palm", "claw"], colors=["grafit", "mgla"], price=149,
         promo=dict(price=129, lowest_30d=139),
         fit=fit(1, 2, 2, 2, 1), badges=[],
         short="Przewodowa, bez baterii do ładowania. Uniwersalny kształt w średnim rozmiarze.",
         in_box=[]),
    dict(id="m-kos", slug="kos", name="Kos", code="KOS", shape="ergonomiczna", hand="prawa",
         hand_note="ciche przyciski, kółko z trybem swobodnego obrotu", size="L", weight_g=98, dims=dict(w=80, d=128, h=48),
         connectivity=["2.4ghz", "bt"], dpi_max=8000, polling_hz=1000, battery="do 70 dni",
         hand_cm=[18.5, 21.5], grips=["palm"], colors=["grafit", "mgla"], price=329,
         fit=fit(0, 0, 3, 3, 3), badges=[],
         short="Ciche przyciski i kółko z trybem swobodnego obrotu. Przełącza się między trzema komputerami.",
         in_box=["odbiornik 2,4 GHz", "kabel USB-C – USB-C 1 m"]),
    dict(id="m-czapla", slug="czapla", name="Czapla", code="CZP", shape="pionowa", hand="prawa",
         hand_note="chwyt pionowy", size="M", weight_g=120, dims=dict(w=75, d=108, h=76),
         connectivity=["2.4ghz", "bt"], dpi_max=4000, polling_hz=1000, battery="do 30 dni",
         hand_cm=[17.0, 20.0], grips=["palm"], colors=["grafit"], price=249,
         fit=fit(0, 0, 2, 3, 2), badges=[],
         short="Pionowy chwyt jak przy podaniu ręki. Nadgarstek nie skręca się w stronę blatu.",
         in_box=["odbiornik 2,4 GHz", "kabel USB-C – USB-A 1 m"]),
]

PAD_SIZES = {
    "m":   {"label": "M",   "w": 360,  "d": 300, "type": "mysz"},
    "l":   {"label": "L",   "w": 450,  "d": 400, "type": "mysz"},
    "xl":  {"label": "XL",  "w": 900,  "d": 400, "type": "biurko"},
    "xxl": {"label": "XXL", "w": 1200, "d": 500, "type": "biurko"},
}

PADS = [
    dict(id="p-tafla", slug="tafla", name="Tafla", code="TFL", surface="szybka", material="tkanina gładka", thickness_mm=4,
         edge="obszyta", sizes={"m": 69, "l": 99, "xl": 149, "xxl": 219}, colors=["grafit", "mgla", "kobalt"],
         fit=fit(2, 3, 2, 1, 1), badges=["bestseller"],
         short="Gładka tkanina: mysz rusza z miejsca bez oporu. Do gier z szybkim śledzeniem celu."),
    dict(id="p-len", slug="len", name="Len", code="LEN", surface="kontrolna", material="tkanina o grubym splocie", thickness_mm=5,
         edge="obszyta", sizes={"m": 59, "l": 89, "xl": 139}, colors=["grafit", "mgla"],
         fit=fit(3, 2, 1, 1, 1), badges=[],
         short="Gruby splot hamuje mysz tam, gdzie ją zatrzymasz. Do precyzyjnego celowania."),
    dict(id="p-szron", slug="szron", name="Szron", code="SZR", surface="zbalansowana", material="hybryda (tkanina powlekana)", thickness_mm=4,
         edge="obszyta", sizes={"l": 129, "xl": 189}, colors=["grafit", "kobalt"],
         fit=fit(2, 2, 2, 2, 1), badges=[],
         short="Powłoka hybrydowa: szybki start, kontrolowane zatrzymanie. Nie chłonie wilgoci."),
    dict(id="p-lod", slug="lod", name="Lód", code="LOD", surface="bardzo szybka", material="szkło hartowane", thickness_mm=4,
         edge="szlifowana", sizes={"m": 249, "l": 329}, colors=["grafit", "mgla"],
         fit=fit(2, 2, 0, 0, 0), badges=["nowosc"],
         short="Hartowane szkło: najmniejszy opór i powierzchnia, która się nie wyciera. Głośniejsza od tkaniny."),
    dict(id="p-filc", slug="filc", name="Filc", code="FLC", surface="biurowa", material="filc poliestrowy", thickness_mm=3,
         edge="cięta", sizes={"xl": 129, "xxl": 179}, colors=["grafit", "mgla"],
         fit=fit(0, 0, 2, 3, 3), badges=[],
         short="Mata na całe biurko: wycisza stuk klawiatury i chroni blat. Nie do gier."),
    dict(id="p-korek", slug="korek", name="Korek", code="KRK", surface="biurowa", material="korek naturalny z gumowym spodem", thickness_mm=3,
         edge="cięta", sizes={"xl": 119}, colors=["naturalny"],
         fit=fit(0, 0, 2, 3, 2), badges=[],
         short="Korek z antypoślizgowym spodem. Ciepły w dotyku, matowy, bez nadruku."),
]

def stock_for(sku):
    h = int(hashlib.sha1(sku.encode()).hexdigest()[:6], 16)
    return 4 + h % 37  # 4..40

STOCK_OVERRIDES = {
    "K-BZL75-KOB-SZP": 0,
    "M-JRZ-MGL": 2,
    "P-LOD-L-MGL": 0,
    "K-KRD98-GRF-TRZ": 3,
}

GALLERY_SHOTS = [
    {"shot": "01-34", "label": "ujęcie 3/4 z przodu", "p0": True},
    {"shot": "02-gora", "label": "widok z góry", "p0": False},
    {"shot": "03-bok", "label": "profil z boku", "p0": False},
    {"shot": "04-detal", "label": "detal (przełącznik / spód / splot)", "p0": False},
]

manifest = []

def packshots(pid, color):
    keys = []
    for g in GALLERY_SHOTS:
        base = f"{pid}_{color}_{g['shot']}"
        keys.append(base)
        manifest.append({"key": base, "product_id": pid, "color": color, "kind": "packshot", "shot": g["shot"],
                         "description": g["label"], "ratio": "1:1",
                         "files": [f"img/produkty/{base}-{w}.webp" for w in (400, 800, 1600)],
                         "priority": "P0" if g["p0"] else "P1", "status": "brak"})
    return keys

def topdown(pid, color, w, d, size=None):
    base = f"{pid}_{color}" + (f"_{size}" if size else "") + "_top"
    manifest.append({"key": base, "product_id": pid, "color": color, "size": size, "kind": "topdown",
                     "description": "wycinek z góry, przezroczyste tło, bez cienia", "dims_mm": {"w": w, "d": d},
                     "scale": "1x: 1 px = 1 mm; 2x: 2 px = 1 mm",
                     "files": [f"img/top/{base}@1x.webp", f"img/top/{base}@2x.webp"],
                     "pixels": {"1x": [w, d], "2x": [w * 2, d * 2]}, "priority": "P0", "status": "brak"})
    return base

def texture(pid, color):
    base = f"{pid}_{color}_tekstura"
    manifest.append({"key": base, "product_id": pid, "color": color, "kind": "texture",
                     "description": "bezszwowy kafel powierzchni widzianej z góry, równe światło, bez krawędzi i cieni",
                     "tile_mm": 200, "scale": "1x: 1 px = 1 mm; 2x: 2 px = 1 mm",
                     "files": [f"img/tekstury/{base}@1x.webp", f"img/tekstury/{base}@2x.webp"],
                     "pixels": {"1x": [200, 200], "2x": [400, 400]}, "priority": "P0", "status": "brak"})
    return base

def price_block(base_price, promo):
    if promo:
        return {"price": money(promo["price"]), "regular_price": money(base_price), "lowest_30d": money(promo["lowest_30d"])}
    return {"price": money(base_price), "regular_price": None, "lowest_30d": None}

products = []

for k in KEYBOARDS:
    variants = []
    images = {}
    for c in k["colors"]:
        images[c] = {"packshots": packshots(k["id"], c), "topdown": topdown(k["id"], c, k["dims"]["w"], k["dims"]["d"])}
        for s in SWITCHES:
            sku = f"K-{k['code']}-{COLORS[c]['code']}-{s['code']}"
            v = {"sku": sku, "color": c, "switch": s["id"], **price_block(k["price"], k.get("promo"))}
            v["stock"] = STOCK_OVERRIDES.get(sku, stock_for(sku))
            v["images"] = c
            variants.append(v)
    products.append({
        "id": k["id"], "slug": k["slug"], "category": "klawiatury", "name": k["name"], "brand": "Taktyl",
        "short": k["short"], "description": None,
        "attributes": {
            "size": k["size"], "size_label": k["size_label"], "keys": k["keys"], "layout": "ANSI (polski programisty)",
            "connectivity": k["connectivity"], "case": k["case"], "mount": k["mount"], "hotswap": k["hotswap"],
            "keycaps": k["keycaps"], "backlight": k["backlight"], "battery": k["battery"], "knob": k["knob"],
            "weight_g": k["weight_g"], "dims_mm": k["dims"],
        },
        "options": ["color", "switch"], "default_variant": variants[0]["sku"],
        "variants": variants, "images": images, "badges": k["badges"], "fit": k["fit"],
        "in_box": k["in_box"], "gpsr": {**GPSR, "warnings": "Nie zawiera elementów przeznaczonych dla dzieci poniżej 3 lat. Ściągacz do przełączników ma ostre końcówki."},
    })

for m in MICE:
    variants, images = [], {}
    for c in m["colors"]:
        images[c] = {"packshots": packshots(m["id"], c), "topdown": topdown(m["id"], c, m["dims"]["w"], m["dims"]["d"])}
        sku = f"M-{m['code']}-{COLORS[c]['code']}"
        v = {"sku": sku, "color": c, **price_block(m["price"], m.get("promo"))}
        v["stock"] = STOCK_OVERRIDES.get(sku, stock_for(sku))
        v["images"] = c
        variants.append(v)
    products.append({
        "id": m["id"], "slug": m["slug"], "category": "myszki", "name": m["name"], "brand": "Taktyl",
        "short": m["short"], "description": None,
        "attributes": {
            "shape": m["shape"], "hand": m["hand"], "hand_note": m["hand_note"], "size": m["size"], "weight_g": m["weight_g"],
            "dims_mm": m["dims"], "connectivity": m["connectivity"], "dpi_max": m["dpi_max"], "polling_hz": m["polling_hz"],
            "battery": m["battery"], "hand_cm": m["hand_cm"], "grips": m["grips"], "sensor": "optyczny",
        },
        "options": ["color"], "default_variant": variants[0]["sku"],
        "variants": variants, "images": images, "badges": m["badges"], "fit": m["fit"],
        "in_box": m["in_box"], "gpsr": {**GPSR, "warnings": "Zawiera akumulator litowo-jonowy: nie przebijać, nie podgrzewać." if m["battery"] else "Brak szczególnych ostrzeżeń."},
    })

for p in PADS:
    variants, images = [], {}
    for c in p["colors"]:
        images[c] = {"packshots": packshots(p["id"], c), "texture": texture(p["id"], c)}
        for sz, pr in p["sizes"].items():
            S = PAD_SIZES[sz]
            sku = f"P-{p['code']}-{S['label']}-{COLORS[c]['code']}"
            v = {"sku": sku, "color": c, "size": sz, **price_block(pr, None)}
            v["stock"] = STOCK_OVERRIDES.get(sku, stock_for(sku))
            v["images"] = c
            variants.append(v)
    products.append({
        "id": p["id"], "slug": p["slug"], "category": "podkladki", "name": p["name"], "brand": "Taktyl",
        "short": p["short"], "description": None,
        "attributes": {"surface": p["surface"], "material": p["material"], "thickness_mm": p["thickness_mm"], "edge": p["edge"],
                       "sizes": {sz: PAD_SIZES[sz] for sz in p["sizes"]}},
        "options": ["size", "color"], "default_variant": next(v["sku"] for v in variants if v["size"] == ("xl" if "xl" in p["sizes"] else list(p["sizes"])[-1])),
        "variants": variants, "images": images, "badges": p["badges"], "fit": p["fit"],
        "in_box": [], "gpsr": {**GPSR, "warnings": "Szkło hartowane: nie upuszczać na krawędź." if p["id"] == "p-lod" else "Brak szczególnych ostrzeżeń."},
    })

categories = [
    {"id": "klawiatury", "slug": "klawiatury", "name": "Klawiatury", "h1": "Klawiatury mechaniczne", "order": 1,
     "intro": "60% do pełnowymiarowych. Wszystkie w układzie polskim programisty, większość z wymianą przełączników bez lutowania."},
    {"id": "myszki", "slug": "myszki", "name": "Myszki", "h1": "Myszki", "order": 2,
     "intro": "Od 49 do 120 g. Każda ma podany zakres długości dłoni, dla której jest projektowana."},
    {"id": "podkladki", "slug": "podkladki", "name": "Podkładki", "h1": "Podkładki i maty na biurko", "order": 3,
     "intro": "Pod samą myszkę (M, L) albo na całe biurko (XL, XXL). Kreator setu sprawdzi, czy zmieszczą klawiaturę i ruch myszki."},
]

facets = {
    "klawiatury": [
        {"id": "rozmiar", "label": "Rozmiar", "type": "multi", "attr": "size",
         "values": [{"v": "60", "label": "60%"}, {"v": "65", "label": "65%"}, {"v": "75", "label": "75%"},
                    {"v": "98", "label": "1800 (98)"}, {"v": "tkl", "label": "TKL"}, {"v": "100", "label": "100%"}]},
        {"id": "przelacznik", "label": "Typ przełącznika", "type": "multi", "attr": "variant.switch.type",
         "values": [{"v": "liniowy", "label": "Liniowy"}, {"v": "taktylny", "label": "Taktylny"},
                    {"v": "klikajacy", "label": "Klikający"}, {"v": "cichy", "label": "Cichy liniowy"}]},
        {"id": "lacznosc", "label": "Łączność", "type": "multi", "attr": "connectivity",
         "values": [{"v": "usb-c", "label": "Przewód USB-C"}, {"v": "2.4ghz", "label": "2,4 GHz"}, {"v": "bt", "label": "Bluetooth"}]},
        {"id": "hotswap", "label": "Wymiana przełączników bez lutowania", "type": "bool", "attr": "hotswap"},
        {"id": "obudowa", "label": "Obudowa", "type": "multi", "attr": "case",
         "values": [{"v": "aluminium", "label": "Aluminium"}, {"v": "tworzywo", "label": "Tworzywo"}]},
        {"id": "kolor", "label": "Kolor", "type": "multi", "attr": "variant.color"},
        {"id": "cena", "label": "Cena", "type": "range", "attr": "variant.price", "unit": "zł"},
        {"id": "dostepnosc", "label": "Tylko dostępne", "type": "bool", "attr": "variant.stock>0"},
    ],
    "myszki": [
        {"id": "waga", "label": "Waga", "type": "buckets", "attr": "weight_g",
         "values": [{"v": "do-60", "label": "do 60 g", "max": 60}, {"v": "60-80", "label": "60–80 g", "min": 61, "max": 80},
                    {"v": "od-80", "label": "ponad 80 g", "min": 81}]},
        {"id": "ksztalt", "label": "Kształt", "type": "multi", "attr": "shape",
         "values": [{"v": "symetryczna", "label": "Symetryczna"}, {"v": "ergonomiczna", "label": "Ergonomiczna"}, {"v": "pionowa", "label": "Pionowa"}]},
        {"id": "rozmiar", "label": "Rozmiar", "type": "multi", "attr": "size",
         "values": [{"v": "S", "label": "S"}, {"v": "M", "label": "M"}, {"v": "L", "label": "L"}]},
        {"id": "dlon", "label": "Długość dłoni (cm)", "type": "number-match", "attr": "hand_cm",
         "hint": "Od nadgarstka do czubka środkowego palca."},
        {"id": "reka", "label": "Ręka", "type": "multi", "attr": "hand",
         "values": [{"v": "prawa", "label": "Prawa"}, {"v": "obureczna", "label": "Oburęczna"}]},
        {"id": "lacznosc", "label": "Łączność", "type": "multi", "attr": "connectivity",
         "values": [{"v": "przewod", "label": "Przewodowa"}, {"v": "2.4ghz", "label": "2,4 GHz"}, {"v": "bt", "label": "Bluetooth"}]},
        {"id": "kolor", "label": "Kolor", "type": "multi", "attr": "variant.color"},
        {"id": "cena", "label": "Cena", "type": "range", "attr": "variant.price", "unit": "zł"},
        {"id": "dostepnosc", "label": "Tylko dostępne", "type": "bool", "attr": "variant.stock>0"},
    ],
    "podkladki": [
        {"id": "typ", "label": "Przeznaczenie", "type": "multi", "attr": "variant.size.type",
         "values": [{"v": "mysz", "label": "Pod myszkę (M, L)"}, {"v": "biurko", "label": "Na biurko (XL, XXL)"}]},
        {"id": "rozmiar", "label": "Rozmiar", "type": "multi", "attr": "variant.size",
         "values": [{"v": "m", "label": "M · 36 × 30 cm"}, {"v": "l", "label": "L · 45 × 40 cm"},
                    {"v": "xl", "label": "XL · 90 × 40 cm"}, {"v": "xxl", "label": "XXL · 120 × 50 cm"}]},
        {"id": "powierzchnia", "label": "Powierzchnia", "type": "multi", "attr": "surface",
         "values": [{"v": "bardzo szybka", "label": "Bardzo szybka"}, {"v": "szybka", "label": "Szybka"},
                    {"v": "zbalansowana", "label": "Zbalansowana"}, {"v": "kontrolna", "label": "Kontrolna"},
                    {"v": "biurowa", "label": "Biurowa (nie do gier)"}]},
        {"id": "kolor", "label": "Kolor", "type": "multi", "attr": "variant.color"},
        {"id": "cena", "label": "Cena", "type": "range", "attr": "variant.price", "unit": "zł"},
        {"id": "dostepnosc", "label": "Tylko dostępne", "type": "bool", "attr": "variant.stock>0"},
    ],
}

rules = {
    "units": "mm",
    "profiles": {
        "fps":           {"label": "Gry FPS, niski sens", "mouse_zone_mm": 400, "default_switch": "slizg"},
        "gry":           {"label": "Gry (inne)",          "mouse_zone_mm": 300, "default_switch": "slizg"},
        "programowanie": {"label": "Programowanie",       "mouse_zone_mm": 220, "default_switch": "prog"},
        "biuro":         {"label": "Praca biurowa",       "mouse_zone_mm": 220, "default_switch": "prog"},
        "cisza":         {"label": "Cicha praca (open space)", "mouse_zone_mm": 220, "default_switch": "szept"},
    },
    "no_profile": {"mouse_zone_mm": 260, "message": "Przyjęliśmy 26 cm na ruch myszki. Wybierz, do czego jest set, a sprawdzimy dokładniej."},
    "gap_keyboard_mouse_mm": 30,
    "edge_margin_mm": 20,
    "checks": [
        {"id": "pad-width-desk", "applies": "pad.size.type == 'biurko' && keyboard && mouse", "level_fail": "uwaga",
         "formula": "required = 2*edge_margin + keyboard.w + gap + mouse_zone; ok = pad.w >= required",
         "ok": "Mieści się: klawiatura {kb_cm} cm + {zone_cm} cm na myszkę. Zapas: {spare_cm} cm.",
         "fail": "Podkładka ma {pad_cm} cm, a ten set potrzebuje {req_cm} cm (klawiatura {kb_cm} cm + {zone_cm} cm na myszkę + odstępy). {suggestion}"},
        {"id": "pad-depth-desk", "applies": "pad.size.type == 'biurko' && keyboard", "level_fail": "uwaga",
         "formula": "ok = pad.d >= keyboard.d + 2*edge_margin",
         "ok": None,
         "fail": "Klawiatura ma {kb_d_cm} cm głębokości, mata {pad_d_cm} cm. Krawędź klawiatury wyjdzie poza matę."},
        {"id": "pad-width-mouse", "applies": "pad.size.type == 'mysz' && mouse", "level_fail": "uwaga",
         "formula": "ok = pad.w >= mouse_zone",
         "ok": "Na ruch myszki masz {pad_cm} cm, potrzebujesz około {zone_cm} cm.",
         "fail": "Przy profilu „{profile}” mysz potrzebuje około {zone_cm} cm, a podkładka ma {pad_cm} cm. {suggestion}"},
        {"id": "hand-size", "applies": "mouse && user.hand_cm", "level_fail": "uwaga",
         "formula": "ok = mouse.hand_cm[0] <= user.hand_cm <= mouse.hand_cm[1]",
         "ok": "Twoja dłoń ({hand} cm) mieści się w zakresie tej myszki ({min}–{max} cm).",
         "fail": "{mouse} jest projektowana na dłoń {min}–{max} cm, Twoja ma {hand} cm. {suggestion}"},
        {"id": "two-receivers", "applies": "keyboard.connectivity has '2.4ghz' && mouse.connectivity has '2.4ghz'", "level_fail": "info",
         "formula": "always info",
         "ok": None,
         "fail": "Klawiatura i myszka mają osobne odbiorniki 2,4 GHz: zajmą dwa porty USB."},
        {"id": "color-harmony", "applies": "keyboard && mouse && pad", "level_fail": None,
         "formula": "ok = wszystkie kolory mają ten sam harmony albo harmony == 'neutralny'",
         "ok": "Spójna kolorystyka: {color}.",
         "fail": None},
    ],
    "suggestion_order": {
        "pad": ["większy rozmiar tego samego modelu i koloru", "najtańsza dostępna podkładka spełniająca regułę z fit[profil] >= 2", "najtańsza dostępna podkładka spełniająca regułę"],
        "mouse": ["myszka o tym samym kształcie z zakresem dłoni obejmującym wartość", "dowolna myszka z zakresem obejmującym wartość", "myszka z najbliższym zakresem + komunikat, że żadna nie obejmuje"],
    },
    "never_block": True,
}

shop = {
    "currency": "PLN",
    "locale": "pl-PL",
    "timezone": "Europe/Warsaw",
    "free_shipping_threshold": 299.00,
    "set_discount": {"percent": 10, "requires_categories": ["klawiatury", "myszki", "podkladki"],
                     "base": "suma aktualnych cen wariantów (z promocjami)", "combines_with_codes": False,
                     "rounding": "kwota rabatu zaokrąglona do 0,01 zł (połówki w górę), rozbita proporcjonalnie na pozycje; reszta groszowa na ostatnią pozycję"},
    "shipping_methods": [
        {"id": "automat", "label": "Automat paczkowy", "price": 12.99, "eta_business_days": 1, "fields": ["email", "phone", "point"]},
        {"id": "kurier", "label": "Kurier", "price": 16.99, "eta_business_days": 1, "fields": ["email", "phone", "name", "street", "postcode", "city"]},
        {"id": "odbior", "label": "Odbiór osobisty (Warszawa)", "price": 0.00, "eta_business_days": 0, "fields": ["email", "phone", "name"],
         "address": "ul. Klawiszowa 87, 00-000 Warszawa (adres fikcyjny)"},
    ],
    "dispatch": {"cutoff_hour": 14, "rule": "zamówienie do 14:00 w dzień roboczy wychodzi tego samego dnia; dostawa = wysyłka + eta_business_days dni roboczych"},
    "payment_methods": [
        {"id": "blik", "label": "BLIK"}, {"id": "karta", "label": "Karta płatnicza"},
        {"id": "przelew-online", "label": "Szybki przelew"}, {"id": "przelew", "label": "Przelew tradycyjny"},
    ],
    "payment_simulation": True,
    "codes": [
        {"code": "TAKTYL10", "type": "percent", "value": 10, "scope": "pozycje spoza setów", "label": "−10% na produkty spoza setów"},
        {"code": "DOSTAWA0", "type": "free_shipping", "scope": "dostawa", "label": "Darmowa dostawa"},
    ],
    "pickup_points": [
        {"id": "WAW-001", "city": "Warszawa", "label": "WAW-001 · przy stacji metra (lokalizacja fikcyjna)"},
        {"id": "WAW-002", "city": "Warszawa", "label": "WAW-002 · centrum handlowe (lokalizacja fikcyjna)"},
        {"id": "KRK-001", "city": "Kraków",   "label": "KRK-001 · dworzec (lokalizacja fikcyjna)"},
        {"id": "WRO-001", "city": "Wrocław",  "label": "WRO-001 · osiedle (lokalizacja fikcyjna)"},
        {"id": "GDA-001", "city": "Gdańsk",   "label": "GDA-001 · stacja paliw (lokalizacja fikcyjna)"},
        {"id": "POZ-001", "city": "Poznań",   "label": "POZ-001 · supermarket (lokalizacja fikcyjna)"},
    ],
    "returns_days": 30,
    "statutory_withdrawal_days": 14,
    "demo": {"label": "Taktyl to sklep demonstracyjny. Nie realizujemy zamówień i nie pobieramy płatności.",
             "email_domain": "taktyl.example", "phone": "+48 22 000 00 00"},
}

# Presety
def find_variant(pid, **kw):
    p = next(x for x in products if x["id"] == pid)
    for v in p["variants"]:
        if all(v.get(k) == val for k, val in kw.items()):
            return p, v
    raise KeyError((pid, kw))

PRESETS = [
    dict(id="programista", name="Programista", profile="programowanie",
         k=("k-bazalt-75", dict(color="grafit", switch="prog")), m=("m-pustulka", dict(color="grafit")), p=("p-szron", dict(color="grafit", size="xl")),
         note="75% z taktylnym przełącznikiem, ergonomiczna mysz i zbalansowana mata na biurko."),
    dict(id="fps", name="FPS na niskim sensie", profile="fps",
         k=("k-kwarc-60", dict(color="grafit", switch="slizg")), m=("m-jerzyk", dict(color="grafit")), p=("p-len", dict(color="grafit", size="xl")),
         note="Najwęższa klawiatura, 49 g myszki i kontrolna mata: 40 cm na ruch ramieniem."),
    dict(id="open-space", name="Cichy open space", profile="cisza",
         k=("k-kreda-98", dict(color="mgla", switch="szept")), m=("m-kos", dict(color="mgla")), p=("p-filc", dict(color="mgla", size="xl")),
         note="Ciche przełączniki, ciche przyciski myszy i filc, który tłumi stuk."),
    dict(id="kobalt", name="Kobalt", profile="gry",
         k=("k-lupek-65", dict(color="kobalt", switch="slizg")), m=("m-mewa", dict(color="kobalt")), p=("p-tafla", dict(color="kobalt", size="xl")),
         note="Jeden kolor od klawiatury po podkładkę. 65% ze strzałkami, lekka mysz, szybka tkanina."),
]

presets = []
report = []
for pr in PRESETS:
    items = []
    total = Decimal("0")
    parts = {}
    for role in ("k", "m", "p"):
        pid, kw = pr[role]
        prod, v = find_variant(pid, **kw)
        items.append(v["sku"])
        total += Decimal(str(v["price"]))
        parts[role] = (prod, v)
    disc = (total * Decimal("0.10")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    presets.append({"id": pr["id"], "name": pr["name"], "profile": pr["profile"], "skus": items, "note": pr["note"],
                    "sum": float(total), "set_discount": float(disc), "total": float(total - disc)})
    kb = parts["k"][0]["attributes"]["dims_mm"]["w"]
    zone = rules["profiles"][pr["profile"]]["mouse_zone_mm"]
    padw = PAD_SIZES[parts["p"][1]["size"]]["w"]
    req = 2 * rules["edge_margin_mm"] + kb + rules["gap_keyboard_mouse_mm"] + zone
    report.append(f"preset {pr['id']}: suma {total} rabat {disc} razem {total - disc}; wymagane {req} mm, mata {padw} mm -> {'OK' if padw >= req else 'UWAGA'}")

dump("data/categories.json", categories)
dump("data/products.json", products)
dump("data/switches.json", SWITCHES)
dump("data/colors.json", COLORS)
dump("data/facets.json", facets)
dump("data/rules.json", rules)
dump("data/shop.json", shop)
dump("data/presets.json", presets)
dump("assets/manifest.json", manifest)

# Raport kontrolny
n_sku = sum(len(p["variants"]) for p in products)
print("produkty:", len(products), "SKU:", n_sku)
for cat in ("klawiatury", "myszki", "podkladki"):
    ps = [p for p in products if p["category"] == cat]
    print(f"  {cat}: {len(ps)} modeli, {sum(len(p['variants']) for p in ps)} SKU, ceny {min(v['price'] for p in ps for v in p['variants'])}–{max(v['price'] for p in ps for v in p['variants'])} zł")
p0 = [m for m in manifest if m["priority"] == "P0"]
print("obrazy w manifeście:", len(manifest), "| P0:", len(p0), "(packshot:", sum(1 for m in p0 if m['kind']=='packshot'), ", topdown:", sum(1 for m in p0 if m['kind']=='topdown'), ", tekstury:", sum(1 for m in p0 if m['kind']=='texture'), ") | plików P0:", sum(len(m['files']) for m in p0))
for r in report:
    print(r)
# Sprawdzenia reguł na skrajnych przypadkach
for kid in ("k-marmur-100", "k-kwarc-60", "k-bazalt-75", "k-granit-tkl", "k-kreda-98", "k-lupek-65"):
    kb = next(p for p in products if p["id"] == kid)["attributes"]["dims_mm"]["w"]
    row = []
    for prof, cfg in rules["profiles"].items():
        req = 40 + kb + 30 + cfg["mouse_zone_mm"]
        row.append(f"{prof}:{req}{'(>XL)' if req > 900 else ''}")
    print(kid, kb, " ".join(row))
zero = [v["sku"] for p in products for v in p["variants"] if v["stock"] == 0]
low = [v["sku"] for p in products for v in p["variants"] if 0 < v["stock"] <= 3]
print("brak:", zero, "| ostatnie sztuki:", low)
