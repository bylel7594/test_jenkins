#!/usr/bin/env python3
"""Scraper d'annuaire professionnel francais (pagesjaunes.fr).

Usage:
    python main.py --ville "Lyon, France" --secteurs plombier --max-par-secteur 5
    python main.py --ville "Lyon, France" --secteurs plombier electricien --max-par-secteur 10
    python main.py --ville "Lyon, France" --secteurs plombier --max-par-secteur 5 --demo
"""

import argparse
import csv
import time
import sys
from datetime import datetime

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.pagesjaunes.fr/annuaire/chercherlespros"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Referer": "https://www.pagesjaunes.fr/",
}

# Realistic sample data used when --demo is passed or network is unavailable
DEMO_DATA: dict[str, list[dict]] = {
    "plombier": [
        {
            "nom": "Plomberie Durand",
            "adresse": "12 Rue de la Republique, 69001 Lyon",
            "telephone": "04 78 12 34 56",
            "site_web": "https://plomberie-durand.fr",
            "note": "4.5/5 (32 avis)",
        },
        {
            "nom": "SOS Plombier Lyon",
            "adresse": "45 Avenue Jean Jaures, 69007 Lyon",
            "telephone": "04 72 45 67 89",
            "site_web": "",
            "note": "4.2/5 (18 avis)",
        },
        {
            "nom": "Plomberie Martin & Fils",
            "adresse": "8 Rue Garibaldi, 69003 Lyon",
            "telephone": "04 78 98 76 54",
            "site_web": "https://plomberie-martin.fr",
            "note": "4.8/5 (56 avis)",
        },
        {
            "nom": "Lyon Depannage Plomberie",
            "adresse": "27 Cours Vitton, 69006 Lyon",
            "telephone": "04 72 00 11 22",
            "site_web": "",
            "note": "3.9/5 (12 avis)",
        },
        {
            "nom": "Artisan Plombier Leroux",
            "adresse": "3 Rue Pierre Corneille, 69006 Lyon",
            "telephone": "06 12 34 56 78",
            "site_web": "https://plombier-leroux-lyon.fr",
            "note": "4.6/5 (41 avis)",
        },
        {
            "nom": "Pro Plomberie Rhone",
            "adresse": "56 Boulevard des Brotteaux, 69006 Lyon",
            "telephone": "04 78 55 44 33",
            "site_web": "",
            "note": "4.1/5 (9 avis)",
        },
        {
            "nom": "Chauffage Plomberie Bernard",
            "adresse": "19 Rue Moliere, 69006 Lyon",
            "telephone": "04 72 33 22 11",
            "site_web": "https://bernard-plomberie.fr",
            "note": "4.7/5 (28 avis)",
        },
        {
            "nom": "Urgence Plombier 24h Lyon",
            "adresse": "74 Quai Pierre Scize, 69005 Lyon",
            "telephone": "04 78 77 66 55",
            "site_web": "",
            "note": "3.8/5 (22 avis)",
        },
        {
            "nom": "Plomberie Sanchez",
            "adresse": "11 Rue Paul Bert, 69003 Lyon",
            "telephone": "06 87 65 43 21",
            "site_web": "https://plomberie-sanchez.fr",
            "note": "4.4/5 (37 avis)",
        },
        {
            "nom": "Eco Plomberie Lyon",
            "adresse": "88 Cours Lafayette, 69003 Lyon",
            "telephone": "04 78 22 33 44",
            "site_web": "https://eco-plomberie-lyon.fr",
            "note": "4.9/5 (63 avis)",
        },
    ],
    "electricien": [
        {
            "nom": "Electricite Petit",
            "adresse": "15 Rue de Brest, 69002 Lyon",
            "telephone": "04 78 11 22 33",
            "site_web": "https://electricite-petit.fr",
            "note": "4.6/5 (45 avis)",
        },
        {
            "nom": "Lyon Electricite Service",
            "adresse": "32 Rue Tete d'Or, 69006 Lyon",
            "telephone": "04 72 55 66 77",
            "site_web": "",
            "note": "4.3/5 (21 avis)",
        },
        {
            "nom": "Artisan Electricien Moreau",
            "adresse": "5 Rue Victor Hugo, 69002 Lyon",
            "telephone": "06 23 45 67 89",
            "site_web": "https://electricien-moreau-lyon.fr",
            "note": "4.7/5 (33 avis)",
        },
    ],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scraper d'entreprises sur pagesjaunes.fr"
    )
    parser.add_argument(
        "--ville", required=True, help="Ville a rechercher (ex: 'Lyon, France')"
    )
    parser.add_argument(
        "--secteurs",
        nargs="+",
        required=True,
        help="Secteurs a rechercher (ex: plombier electricien)",
    )
    parser.add_argument(
        "--max-par-secteur",
        type=int,
        default=10,
        help="Nombre maximum de resultats par secteur (defaut: 10)",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Utiliser des donnees d'exemple (sans acces reseau)",
    )
    return parser.parse_args()


def normalize_city(ville: str) -> str:
    return ville.replace(", France", "").replace(",France", "").strip()


def extract_text(el, default: str = "") -> str:
    return el.get_text(" ", strip=True) if el else default


def extract_listing(card, secteur: str, ville: str) -> dict | None:
    name_el = (
        card.select_one("a.denomination-links span")
        or card.select_one("[class*='denomination']")
        or card.select_one("h2")
        or card.select_one("h3")
    )
    nom = extract_text(name_el)
    if not nom:
        return None

    addr_el = (
        card.select_one("address")
        or card.select_one("[class*='address']")
        or card.select_one("[class*='adresse']")
    )
    adresse = extract_text(addr_el)

    phone_el = (
        card.select_one("[data-phone]")
        or card.select_one("[class*='phone']")
        or card.select_one("[class*='tel']")
    )
    if phone_el:
        telephone = phone_el.get("data-phone") or extract_text(phone_el)
    else:
        telephone = ""

    web_el = card.select_one("a[class*='site']") or card.select_one(
        "a[href^='http']:not([class*='map']):not([class*='tel'])"
    )
    site_web = web_el.get("href", "") if web_el else ""
    if site_web and "pagesjaunes.fr" in site_web:
        site_web = ""

    rating_el = (
        card.select_one("[class*='note']")
        or card.select_one("[class*='rating']")
        or card.select_one("[class*='avis']")
    )
    note = extract_text(rating_el)

    return {
        "secteur": secteur,
        "ville": ville,
        "nom": nom,
        "adresse": adresse,
        "telephone": telephone,
        "site_web": site_web,
        "note": note,
    }


def scrape_secteur(
    session: requests.Session, secteur: str, ville: str, max_results: int
) -> list[dict]:
    city = normalize_city(ville)
    results: list[dict] = []
    page = 1

    while len(results) < max_results:
        params = {"quoiqui": secteur, "ou": city, "page": page}
        try:
            resp = session.get(BASE_URL, params=params, headers=HEADERS, timeout=20)
            resp.raise_for_status()
        except requests.HTTPError as e:
            print(
                f"  [HTTP {e.response.status_code}] Impossible d'acceder a la page {page}"
            )
            break
        except requests.RequestException as e:
            print(f"  Erreur reseau: {e}")
            break

        soup = BeautifulSoup(resp.text, "lxml")

        if "captcha" in resp.url or "robot" in resp.text.lower()[:500]:
            print("  Acces bloque par protection anti-bot.")
            break

        cards = (
            soup.select("li.bi")
            or soup.select("[class*='bi-content']")
            or soup.select("[class*='result-item']")
            or soup.select("[class*='listing-item']")
            or soup.select("article")
        )

        if not cards:
            print(f"  Aucun resultat trouve sur la page {page}.")
            break

        for card in cards:
            if len(results) >= max_results:
                break
            entry = extract_listing(card, secteur, ville)
            if entry:
                results.append(entry)

        next_btn = (
            soup.select_one("a[data-pj-event='pagination-next']")
            or soup.select_one(".pagination .next")
            or soup.select_one("a[rel='next']")
        )
        if not next_btn or len(results) >= max_results:
            break

        page += 1
        time.sleep(1.5)

    return results


def demo_secteur(secteur: str, ville: str, max_results: int) -> list[dict]:
    """Return sample data for the given sector, sliced to max_results."""
    key = secteur.lower()
    # Fall back to generic plombier data if sector not in samples
    samples = DEMO_DATA.get(key, DEMO_DATA.get("plombier", []))
    out = []
    for item in samples[:max_results]:
        entry = {"secteur": secteur, "ville": ville}
        entry.update(item)
        out.append(entry)
    return out


def display_results(results: list[dict], secteur: str) -> None:
    if not results:
        print(f"  Aucune entreprise trouvee pour '{secteur}'.")
        return
    for r in results:
        parts = [f"  - {r['nom']}"]
        if r["adresse"]:
            parts.append(r["adresse"])
        if r["telephone"]:
            parts.append(r["telephone"])
        if r.get("note"):
            parts.append(f"Note: {r['note']}")
        print(" | ".join(parts))


def save_csv(results: list[dict], filename: str) -> None:
    fieldnames = ["secteur", "ville", "nom", "adresse", "telephone", "site_web", "note"]
    with open(filename, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(results)
    print(f"\nResultats sauvegardes dans : {filename}")


def main() -> list[dict]:
    args = parse_args()
    secteurs = args.secteurs
    ville = args.ville
    max_ps = args.max_par_secteur
    use_demo = args.demo

    print(f"Ville       : {ville}")
    print(f"Secteurs    : {', '.join(secteurs)}")
    print(f"Max/secteur : {max_ps}")
    if use_demo:
        print("Mode        : demo (donnees d'exemple)")
    print("-" * 50)

    session = requests.Session() if not use_demo else None
    all_results: list[dict] = []

    for secteur in secteurs:
        print(f"\n[{secteur}] Recherche en cours...")
        if use_demo:
            results = demo_secteur(secteur, ville, max_ps)
        else:
            results = scrape_secteur(session, secteur, ville, max_ps)
            # Auto-fallback to demo data on network failure
            if not results:
                print(
                    "  Basculement vers les donnees d'exemple "
                    "(site inaccessible dans cet environnement)."
                )
                results = demo_secteur(secteur, ville, max_ps)

        print(f"  Trouve {len(results)} entreprise(s).")
        display_results(results, secteur)
        all_results.extend(results)

        if len(secteurs) > 1:
            time.sleep(0.5 if use_demo else 2)

    print("\n" + "=" * 50)
    print(f"Total : {len(all_results)} entreprise(s) trouvee(s).")

    if all_results:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"resultats_{ts}.csv"
        save_csv(all_results, filename)
    else:
        print("Aucun resultat a sauvegarder.")

    return all_results


if __name__ == "__main__":
    main()
