const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const CATEGORIES = {
  erp: { label: 'ERP généraliste', icon: '🏭', ex: 'Odoo, SAP, Sage, Dynamics…', criteria: [
    { n: 'Comptabilité & finances', d: 'Saisie, clôture, bilan, TVA, multi-devises', w: 2 },
    { n: 'Gestion des achats', d: 'BC, réception, facture fournisseur, relances', w: 2 },
    { n: 'Gestion des ventes', d: 'Devis, BL, facturation client, CRM', w: 2 },
    { n: 'Gestion des stocks', d: 'Mouvements, inventaire, multi-dépôts', w: 2 },
    { n: 'Production & MRP', d: 'Gammes, nomenclatures, ordres de fabrication', w: 1 },
    { n: 'Reporting & BI intégrée', d: 'Indicateurs natifs, exports, tableaux de bord', w: 2 },
    { n: 'Droits & workflow', d: 'Profils, rôles, approbations configurables', w: 1 },
    { n: 'Localisation Maroc (CGNC, TVA, IS, IR, CNSS)', d: 'Plan comptable marocain, déclarations fiscales', w: 2 },
    { n: 'Ergonomie & prise en main', d: 'Interface claire, formation courte requise', w: 1 },
    { n: 'Support & maintenance locale', d: 'Équipe support Maroc, SLA défini', w: 2 },
    { n: 'Hébergement & sécurité', d: 'Cloud/on-premise, backup, conformité RGPD', w: 1 },
    { n: 'Intégrations & API', d: 'Connexion banque, douane, partenaires tiers', w: 1 }
  ]},
  compta: { label: 'Comptabilité & finance', icon: '💰', ex: 'EBP, Cegid, Sage 100…', criteria: [
    { n: 'Plan comptable CGNC', d: 'Conformité plan comptable marocain', w: 2 },
    { n: 'Saisie & clôture comptable', d: 'Journaux, lettrage, clôture mensuelle/annuelle', w: 2 },
    { n: 'Gestion TVA', d: 'Déclarations CA, prorata, remboursement', w: 2 },
    { n: 'États financiers réglementaires', d: 'Bilan, CPC, ESG, TF aux normes OMPIC', w: 2 },
    { n: 'Gestion de la paie', d: 'Salaires, CNSS, IR, bulletins de paie', w: 2 },
    { n: 'Trésorerie & rapprochement bancaire', d: 'Suivi encaissements, rapprochement', w: 1 },
    { n: 'Analytique & centres de coûts', d: 'Ventilation analytique, budget vs réel', w: 1 },
    { n: 'Multi-société & multi-exercice', d: 'Consolidation, exercices parallèles', w: 1 },
    { n: 'Déclarations fiscales (IS, IR, TVA)', d: 'Génération automatique des déclarations DGI', w: 2 },
    { n: 'Support & mises à jour fiscales Maroc', d: 'Équipe locale, mises à jour réglementaires', w: 2 }
  ]},
  ecom: { label: 'E-commerce', icon: '🛒', ex: 'WooCommerce, Shopify, Magento…', criteria: [
    { n: 'Catalogue & gestion produits', d: 'Variantes, attributs, stock temps réel', w: 2 },
    { n: "Tunnel d'achat & panier", d: 'UX fluide, abandon panier, relances', w: 2 },
    { n: 'Paiement en ligne Maroc (CMI, PayZone…)', d: 'Intégration passerelles paiement marocaines', w: 2 },
    { n: 'Gestion commandes & livraisons', d: 'Suivi statuts, BL, retours', w: 2 },
    { n: 'Gestion clients & CRM', d: 'Comptes client, historique, segmentation', w: 1 },
    { n: 'Marketing & promotions', d: 'Codes promo, soldes, newsletter', w: 1 },
    { n: 'SEO & performance', d: 'URLs propres, vitesse, balises meta', w: 1 },
    { n: 'Back-office & reporting', d: 'Tableau de bord ventes, exports', w: 1 },
    { n: 'Mobile-first & responsive', d: 'Expérience mobile native', w: 1 },
    { n: 'Connexion ERP / stocks', d: 'Sync stock automatique avec SI existant', w: 2 },
    { n: 'Support & hébergement', d: 'SLA, sauvegardes, sécurité', w: 1 }
  ]},
  rh: { label: 'RH & paie', icon: '👥', ex: 'Agirh, Kelio, SIRH…', criteria: [
    { n: 'Gestion administrative du personnel', d: 'Dossiers salariés, contrats, avenants', w: 2 },
    { n: 'Calcul de la paie', d: 'Salaires, primes, retenues, net à payer', w: 2 },
    { n: 'CNSS & AMO', d: 'Génération déclarations et bordereaux CNSS', w: 2 },
    { n: 'IR sur salaires (barème marocain)', d: 'Calcul IR, régularisation annuelle', w: 2 },
    { n: 'Bulletins de paie', d: 'Génération automatique, archivage', w: 2 },
    { n: 'Congés & absences', d: 'Soldes congés, workflow validation manager', w: 1 },
    { n: 'Recrutement (ATS)', d: 'Offres, candidatures, suivi entretiens', w: 1 },
    { n: 'Formation & compétences', d: 'Plan de formation, suivi, bilan', w: 1 },
    { n: 'Évaluation & entretiens annuels', d: 'Formulaires, objectifs, historique', w: 1 },
    { n: 'Reporting RH & tableaux de bord', d: 'Masse salariale, turn-over, effectifs', w: 1 },
    { n: 'Conformité code du travail marocain', d: 'Mises à jour légales automatiques', w: 2 }
  ]},
  hotel: { label: 'Hôtellerie & restauration', icon: '🏨', ex: 'PMS, OPERA, eZee…', criteria: [
    { n: 'Gestion des réservations (PMS)', d: 'Planning chambres, check-in/out, disponibilités', w: 2 },
    { n: 'Tarification & yield management', d: 'Grilles tarifaires, saisons, promotions', w: 2 },
    { n: 'Connexion channel manager', d: 'Booking.com, Expedia, Airbnb…', w: 2 },
    { n: 'Facturation & encaissement', d: 'Note de frais, split de facture, paiement en ligne', w: 2 },
    { n: 'Caisse restaurant & F&B (POS)', d: 'POS, tablettes serveurs, cuisine KDS', w: 2 },
    { n: 'Housekeeping', d: 'Planning nettoyage, état des chambres', w: 1 },
    { n: 'CRM clients & fidélité', d: 'Historique séjours, préférences, points fidélité', w: 1 },
    { n: 'Reporting & statistiques', d: "Taux d'occupation, RevPAR, CA par activité", w: 2 },
    { n: 'Contrôle stocks F&B', d: 'Bons de réception, consommation, inventaire', w: 1 },
    { n: 'Intégration comptabilité', d: 'Export vers logiciel comptable', w: 1 },
    { n: 'Support & formation locale', d: 'Équipe locale, hotline, mises à jour', w: 1 }
  ]},
  industrie: { label: 'Industrie & production', icon: '⚙️', ex: 'GMAO, MES, CFAO…', criteria: [
    { n: 'Gestion des nomenclatures (BOM)', d: 'Arborescences, composants, versions', w: 2 },
    { n: 'Gammes de fabrication', d: 'Opérations, centres de charge, temps unitaires', w: 2 },
    { n: 'Planification production (MRP/MRP2)', d: 'Calcul besoins, ordres de fabrication', w: 2 },
    { n: 'Gestion stocks & approvisionnements', d: 'Stocks matières, en-cours, produits finis', w: 2 },
    { n: 'Contrôle qualité', d: 'Contrôles réception, en-cours, produits finis', w: 2 },
    { n: 'GMAO', d: 'Maintenance préventive/curative, équipements', w: 1 },
    { n: 'Traçabilité & lots / numéros de série', d: 'Suivi lot, rappel produit', w: 2 },
    { n: 'Coûts de revient', d: 'Calcul coût standard, analyse écarts', w: 1 },
    { n: 'Reporting production (TRS, rebuts)', d: 'Indicateurs de performance industrielle', w: 1 },
    { n: 'Intégration ERP / comptabilité', d: 'Flux financiers liés à la production', w: 1 },
    { n: 'Références & support Maroc', d: 'Clients marocains de référence, équipe locale', w: 1 }
  ]},
  agro: { label: 'Agro-alimentaire', icon: '🌿', ex: 'Traçabilité, qualité, HACCP…', criteria: [
    { n: 'Traçabilité des matières premières', d: 'Origine, lot, date réception, fournisseur', w: 2 },
    { n: 'Gestion des recettes & formulations', d: 'Compositions, variantes, rendements théoriques', w: 2 },
    { n: 'Contrôle qualité & HACCP', d: 'Points CCP, non-conformités, actions correctives', w: 2 },
    { n: 'Gestion DLC / DLUO', d: 'Alertes péremption, FIFO/FEFO automatique', w: 2 },
    { n: 'Production & ordres de fabrication', d: 'Planification, suivi en-cours, rendements réels', w: 2 },
    { n: 'Traçabilité descendante (rappel produit)', d: 'Identification lot → clients livrés', w: 2 },
    { n: 'Gestion stocks (matières & PF)', d: 'Multi-dépôts, températures, conditionnements', w: 1 },
    { n: 'Pesée & contrôles en ligne', d: 'Interface balance, enregistrement temps réel', w: 1 },
    { n: 'Certifications (ISO 22000, BRC, IFS…)', d: 'Gestion documentaire liée aux certifications', w: 1 },
    { n: 'Conformité ONSSA & reporting réglementaire', d: 'Dossiers ONSSA, exports réglementaires', w: 2 },
    { n: 'Support & références Maroc', d: 'Conformité ONSSA, clients agro marocains', w: 1 }
  ]},
  textile: { label: 'Textile & cuir', icon: '🧵', ex: 'PLM, collection, gammes…', criteria: [
    { n: 'Gestion collections & saisons', d: 'Articles, coloris, tailles, variantes', w: 2 },
    { n: "Bureau d'études & développement produit", d: 'Fiches techniques, nomenclatures, prototypes', w: 2 },
    { n: 'Calcul des coûts (CMT, FOB)', d: "Matières, main d'œuvre, sous-traitance", w: 2 },
    { n: 'Planification de production', d: 'Chaînes de confection, postes, capacités', w: 2 },
    { n: 'Gestion commandes clients & EDI', d: 'Import ordres, confirmations, livraisons', w: 2 },
    { n: 'Approvisionnement matières', d: 'Besoins matières, délais fournisseurs', w: 1 },
    { n: 'Contrôle qualité', d: 'Contrôles coupe, confection, finition', w: 2 },
    { n: 'Traçabilité lots', d: 'Coupe par lots, suivi commande client', w: 1 },
    { n: 'Reporting & indicateurs', d: 'Efficience chaîne, rendement, retards', w: 1 },
    { n: 'Export & régimes douaniers (AT, PAI)', d: 'Documents export, douane marocaine', w: 1 },
    { n: 'Références secteur textile marocain', d: 'Clients référence dans le secteur', w: 1 }
  ]},
  btp: { label: 'BTP & construction', icon: '🏗️', ex: 'Chantier, devis, planning…', criteria: [
    { n: 'Devis & estimatifs', d: "Bibliothèques de prix, devis par corps d'état", w: 2 },
    { n: "Appels d'offres & marchés publics", d: 'Constitution dossiers AO, suivi attribution', w: 2 },
    { n: 'Planification chantier (Gantt)', d: 'Jalons, ressources, chemin critique', w: 2 },
    { n: 'Gestion budgétaire chantier', d: 'Budget vs réalisé, situations travaux', w: 2 },
    { n: 'Situations & facturation', d: 'Situations mensuelles, révisions de prix', w: 2 },
    { n: 'Gestion des sous-traitants', d: 'Contrats, situations, retenues de garantie', w: 1 },
    { n: 'Pointages & équipes chantier', d: 'Heures, équipes, heures supplémentaires', w: 1 },
    { n: 'Stocks matériaux & matériel', d: 'Stocks chantier, bons de sortie, location', w: 1 },
    { n: 'Qualité & HSE', d: 'Fiches incidents, non-conformités, audits', w: 1 },
    { n: 'Reporting rentabilité par chantier', d: 'Avancement global, marges par projet', w: 2 },
    { n: 'Conformité CCAG & TVA BTP Maroc', d: 'Spécificités réglementaires marocaines', w: 1 }
  ]},
  bi: { label: 'BI & reporting', icon: '📊', ex: 'Dashboards, analytics, KPIs…', criteria: [
    { n: 'Connecteurs de données', d: 'ERP, Excel, SQL, API, fichiers plats', w: 2 },
    { n: 'ETL / transformation des données', d: 'Nettoyage, agrégation, jointures visuelles', w: 2 },
    { n: 'Tableaux de bord interactifs', d: 'Filtres, drill-down, partage URL', w: 2 },
    { n: 'KPIs & indicateurs configurables', d: 'Formules, seuils, alertes', w: 2 },
    { n: 'Rapports programmés & distribués', d: 'PDF auto, envoi email planifié', w: 1 },
    { n: 'Analyse prédictive & tendances', d: 'Prévisions, courbes de tendance', w: 1 },
    { n: 'Gestion des droits & périmètres (RLS)', d: 'Accès par entité ou département', w: 1 },
    { n: 'Mobile & responsive', d: 'Dashboards accessibles sur mobile', w: 1 },
    { n: 'Performance & volumétrie', d: 'Millions de lignes, temps de chargement', w: 2 },
    { n: 'Facilité prise en main métier', d: "Pas de code requis pour l'utilisateur", w: 1 },
    { n: 'Support & documentation Maroc', d: 'Équipe Maroc, documentation fr/ar', w: 1 }
  ]}
};

const INT_CRITERIA = [
  { n: 'Niveau de formation', d: 'Bac+2 (1pt), Bac+3/4 (1.5pt), Bac+5 et + (2pts)', w: 2, auto: true, autoKey: 'diplome' },
  { n: 'Expérience générale (années)', d: '< 5 ans (0), 5-10 ans (1), > 10 ans (2)', w: 2, auto: true, autoKey: 'exp' },
  { n: 'Expérience spécifique sur la solution', d: '< 2 ans (0), 2-5 ans (1), > 5 ans (2)', w: 2, auto: true, autoKey: 'expSol' },
  { n: 'Références clients vérifiables au Maroc', d: 'Aucune (0), 1-2 refs (1), 3+ refs vérifiables (2)', w: 2, auto: false },
  { n: 'Expérience sectorielle pertinente', d: 'Hors secteur (0), partielle (1), forte (2)', w: 2, auto: false },
  { n: "Taille & structure de l'équipe", d: '1 personne (0), 2-4 personnes (1), 5+ (2)', w: 1, auto: true, autoKey: 'equipe' },
  { n: 'Certification officielle sur la solution', d: 'Aucune (0), partielle (1), certifié officiel (2)', w: 1, auto: false },
  { n: 'Qualité de la présentation & maîtrise solution', d: 'Évaluation pendant la démo', w: 2, auto: false },
  { n: 'Capacité de support & maintenance', d: 'Délais intervention, équipe dédiée, SLA', w: 1, auto: false }
];

const ACTION_TYPES = {
  formation: {
    label: 'Formation professionnelle', icon: '🎓',
    criteria: [
      { n: 'Pertinence du programme vs besoins PME', d: 'Adéquation contenu / problématiques marocaines', w: 2 },
      { n: 'Qualifications et expérience des formateurs', d: 'Diplôme, expérience terrain, références', w: 2 },
      { n: 'Méthodes pédagogiques', d: 'Présentiel, e-learning, cas pratiques, exercices', w: 1 },
      { n: 'Durée et calendrier', d: 'Nombre heures, rythme, flexibilité', w: 1 },
      { n: 'Support de cours & ressources', d: 'Documentation, supports numériques, accès post-formation', w: 1 },
      { n: 'Évaluation et certification', d: 'Test, attestation officielle, reconnaissance', w: 2 },
      { n: 'Références et témoignages', d: 'Entreprises formées, taux satisfaction, retours terrain', w: 2 },
      { n: 'Capacité logistique', d: "Salles, équipements, capacité d'accueil, online", w: 1 }
    ]
  },
  normalisation: {
    label: 'Normalisation & certification', icon: '📋',
    criteria: [
      { n: 'Norme ou référentiel visé', d: 'ISO, NM, ONSSA, IMANOR — pertinence sectorielle', w: 2 },
      { n: "Compétence de l'organisme certificateur", d: 'Accréditation, reconnaissance internationale', w: 2 },
      { n: "Méthodologie d'accompagnement", d: "Diagnostic, plan d'action, suivi mise en œuvre", w: 2 },
      { n: 'Expérience sectorielle au Maroc', d: 'Certifications similaires réalisées, références clients', w: 2 },
      { n: 'Délais et planning', d: 'Durée accompagnement, jalons, réalisme calendrier', w: 1 },
      { n: 'Coût et rapport qualité/prix', d: 'Tarif vs prestations, financement possible', w: 1 },
      { n: 'Maintenance post-certification', d: 'Audits de suivi, renouvellement, veille normative', w: 1 }
    ]
  },
  productivite: {
    label: 'Productivité & organisation', icon: '⚡',
    criteria: [
      { n: 'Diagnostic organisationnel', d: 'Analyse AS-IS, identification gisements de productivité', w: 2 },
      { n: 'Méthodologie (Lean, 5S, Kaizen…)', d: 'Approche structurée, adaptée au contexte PME', w: 2 },
      { n: 'Expertise du consultant', d: 'Expérience industrie/services, certifications', w: 2 },
      { n: "Plan d'action chiffré", d: 'Gains attendus mesurables, KPIs, ROI estimé', w: 2 },
      { n: 'Accompagnement au changement', d: 'Formation équipes, gestion résistances', w: 1 },
      { n: 'Références Maroc', d: 'Missions similaires réalisées, gains documentés', w: 2 },
      { n: 'Suivi et mesure des résultats', d: 'Reporting régulier, ajustements, bilan final', w: 1 }
    ]
  },
  numerique: {
    label: 'Transformation numérique', icon: '🌐',
    criteria: [
      { n: 'Diagnostic maturité numérique', d: 'Évaluation état actuel, feuille de route', w: 2 },
      { n: 'Stratégie et vision', d: 'Cohérence plan numérique avec ambitions PME', w: 2 },
      { n: 'Compétences techniques', d: 'Maîtrise outils, cloud, IA, cybersécurité', w: 2 },
      { n: 'Conduite du changement', d: 'Formation, acculturation digitale, communication', w: 1 },
      { n: 'Références transformation réussies', d: 'Cas clients PME, résultats mesurés', w: 2 },
      { n: 'Écosystème partenaires', d: 'Réseau fournisseurs solutions, intégration locale', w: 1 },
      { n: 'Plan de financement', d: 'Aides disponibles, phasage investissement', w: 1 }
    ]
  }
};

const BASE_AMI_TEXT = `APPEL À MANIFESTATION D'INTÉRÊT

Cadre du référencement :
Le référencement vise à constituer une liste de prestataires qualifiés (intégrateurs SI, consultants, formateurs)
aptes à accompagner les PME dans leur transformation digitale et organisationnelle.

Critères généraux d'éligibilité :
- Être une personne morale ou physique
- Justifier d'au moins 3 ans d'existence ou d'expérience prouvée
- Disposer de références vérifiables

Profils recherchés :
1. Éditeur / Intégrateur SI national : société développant et/ou intégrant une solution informatique
2. Éditeur / Intégrateur SI international : société étrangère avec représentation locale
3. Consultant national : expert indépendant ou cabinet conseil
4. Consultant international : expert étranger avec missions prouvées

Documents requis par intervenant :
- CV détaillé selon le canevas officiel
- Copies diplômes certifiées conformes
- Attestations de référence clients (minimum 2 sur 5 dernières années)
- Certificats de formation ou partenariat éditeur (si applicable)

Grille d'évaluation :
La commission évalue chaque dossier sur deux volets :
1. Volet Solution (60% du score global) — fonctionnalités, support
2. Volet Intégrateur/Consultant (40% du score global) — profil, expérience, références

Seuils de référencement :
- Référencé : score global ≥ 60% ET solution ≥ 60% ET intégrateur ≥ 55%
- Référencé conditionnel : score global ≥ 48%
- Rejeté : score global < 48%`;

async function main() {
  console.log('🌱 Seeding database...');

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const gestEmail = process.env.GESTIONNAIRE_EMAIL;
  const gestPassword = process.env.GESTIONNAIRE_PASSWORD;
  const partEmail = process.env.PARTICIPANT_EMAIL;
  const partPassword = process.env.PARTICIPANT_PASSWORD;

  if (!adminEmail || !adminPassword || !gestEmail || !gestPassword || !partEmail || !partPassword) {
    throw new Error('Variables manquantes : ADMIN_EMAIL, ADMIN_PASSWORD, GESTIONNAIRE_EMAIL, GESTIONNAIRE_PASSWORD, PARTICIPANT_EMAIL, PARTICIPANT_PASSWORD sont requises dans .env');
  }

  // Admin user
  const adminHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      name: 'Administrateur Système',
      role: 'ADMIN'
    }
  });
  console.log(`✓ Admin: ${admin.email}`);

  // Gestionnaire exemple
  const gestHash = await bcrypt.hash(gestPassword, 12);
  await prisma.user.upsert({
    where: { email: gestEmail },
    update: {},
    create: {
      email: gestEmail,
      passwordHash: gestHash,
      name: 'Gestionnaire Référencement',
      role: 'GESTIONNAIRE'
    }
  });

  // Participant exemple
  const partHash = await bcrypt.hash(partPassword, 12);
  await prisma.user.upsert({
    where: { email: partEmail },
    update: {},
    create: {
      email: partEmail,
      passwordHash: partHash,
      name: 'Membre Commission',
      role: 'PARTICIPANT'
    }
  });

  // Programmes
  const programs = [
    { code: 'GO_SIYAHA_V04', name: 'GO SIYAHA', version: 'V04' },
    { code: 'POWER_EXPORT_V01', name: 'POWER EXPORT', version: 'V01' },
    { code: 'SUPPLY_CHAIN_V01', name: 'SUPPLY CHAIN', version: 'V01' },
    { code: 'PACTE_TPME_V01', name: 'PACTE TPME', version: 'V01' }
  ];

  for (const prog of programs) {
    await prisma.program.upsert({
      where: { code: prog.code },
      update: { name: prog.name, version: prog.version },
      create: {
        code: prog.code,
        name: prog.name,
        version: prog.version,
        amiText: BASE_AMI_TEXT,
        cvTemplate: `CANEVAS CV OFFICIEL ${prog.name} ${prog.version}\n\n1. IDENTITÉ\nNom et prénom :\nDate de naissance :\nNationalité :\nContact :\n\n2. FORMATION\n(Diplôme, Établissement, Année, Mention)\n\n3. EXPÉRIENCES PROFESSIONNELLES\n3.1 En tant que consultant/prestataire\n(Période — Société — Mission — Solution — Modules)\n\n3.2 En tant que salarié\n(Période — Société — Poste — Responsabilités)\n\n4. CERTIFICATIONS & FORMATIONS CONTINUES\n\n5. LANGUES\n\n6. RÉFÉRENCES DISPONIBLES\n\nJe soussigné certifie sur l'honneur l'exactitude des informations ci-dessus.\nSignature :`,
        categories: CATEGORIES,
        intCriteria: INT_CRITERIA,
        actionTypes: ACTION_TYPES
      }
    });
    console.log(`✓ Programme: ${prog.code}`);
  }

  // Config par défaut
  const defaultConfigs = [
    { key: 'jira_url', value: '' },
    { key: 'jira_project', value: 'REF' },
    { key: 'jira_auth', value: 'pat' },
    { key: 'jira_pat', value: '' },
    { key: 'jira_user', value: '' },
    { key: 'jira_pass', value: '' },
    { key: 'jira_cf_score_sol', value: '' },
    { key: 'jira_cf_score_int', value: '' },
    { key: 'ai_key', value: '' },
    { key: 'ai_model', value: 'anthropic/claude-sonnet-4-6' },
    { key: 'ai_temp', value: '0.3' },
    { key: 'ai_lang', value: 'fr' }
  ];

  for (const cfg of defaultConfigs) {
    await prisma.appConfig.upsert({
      where: { key: cfg.key },
      update: {},
      create: cfg
    });
  }

  console.log('✓ Config par défaut créée');
  console.log('\n✅ Seed terminé !');
  console.log('Comptes créés :');
  console.log(`  ${adminEmail}  [ADMIN]`);
  console.log(`  ${gestEmail}  [GESTIONNAIRE]`);
  console.log(`  ${partEmail}  [PARTICIPANT]`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
