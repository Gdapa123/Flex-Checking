"""Rapports PDF : bilan d'une cérémonie (admin) et rapport global analytique et technique (super admin).

Données agrégées uniquement : aucun nom, email ni téléphone d'invité n'apparaît dans les rapports.
Graphiques dessinés en vectoriel (ReportLab), sans dépendance système.
"""

from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.graphics.shapes import Drawing, Line, Polygon, PolyLine, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from . import dates

ASSETS = Path(__file__).parent / "assets"
TEXTE = colors.HexColor("#1B1D20")
TEXTE_2 = colors.HexColor("#5F666C")
LIGNE = colors.HexColor("#E3E5E8")
FOND = colors.HexColor("#F5F6F7")
NEUTRE = colors.HexColor("#B9BEC3")
SUCCES = colors.HexColor("#1F7A4D")
ERREUR = colors.HexColor("#B42318")
AVERT = colors.HexColor("#B54708")
MDE = colors.HexColor("#8F1C1F")
PALETTE = ["#8F1C1F", "#1A5E36", "#B54708", "#2F4B7C", "#6B4C9A", "#5F666C"]

LARGEUR, HAUTEUR = A4
MARGE = 16 * mm
UTILE = LARGEUR - 2 * MARGE

STYLES = {
    "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=TEXTE, spaceAfter=6),
    "texte": ParagraphStyle("texte", fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=TEXTE),
    "petit": ParagraphStyle("petit", fontName="Helvetica", fontSize=8.5, leading=12, textColor=TEXTE_2),
    "kpi": ParagraphStyle("kpi", fontName="Helvetica-Bold", fontSize=20, leading=23, textColor=TEXTE),
    "kpi_l": ParagraphStyle("kpi_l", fontName="Helvetica", fontSize=8.5, leading=11, textColor=TEXTE_2),
    "cell": ParagraphStyle("cell", fontName="Helvetica", fontSize=8.5, leading=11, textColor=TEXTE, alignment=TA_LEFT),
    "cell_d": ParagraphStyle(
        "cell_d", fontName="Helvetica", fontSize=8.5, leading=11, textColor=TEXTE, alignment=TA_RIGHT
    ),
    "entete_d": ParagraphStyle(
        "entete_d", fontName="Helvetica", fontSize=8.5, leading=12, textColor=TEXTE_2, alignment=TA_RIGHT
    ),
}


def _n(v):
    """Nombre à la française (espace des milliers, virgule décimale)."""
    if isinstance(v, float):
        return f"{v:,.1f}".replace(",", " ").replace(".", ",")
    return f"{v:,}".replace(",", " ")


def _x(texte):
    """Échappe un texte pour Paragraph (balises ReportLab)."""
    return escape(str(texte))


def _couleur(hexa, defaut=MDE):
    try:
        return colors.HexColor(hexa)
    except (ValueError, TypeError):
        return defaut


# ---------------------------------------------------------------------------- graphiques


def _cadre(largeur, hauteur):
    d = Drawing(largeur, hauteur)
    return d


def barres(
    valeurs,
    etiquettes,
    couleur,
    *,
    largeur=UTILE,
    hauteur=150,
    surligne=None,
    suffixe="",
    pas_etiquette=1,
    couleurs=None,
):
    """Histogramme vertical avec valeurs au-dessus des barres (`couleurs` : une teinte par barre)."""
    d = Drawing(largeur, hauteur)
    if not valeurs or not any(valeurs):
        d.add(Line(0, 16, largeur, 16, strokeColor=LIGNE, strokeWidth=0.8))
        d.add(_vide(largeur, hauteur))
        if not valeurs:
            return d
    bas, haut = 16, 14
    zone = hauteur - bas - haut
    maxi = max(max(valeurs), 1)
    pas = largeur / len(valeurs)
    largeur_barre = min(pas * 0.72, 34)
    d.add(Line(0, bas, largeur, bas, strokeColor=LIGNE, strokeWidth=0.8))
    for i, (v, e) in enumerate(zip(valeurs, etiquettes, strict=True)):
        x = i * pas + (pas - largeur_barre) / 2
        h = zone * v / maxi
        base = couleurs[i] if couleurs else couleur
        teinte = base if surligne is None or i == surligne else _attenue(base)
        if h > 0:
            d.add(Rect(x, bas, largeur_barre, h, fillColor=teinte, strokeColor=None))
        if v and len(valeurs) <= 40:
            d.add(
                String(
                    x + largeur_barre / 2,
                    bas + h + 3,
                    f"{v}{suffixe}",
                    fontName="Helvetica-Bold",
                    fontSize=7,
                    fillColor=TEXTE,
                    textAnchor="middle",
                )
            )
        if i % pas_etiquette == 0:
            d.add(
                String(
                    x + largeur_barre / 2,
                    4,
                    e,
                    fontName="Helvetica",
                    fontSize=6.8,
                    fillColor=TEXTE_2,
                    textAnchor="middle",
                )
            )
    return d


def _attenue(c, alpha=0.35):
    return colors.Color(c.red, c.green, c.blue, alpha=alpha)


def _vide(largeur, hauteur, texte="Aucune donnée sur la période"):
    return String(
        largeur / 2, hauteur / 2, texte, fontName="Helvetica", fontSize=9, fillColor=TEXTE_2, textAnchor="middle"
    )


def barres_groupees(groupes, couleur, libelles, *, largeur=UTILE):
    """Barres horizontales groupées : `groupes` = [(libellé, [valeur 1, valeur 2])], teinte claire puis foncée."""
    hauteur_groupe = 30
    d = Drawing(largeur, hauteur_groupe * max(len(groupes), 1) + 16)
    maxi = max([max(v) for _, v in groupes] + [1])
    col_libelle, col_valeur = largeur * 0.24, 60
    zone = largeur - col_libelle - col_valeur
    teintes = [_attenue(couleur, 0.35), couleur]
    for g, (libelle, valeurs) in enumerate(groupes):
        y0 = (len(groupes) - 1 - g) * hauteur_groupe + 18
        d.add(String(0, y0 + 9, str(libelle)[:28], fontName="Helvetica-Bold", fontSize=8.5, fillColor=TEXTE))
        for k, v in enumerate(valeurs):
            y = y0 + (1 - k) * 11
            d.add(Rect(col_libelle, y, zone, 8, fillColor=FOND, strokeColor=None))
            if v:
                d.add(Rect(col_libelle, y, zone * v / maxi, 8, fillColor=teintes[k], strokeColor=None))
            d.add(
                String(
                    largeur, y + 0.5, _n(v), fontName="Helvetica-Bold", fontSize=8, fillColor=TEXTE, textAnchor="end"
                )
            )
    x = col_libelle
    for libelle, teinte in zip(libelles, teintes, strict=True):
        d.add(Rect(x, 2, 8, 8, fillColor=teinte, strokeColor=None))
        d.add(String(x + 11, 3, libelle, fontName="Helvetica", fontSize=8, fillColor=TEXTE_2))
        x += 20 + len(libelle) * 4.4
    return d


def barres_empilees(series, etiquettes, couleurs, *, largeur=UTILE, hauteur=140, pas_etiquette=1):
    """Histogramme empilé : `series` = liste de listes (une par catégorie)."""
    d = _cadre(largeur, hauteur)
    totaux = [sum(col) for col in zip(*series, strict=True)] if series else []
    bas, haut = 16, 12
    zone = hauteur - bas - haut
    maxi = max(totaux + [1])
    pas = largeur / max(len(etiquettes), 1)
    lb = min(pas * 0.7, 28)
    d.add(Line(0, bas, largeur, bas, strokeColor=LIGNE, strokeWidth=0.8))
    if not any(totaux):
        d.add(_vide(largeur, hauteur, "Aucune nouvelle erreur sur la période"))
    for i, e in enumerate(etiquettes):
        x = i * pas + (pas - lb) / 2
        y = bas
        for serie, c in zip(series, couleurs, strict=True):
            h = zone * serie[i] / maxi
            if h > 0:
                d.add(Rect(x, y, lb, h, fillColor=c, strokeColor=colors.white, strokeWidth=0.4))
                y += h
        if totaux[i]:
            d.add(
                String(
                    x + lb / 2,
                    y + 3,
                    str(totaux[i]),
                    fontName="Helvetica-Bold",
                    fontSize=7,
                    fillColor=TEXTE,
                    textAnchor="middle",
                )
            )
        if i % pas_etiquette == 0:
            d.add(String(x + lb / 2, 4, e, fontName="Helvetica", fontSize=6.8, fillColor=TEXTE_2, textAnchor="middle"))
    return d


def courbe(valeurs, etiquettes, couleur, *, largeur=UTILE, hauteur=130, pas_etiquette=5):
    """Courbe avec aire (cumul ou série temporelle)."""
    d = _cadre(largeur, hauteur)
    if len(valeurs) < 2:
        return barres(valeurs, etiquettes, couleur, largeur=largeur, hauteur=hauteur)
    bas, haut, gauche = 16, 14, 4
    zone = hauteur - bas - haut
    maxi = max(max(valeurs), 1)
    pas = (largeur - 2 * gauche) / (len(valeurs) - 1)
    points = []
    for i, v in enumerate(valeurs):
        points += [gauche + i * pas, bas + zone * v / maxi]
    aire = [gauche, bas, *points, gauche + (len(valeurs) - 1) * pas, bas]
    d.add(Polygon(aire, fillColor=colors.Color(couleur.red, couleur.green, couleur.blue, alpha=0.12), strokeColor=None))
    d.add(PolyLine(points, strokeColor=couleur, strokeWidth=1.6))
    d.add(Line(0, bas, largeur, bas, strokeColor=LIGNE, strokeWidth=0.8))
    d.add(
        String(
            points[-2],
            points[-1] + 4,
            _n(valeurs[-1]),
            fontName="Helvetica-Bold",
            fontSize=7.5,
            fillColor=TEXTE,
            textAnchor="end",
        )
    )
    for i, e in enumerate(etiquettes):
        if i % pas_etiquette == 0 or i == len(etiquettes) - 1:
            d.add(
                String(
                    gauche + i * pas, 4, e, fontName="Helvetica", fontSize=6.8, fillColor=TEXTE_2, textAnchor="middle"
                )
            )
    return d


def barres_horizontales(lignes, couleur, *, largeur=UTILE, total=None):
    """Barres horizontales libellées : `lignes` = [(libellé, valeur)]."""
    hauteur_ligne = 17
    d = _cadre(largeur, hauteur_ligne * max(len(lignes), 1) + 2)
    if not lignes:
        d.add(String(0, 4, "Aucune donnée", fontName="Helvetica", fontSize=9, fillColor=TEXTE_2))
        return d
    maxi = max(max(v for _, v in lignes), 1)
    col_libelle, col_valeur = largeur * 0.36, 70
    zone = largeur - col_libelle - col_valeur
    for i, (libelle, v) in enumerate(lignes):
        y = (len(lignes) - 1 - i) * hauteur_ligne + 4
        d.add(String(0, y + 2, str(libelle)[:42], fontName="Helvetica", fontSize=8.5, fillColor=TEXTE))
        d.add(Rect(col_libelle, y, zone, 9, fillColor=FOND, strokeColor=None))
        if v:
            d.add(Rect(col_libelle, y, zone * v / maxi, 9, fillColor=couleur, strokeColor=None))
        texte = _n(v) + (f"  ({round(v / total * 100)} %)" if total else "")
        d.add(
            String(largeur, y + 1.5, texte, fontName="Helvetica-Bold", fontSize=8.5, fillColor=TEXTE, textAnchor="end")
        )
    return d


def legende(elements, largeur=UTILE):
    d = _cadre(largeur, 12)
    x = 0
    for libelle, c in elements:
        d.add(Rect(x, 2, 8, 8, fillColor=c, strokeColor=None))
        d.add(String(x + 11, 3, libelle, fontName="Helvetica", fontSize=8, fillColor=TEXTE_2))
        x += 20 + len(libelle) * 4.4
    return d


# ---------------------------------------------------------------------------- mise en page


def _kpis(elements):
    cellules = [
        [Paragraph(_x(valeur), STYLES["kpi"]), Paragraph(_x(libelle), STYLES["kpi_l"])] for libelle, valeur in elements
    ]
    t = Table([cellules], colWidths=[UTILE / len(elements)] * len(elements))
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), FOND),
                ("LINEAFTER", (0, 0), (-2, -1), 2, colors.white),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return t


def _tableau(entetes, lignes, largeurs, *, alignes_droite=()):
    # Paragraph interprète des balises : tout texte (dont les saisies des invités) est échappé
    donnees = [
        [
            Paragraph(f"<b>{_x(e)}</b>", STYLES["entete_d" if i in alignes_droite else "petit"])
            for i, e in enumerate(entetes)
        ]
    ]
    for ligne in lignes:
        donnees.append(
            [Paragraph(_x(c), STYLES["cell_d" if i in alignes_droite else "cell"]) for i, c in enumerate(ligne)]
        )
    t = Table(donnees, colWidths=largeurs, repeatRows=1)
    style = [
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, TEXTE_2),
        ("LINEBELOW", (0, 1), (-1, -1), 0.4, LIGNE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]
    for col in alignes_droite:
        style.append(("ALIGN", (col, 0), (col, -1), "RIGHT"))
    t.setStyle(TableStyle(style))
    return t


def _section(titre, *contenu, note=None):
    elements = [Paragraph(titre, STYLES["h2"]), *contenu]
    if note:
        elements += [Spacer(1, 3), Paragraph(note, STYLES["petit"])]
    return KeepTogether([*elements, Spacer(1, 14)])


def _document(titre, sous_titre, couleur, auteur, story):
    tampon = BytesIO()
    genere = timezone.localtime()

    def page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(couleur)
        canvas.rect(0, HAUTEUR - 30 * mm, LARGEUR, 30 * mm, stroke=0, fill=1)
        logo = ASSETS / "logo-blanc.png"
        if logo.exists():
            canvas.drawImage(
                str(logo),
                MARGE,
                HAUTEUR - 13 * mm,
                width=30 * mm,
                height=7 * mm,
                mask="auto",
                preserveAspectRatio=True,
                anchor="w",
            )
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 17)
        canvas.drawString(MARGE, HAUTEUR - 22 * mm, titre)
        canvas.setFont("Helvetica", 9.5)
        canvas.drawString(MARGE, HAUTEUR - 27 * mm, sous_titre)
        canvas.setFillColor(TEXTE_2)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(
            MARGE,
            9 * mm,
            f"Flex’Checking · MDE Business School · généré le {genere:%d/%m/%Y à %H:%M} par {auteur} · "
            "document interne, données agrégées",
        )
        canvas.drawRightString(LARGEUR - MARGE, 9 * mm, f"Page {doc.page}")
        canvas.restoreState()

    doc = SimpleDocTemplate(
        tampon,
        pagesize=A4,
        leftMargin=MARGE,
        rightMargin=MARGE,
        topMargin=38 * mm,
        bottomMargin=18 * mm,
        title=titre,
        author="Flex’Checking · MDE Business School",
        subject=sous_titre,
        creator="Flex’Checking",
    )
    doc.build(story, onFirstPage=page, onLaterPages=page)
    return tampon.getvalue()


# ---------------------------------------------------------------------------- rapports


def rapport_evenement(evenement, s, auteur):
    """Bilan d'une cérémonie, à partir des statistiques du tableau de bord (`statistiques()`)."""
    couleur = _couleur(evenement.programme.couleur_principale)
    story = [
        _kpis(
            [
                ("Inscrits", _n(s["inscrits"])),
                ("Présents", _n(s["presents"])),
                ("Taux de présence", f"{s['taux']} %"),
                ("Remplissage", f"{s['remplissage']} %"),
            ]
        ),
        Spacer(1, 6),
        Paragraph(
            f"{dates.date_longue_majuscule(evenement.date)} · lancement {s['heureDebut']} · {_x(evenement.lieu)} · "
            f"capacité {_n(s['capacite'])} places · {_n(s['nonPresents'])} inscrits non présents.",
            STYLES["petit"],
        ),
        Spacer(1, 14),
    ]
    tranches = s["tranches"]
    pas = max(1, len(tranches) // 12)
    story.append(
        _section(
            "Arrivées par tranche de 15 minutes",
            barres(
                [t["arrivees"] for t in tranches],
                [t["debut"] for t in tranches],
                couleur,
                surligne=None,
                pas_etiquette=pas,
            ),
            note=(
                f"Pic : {s['pic']['debut']} – {s['pic']['fin']}, {s['pic']['arrivees']} "
                f"arrivée{'s' if s['pic']['arrivees'] > 1 else ''}."
                if s["pic"]
                else "Aucune arrivée enregistrée."
            ),
        )
    )
    cumul, total = [], 0
    for t in tranches:
        total += t["arrivees"]
        cumul.append(total)
    if total:
        story.append(
            _section(
                "Présences cumulées",
                courbe(cumul, [t["debut"] for t in tranches], couleur, pas_etiquette=max(1, len(tranches) // 8)),
            )
        )
    if s["inscriptions"]:
        story.append(
            _section(
                "Inscriptions cumulées",
                courbe(
                    [j["cumul"] for j in s["inscriptions"]],
                    [j["date"][8:10] + "/" + j["date"][5:7] for j in s["inscriptions"]],
                    couleur,
                    pas_etiquette=max(1, len(s["inscriptions"]) // 8),
                ),
            )
        )
    presents_total = sum(m["nb"] for m in s["modes"])
    story.append(
        _section(
            "Répartition par mode d’émargement",
            barres_horizontales([(m["libelle"], m["nb"]) for m in s["modes"]], couleur, total=presents_total or None),
        )
    )
    if s["postes"]:
        story.append(
            _section(
                "Arrivées par poste d’accueil",
                barres_horizontales([(p["poste"], p["nb"]) for p in s["postes"]], couleur),
            )
        )
    e = s["emails"]
    lignes_emails = [
        [
            "Email n°1 · invitation",
            _n(e["invitationsEnvoyees"]),
            _n(e["invitationsEchec"]),
            _n(e["invitationsAttente"]),
        ],
    ]
    if e["magazineActif"]:
        lignes_emails.append(["Email n°2 · magazine", _n(e["magazinesEnvoyes"]), _n(e["magazinesEchec"]), "–"])
    story.append(
        _section(
            "Suivi des emails",
            _tableau(
                ["Email", "Envoyés", "En échec", "En attente"],
                lignes_emails,
                [UTILE * 0.46, UTILE * 0.18, UTILE * 0.18, UTILE * 0.18],
                alignes_droite=(1, 2, 3),
            ),
        )
    )
    story += _section_satisfaction(evenement, couleur)
    comparaison = list(reversed(s["comparaison"]))
    if len(comparaison) > 1:
        story.append(
            _section(
                "Comparaison avec les éditions précédentes",
                barres(
                    [c["taux"] for c in comparaison],
                    [str(c["annee"]) for c in comparaison],
                    couleur,
                    hauteur=120,
                    suffixe=" %",
                    surligne=len(comparaison) - 1,
                ),
                Spacer(1, 6),
                _tableau(
                    ["Année", "Inscrits", "Présents", "Taux de présence"],
                    [[c["annee"], _n(c["inscrits"]), _n(c["presents"]), f"{c['taux']} %"] for c in s["comparaison"]],
                    [UTILE * 0.25] * 4,
                    alignes_droite=(1, 2, 3),
                ),
            )
        )
    return _document(
        f"Rapport · {evenement.nom_affiche}",
        f"Bilan de la cérémonie au {timezone.localtime():%d/%m/%Y à %H:%M}",
        couleur,
        auteur,
        story,
    )


def _section_satisfaction(evenement, couleur):
    """Sondage de satisfaction (email n°3), dès qu'il a été envoyé."""
    from .sondages import resultats

    r = resultats(evenement)
    if not r["envoyes"]:
        return []

    def note(v, sur):
        return f"{str(v).replace('.', ',')} / {sur}" if v is not None else "–"

    contenu = [
        _kpis(
            [
                ("Réponses", f"{_n(r['reponses'])} / {_n(r['envoyes'])}"),
                ("Taux de réponse", f"{r['tauxReponse']} %"),
                ("Satisfaction", note(r["noteGlobale"], 5)),
                ("Accueil", note(r["noteAccueil"], 5)),
                ("NPS", "–" if r["nps"] is None else f"{r['nps']:+d}"),
            ]
        )
    ]
    if r["reponses"]:
        contenu += [
            Spacer(1, 8),
            Paragraph("Satisfaction générale (nombre de réponses par note)", STYLES["petit"]),
            barres(
                [x["nb"] for x in r["repartitionGlobale"]],
                [f"{x['valeur']}/5" for x in r["repartitionGlobale"]],
                couleur,
                hauteur=100,
                surligne=None,
            ),
        ]
        if r["commentaires"]:
            contenu += [Spacer(1, 6), Paragraph("Derniers commentaires", STYLES["petit"])]
            contenu += [Paragraph(f"« {_x(c['texte'])} »", STYLES["cell"]) for c in r["commentaires"][:5]]
    return [
        _section(
            "Satisfaction des participants",
            *contenu,
            note=(
                "Sondage envoyé aux présents le lendemain à 8 h, ouvert 24 heures. NPS : part des notes 9-10 "
                "moins part des notes 0-6 à « Recommanderiez-vous MDE Business School ? »."
            ),
        )
    ]


def rapport_global(a, t, auteur):
    """Rapport du super admin : activité de toutes les cérémonies puis indicateurs techniques."""
    tot = a["totaux"]
    story = [
        _kpis(
            [
                ("Cérémonies", _n(tot["evenements"])),
                ("Inscrits", _n(tot["inscrits"])),
                ("Présents", _n(tot["presents"])),
                ("Taux de présence", f"{tot['taux']} %"),
            ]
        ),
        Spacer(1, 14),
    ]
    prog = a["programmes"]
    story.append(
        _section(
            "Inscrits et présents par programme",
            barres_groupees(
                [(p["programme"], [p["inscrits"], p["presents"]]) for p in prog], MDE, ["Inscrits", "Présents"]
            ),
            Spacer(1, 6),
            _tableau(
                ["Programme", "Cérémonies", "Inscrits", "Présents", "Taux"],
                [
                    [p["programme"], p["evenements"], _n(p["inscrits"]), _n(p["presents"]), f"{p['taux']} %"]
                    for p in prog
                ],
                [UTILE * 0.32, UTILE * 0.17, UTILE * 0.17, UTILE * 0.17, UTILE * 0.17],
                alignes_droite=(1, 2, 3, 4),
            ),
        )
    )
    jours = a["inscriptionsParJour"]
    story.append(
        _section(
            "Inscriptions par jour (60 derniers jours)",
            barres(
                [j["nb"] for j in jours], [j["date"][8:10] + "/" + j["date"][5:7] for j in jours], MDE, pas_etiquette=7
            ),
            note=f"{_n(sum(j['nb'] for j in jours))} inscriptions sur la période.",
        )
    )
    annees = a["annees"]
    if annees:
        story.append(
            _section(
                "Taux de présence par année et par programme",
                barres(
                    [x["taux"] for x in annees],
                    [f"{x['programme']} {str(x['annee'])[2:]}" for x in annees],
                    MDE,
                    hauteur=130,
                    suffixe=" %",
                    couleurs=[_couleur(x["couleur"]) for x in annees],
                ),
            )
        )
    story.append(
        _section(
            "Toutes les cérémonies",
            _tableau(
                ["Cérémonie", "Date", "Capacité", "Inscrits", "Présents", "Taux"],
                [
                    [
                        e["nom"],
                        e["date"][8:10] + "/" + e["date"][5:7] + "/" + e["date"][:4],
                        _n(e["capacite"]),
                        _n(e["inscrits"]),
                        _n(e["presents"]),
                        f"{e['taux']} %",
                    ]
                    for e in a["evenements"]
                ],
                [UTILE * 0.36, UTILE * 0.14, UTILE * 0.125, UTILE * 0.125, UTILE * 0.125, UTILE * 0.125],
                alignes_droite=(2, 3, 4, 5),
            ),
        )
    )
    presents = sum(m["nb"] for m in a["modes"])
    story.append(
        _section(
            "Modes d’émargement (toutes cérémonies)",
            barres_horizontales([(m["libelle"], m["nb"]) for m in a["modes"]], MDE, total=presents or None),
        )
    )
    if a["entreprises"]:
        story.append(
            _section(
                "Entreprises les plus représentées",
                barres_horizontales([(x["entreprise"], x["nb"]) for x in a["entreprises"]], MDE),
            )
        )
    story.append(
        _section(
            "Emails",
            _tableau(
                ["Envoyés", "En échec", "En attente", "Magazines envoyés"],
                [
                    [
                        _n(tot["emailsEnvoyes"]),
                        _n(tot["emailsEchec"]),
                        _n(tot["emailsAttente"]),
                        _n(tot["magazinesEnvoyes"]),
                    ]
                ],
                [UTILE / 4] * 4,
                alignes_droite=(0, 1, 2, 3),
            ),
        )
    )

    # --- technique ---
    sante, resume = t["sante"], t["resume"]
    etat = lambda ok: "Opérationnel" if ok else "Indisponible"  # noqa: E731
    story.append(
        _section(
            "Santé technique",
            _kpis(
                [
                    ("Requêtes API (1 h)", _n(resume["requetesHeure"])),
                    ("Temps de réponse moyen", f"{resume['dureeMoyenneMs']} ms"),
                    ("Erreurs serveur (1 h)", _n(resume["erreurs5xxHeure"])),
                    ("Scans (1 h)", _n(resume["scansHeure"])),
                ]
            ),
            Spacer(1, 6),
            _tableau(
                ["Composant", "État", "Latence"],
                [
                    [
                        "Base de données",
                        etat(sante["base"]),
                        f"{_n(float(sante['baseMs']))} ms" if sante["baseMs"] is not None else "–",
                    ],
                    [
                        "Redis (cache, temps réel, file)",
                        etat(sante["redis"]),
                        f"{_n(float(sante['redisMs']))} ms" if sante["redisMs"] is not None else "–",
                    ],
                    [
                        "File d’envoi des emails",
                        f"{sante['fileEmails']} en attente" if sante["fileEmails"] is not None else "–",
                        "",
                    ],
                ],
                [UTILE * 0.5, UTILE * 0.3, UTILE * 0.2],
                alignes_droite=(2,),
            ),
        )
    )
    minutes = t["requetes"]
    story.append(
        _section(
            "Requêtes API par minute (dernière heure)",
            barres(
                [m["requetes"] for m in minutes], [m["minute"] for m in minutes], MDE, hauteur=110, pas_etiquette=10
            ),
        )
    )
    sources = [
        ("Navigateur", "NAVIGATEUR", "#2F4B7C"),
        ("Serveur", "SERVEUR", "#B42318"),
        ("Tâches", "TACHE", "#B54708"),
        ("Emails", "EMAIL", "#6B4C9A"),
    ]
    ej = t["erreursParJour"]
    story.append(
        _section(
            "Nouvelles erreurs techniques par jour (14 jours)",
            barres_empilees(
                [[j[c] for j in ej] for _, c, _ in sources],
                [j["date"][8:10] + "/" + j["date"][5:7] for j in ej],
                [colors.HexColor(h) for *_, h in sources],
                pas_etiquette=2,
            ),
            legende([(lib, colors.HexColor(h)) for lib, _, h in sources]),
            Spacer(1, 6),
            _tableau(
                ["Origine", "À traiter", "Vues dans les 24 h"],
                [[x["libelle"], _n(x["nb"]), _n(x["dernieres24h"])] for x in t["erreursATraiter"]],
                [UTILE * 0.5, UTILE * 0.25, UTILE * 0.25],
                alignes_droite=(1, 2),
            ),
        )
    )
    e24 = t["emails24h"]
    story.append(
        _section(
            "Emails des dernières 24 heures",
            _tableau(
                ["Envoyés", "En échec", "En attente"],
                [[_n(e24["envoyes"]), _n(e24["echecs"]), _n(e24["attente"])]],
                [UTILE / 3] * 3,
                alignes_droite=(0, 1, 2),
            ),
        )
    )
    return _document(
        "Rapport global · Flex’Checking",
        f"Activité de toutes les cérémonies et indicateurs techniques au {timezone.localtime():%d/%m/%Y à %H:%M}",
        MDE,
        auteur,
        story,
    )
