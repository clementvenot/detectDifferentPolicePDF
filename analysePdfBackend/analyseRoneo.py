import json

import fitz  # pip install pymupdf

pdf_path = "RoneoSH.pdf"

CM_EN_POINTS = 72 / 2.54
MARGE_ATTENDUE_CM = 2.5
MARGE_MIN_CM = MARGE_ATTENDUE_CM * 0.80
MARGE_MAX_CM = MARGE_ATTENDUE_CM * 1.20

doc = fitz.open(pdf_path)

resultats = []
resultats_taille = []
resultats_numerotation_page = []
nombre_pages_marges_conformes = 0


def determiner_zone_page(bbox, hauteur_page, numero_page):
    centre_y = (bbox[1] + bbox[3]) / 2
    quart = min(int(centre_y / (hauteur_page / 4)), 3)
    zones = ("premier quart", "deuxième quart", "troisième quart", "dernier quart")
    return f"{zones[quart]} de la page {numero_page}"

for page_num, page in enumerate(doc, start=1):
    data = page.get_text("dict")
    numero_page_ecrit = False
    zone_basse_page = page.rect.height * 0.90
    contenu_x0 = None
    contenu_x1 = None

    for block in data["blocks"]:
        if block["type"] != 0:  # uniquement les blocs texte
            continue

        for line in block["lines"]:
            for span in line["spans"]:
                texte = span["text"].strip()
                police = span["font"]
                taille = span["size"]
                est_gras = "bold" in police.lower() or bool(span.get("flags", 0) & 16)
                est_souligne = "underline" in police.lower() or "underlined" in police.lower()

                try:
                    numero_detecte = int(texte)
                except ValueError:
                    numero_detecte = None

                if not texte:
                    continue

                numero_page_valide = (
                    span["bbox"][3] >= zone_basse_page
                    and numero_detecte == page_num
                )
                if len(texte) == 1 and not numero_page_valide:
                    continue

                contenu_x0 = span["bbox"][0] if contenu_x0 is None else min(contenu_x0, span["bbox"][0])
                contenu_x1 = span["bbox"][2] if contenu_x1 is None else max(contenu_x1, span["bbox"][2])

                if (
                    numero_page_valide
                ):
                    numero_page_ecrit = True

                if len(texte) >= 5 and not 10.51 <= taille <= 11.49 and not (est_gras or est_souligne):
                    resultats_taille.append({
                        "coordonnees": {
                            "x0": span["bbox"][0],
                            "y0": span["bbox"][1],
                            "x1": span["bbox"][2],
                            "y1": span["bbox"][3],
                        },
                        "num_taille": taille,
                        "texte": texte,
                        "num_page": page_num,
                        "zone_page": determiner_zone_page(span["bbox"], page.rect.height, page_num),
                    })

                # Vérifie si la police n'est pas Calibri
                if "calibri" not in police.lower():
                    resultats.append({
                        "page": page_num,
                        "texte": texte,
                        "police": police,
                        "x0": span["bbox"][0],
                        "y0": span["bbox"][1],
                        "x1": span["bbox"][2],
                        "y1": span["bbox"][3],
                    })

    if not numero_page_ecrit:
        resultats_numerotation_page.append({
            "numPage": page_num,
            "notWrote": True,
        })

    if contenu_x0 is not None:
        marge_gauche_cm = contenu_x0 / CM_EN_POINTS
        marge_droite_cm = (page.rect.width - contenu_x1) / CM_EN_POINTS

        if (
            MARGE_MIN_CM <= marge_gauche_cm <= MARGE_MAX_CM
            and MARGE_MIN_CM <= marge_droite_cm <= MARGE_MAX_CM
        ):
            nombre_pages_marges_conformes += 1

resultats_par_police = {}

for resultat in resultats:
    resultats_par_police.setdefault(resultat["police"], []).append({
        "coordonnees": {
            "x0": resultat["x0"],
            "y0": resultat["y0"],
            "x1": resultat["x1"],
            "y1": resultat["y1"],
        },
        "nom_police": resultat["police"],
        "texte": resultat["texte"],
        "num_page": resultat["page"],
    })

print(json.dumps({
    "polices": resultats_par_police,
    "tailles": resultats_taille,
    "numerotationPage": resultats_numerotation_page,
    "marge": nombre_pages_marges_conformes / len(doc) > 0.50,
}, ensure_ascii=False, indent=2))



