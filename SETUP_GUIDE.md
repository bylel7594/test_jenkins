# Guide de Configuration — Workflow B2B Prospection n8n

## Architecture du Workflow (31 nodes)

```
[Scheduler] → [Params] → [Combinaisons] → [SplitBatches]
    → [Google Places Search] → [Places Details]
    → [Site web ?] → [Vérif HTTP + Analyse] ─┐
                  → [Pas de site +3]          ├→ [Merge]
    → [Score Secteur] → [France Travail] → [Analyse Offres]
    → [Score Taille] → [Filtre Score Minimum]
    → [Hunter.io Enrichissement] → [Extraire Contact]
    → [Préparer Row] → [Check Doublon Sheets] → [Nouveau ?]
    → [Google Sheets] → [Score ≥ 7 ?] → [Telegram Alerte]
    → [Agrégat] → [Résumé Quotidien]
```

---

## Grille de Scoring

| Signal détecté                        | Points |
|---------------------------------------|--------|
| Pas de site web                       | +3     |
| Site web inaccessible / erreur HTTP   | +2     |
| Pas de campagnes Google Ads détectées | +2     |
| Secteur prioritaire                   | +2     |
| Offres d'emploi récentes (30j)        | +2     |
| Pas de SSL (HTTP seulement)           | +1     |
| Site web sur Wix ou Jimdo             | +1     |
| Site avec copyright ancien (≥ 4 ans)  | +1     |
| Petite structure (< 50 avis Google)   | +1     |
| Grande structure (> 500 avis)         | -1     |

**Seuil minimum par défaut : 4 points**  
**Notification Telegram immédiate : ≥ 7 points**

---

## Credentials à Configurer dans n8n

### 1. Google Places API
- Type : **Generic Credential / API Key**
- Nom dans n8n : `Google Places API`
- Variable : `googlePlacesApiKey`
- Obtenir : https://console.cloud.google.com → APIs → Places API
- Activer : Places API + Maps JavaScript API
- Quota : 200$/mois offerts, puis ~0.017$/requête

### 2. France Travail (Pôle Emploi) API
- Type : **OAuth2**
- Nom dans n8n : `France Travail OAuth2`
- Inscription : https://francetravail.io/data/api
- Créer une application → récupérer client_id + client_secret
- Token URL : `https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire`
- Scope : `api_offresdemploiv2 o2dsoffre`
- Grant Type : Client Credentials

### 3. Hunter.io API
- Type : **Generic Credential / API Key**
- Nom dans n8n : `Hunter.io API Key`
- Variable : `hunterIoApiKey`
- Inscription : https://hunter.io (plan gratuit = 25 req/mois, Starter = 500/mois)
- Endpoint utilisé : `/v2/domain-search`

### 4. Google Sheets OAuth2
- Type : **Google Sheets OAuth2**
- Nom dans n8n : `Google Sheets`
- Activer Google Sheets API dans Google Cloud Console
- Créer OAuth2 credentials (type "Web application")
- Redirect URI : `https://votre-n8n.domaine.com/rest/oauth2-credential/callback`

### 5. Telegram Bot
- Type : **Telegram API**
- Créer un bot via @BotFather sur Telegram
- Récupérer le token
- Trouver votre chat_id : envoyer un message au bot puis appeler
  `https://api.telegram.org/bot<TOKEN>/getUpdates`

---

## Variables d'Environnement n8n (`.env`)

```env
# Dans votre fichier .env de n8n sur VPS
GOOGLE_SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
TELEGRAM_CHAT_ID=123456789
```

---

## Structure du Google Sheet

Créer un onglet nommé **`Prospects`** avec ces colonnes (ligne 1) :

```
date_detection | priorite | score | nom_entreprise | secteur | ville |
telephone | website | website_status | ssl | technologies | google_ads |
offres_emploi | contact_prenom | contact_nom | contact_email |
contact_poste | email_confiance | signaux_detectes | statut | notes
```

---

## Installation sur VPS

```bash
# 1. Installer n8n (Docker recommandé)
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=motdepasse \
  -e GOOGLE_SHEET_ID=VOTRE_SHEET_ID \
  -e TELEGRAM_CHAT_ID=VOTRE_CHAT_ID \
  -e GENERIC_TIMEZONE=Europe/Paris \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n

# 2. Accéder à l'interface
# http://votre-ip:5678

# 3. Importer le workflow
# Menu → Import from file → sélectionner n8n_b2b_prospection.json
```

---

## Personnaliser les Secteurs et Villes

Dans le node **"Paramètres de Recherche"**, modifier :

```javascript
// Secteurs à prospecter
secteurs: ["restaurant", "boulangerie", "salon de coiffure", ...]

// Secteurs prioritaires (bonus +2)
secteurs_prioritaires: ["restaurant", "boulangerie", ...]

// Villes cibles
villes: ["Paris", "Lyon", ...]

// Seuil minimum de score
score_minimum: 4
```

---

## Gestion des Quotas API

| API            | Limite gratuite       | Coût dépassement     | Délai intégré |
|----------------|-----------------------|----------------------|---------------|
| Google Places  | 200$/mois offerts     | ~0.017$/req           | 2 secondes    |
| France Travail | Gratuit               | Gratuit               | 1 seconde     |
| Hunter.io      | 25 req/mois (gratuit) | 49€/mois (500 req)   | 2 secondes    |
| Google Sheets  | Gratuit               | Gratuit               | —             |
| Telegram       | Gratuit               | Gratuit               | —             |

**Estimation coût pour 200 entreprises/jour :**
- Google Places : ~7$/mois (Search + Details)
- Hunter.io : ~49€/mois (plan Starter recommandé)
- **Total : ~55€/mois**

---

## Conseils d'Optimisation

1. **Déduplication** : Le node "Vérifier Doublon" empêche les doublons, mais après 30 jours
   vous pouvez relancer sur les mêmes secteurs pour capturer les nouvelles créations.

2. **Scoring affiné** : Ajustez les points dans les nodes `Score *` selon vos résultats.

3. **Enrichissement alternatif** : Si Hunter.io est insuffisant, remplacez par 
   [Dropcontact](https://dropcontact.io) (API similaire, meilleur pour la France).

4. **Google Ads check** : La détection se fait via analyse du code HTML (gtag.js, 
   conversion tags). Pour une détection plus fiable, utilisez l'outil 
   [SimilarWeb](https://www.similarweb.com) ou [SpyFu](https://www.spyfu.com).

5. **Planification** : Le cron `0 7 * * 1-5` lance le workflow du lundi au vendredi à 7h.
   Adaptez selon votre volume (weekly si trop de résultats).
