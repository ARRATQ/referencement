-- Backfill intCriteria vide avec la grille consultant générique
UPDATE "Program" SET "intCriteria" = '[
  {"n":"Niveau de formation","d":"Bac+2 (1pt), Bac+3/4 (1.5pt), Bac+5 et + (2pts)","w":2,"auto":true,"autoKey":"diplome"},
  {"n":"Expérience générale (années)","d":"< 5 ans (0), 5-10 ans (1), > 10 ans (2)","w":2,"auto":true,"autoKey":"exp"},
  {"n":"Expérience spécifique dans le domaine","d":"< 2 ans (0), 2-5 ans (1), > 5 ans (2)","w":2,"auto":true,"autoKey":"expSol"},
  {"n":"Références clients vérifiables au Maroc","d":"Aucune (0), 1-2 refs (1), 3+ refs vérifiables (2)","w":2,"auto":false},
  {"n":"Expérience sectorielle pertinente","d":"Hors secteur (0), partielle (1), forte (2)","w":2,"auto":false},
  {"n":"Taille & structure de l équipe","d":"1 personne (0), 2-4 personnes (1), 5+ (2)","w":1,"auto":true,"autoKey":"equipe"},
  {"n":"Certification ou accréditation officielle","d":"Aucune (0), partielle (1), certifié/accrédité officiel (2)","w":1,"auto":false},
  {"n":"Qualité de la présentation & maîtrise de la prestation","d":"Évaluation pendant la séance de présentation","w":2,"auto":false},
  {"n":"Capacité de suivi & accompagnement","d":"Disponibilité, réactivité, engagement post-prestation","w":1,"auto":false}
]'::jsonb
WHERE "intCriteria" = '[]'::jsonb;
