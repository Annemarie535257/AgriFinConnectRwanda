import Header from '../components/Header';
import Footer from '../components/Footer';
import BackToTop from '../components/BackToTop';
import FloatingChatbot from '../components/FloatingChatbot';
import { useLanguage } from '../context/LanguageContext';
import '../App.css';
import './LegalPage.css';

const LEGAL_CONTENT = {
  en: {
    eyebrow: 'Legal',
    title: 'End-User Licence Agreement (EULA) & Privacy Policy',
    brand: 'AgriFinConnect Rwanda',
    lead: 'This page explains how you can use the platform, how your data is handled, and your rights as a user. By using AgriFinConnect Rwanda, you agree to these terms.',
    updated: 'Last updated: March 2026',
    eulaTitle: 'End-User Licence Agreement (EULA)',
    eulaIntro: 'This agreement defines acceptable use, user responsibilities, and legal boundaries for the platform.',
    privacyTitle: 'Privacy Policy',
    privacyIntro: 'AgriFinConnect Rwanda is committed to protecting personal data and ensuring responsible, transparent, and secure information handling.',
    usesLabel: 'Uses:',
    purposeLabel: 'Purpose:',
    modelAdvisory: 'Important: all model outputs are advisory only, and final lending decisions are made by authorized human financial officers.',
    eulaSections: [
      {
        id: 'acceptance',
        title: '1. Acceptance of Terms',
        paragraph: 'By accessing or using AgriFinConnect Rwanda, you confirm that you have read and accepted this agreement. Continued use after updates means you accept lawfully published changes.'
      },
      {
        id: 'eligibility',
        title: '2. Eligibility and Lawful Use',
        paragraph: 'The platform must be used only for lawful agricultural and financial purposes. Fraud, impersonation, unauthorized access, and misuse are prohibited.'
      },
      {
        id: 'permitted',
        title: '3. Permitted Use of the Platform',
        paragraph: 'Platform access is role-based to keep workflows secure and auditable.',
        bullets: [
          'Submit and manage loan applications',
          'Track application status and receive updates',
          'Access financial insights and recommendations',
          'Use chatbot assistance for guidance and support'
        ]
      },
      {
        id: 'security',
        title: '4. Account Security',
        paragraph: 'You are responsible for securing your credentials and account access.',
        bullets: [
          'Protect your password and login details',
          'Do not share your account with others',
          'Report suspicious activity immediately'
        ]
      },
      {
        id: 'ai',
        title: '5. AI Decision Disclaimer',
        paragraph: 'AgriFinConnect uses ML models to support consistent review. Models do not replace human judgment or legal compliance checks.',
        bullets: [
          'Loan eligibility prediction',
          'Credit risk assessment',
          'Loan amount recommendation',
          'Fraud detection',
          'Chatbot assistance'
        ],
        note: 'All outputs are advisory only. Final decisions are made by authorized human officers.'
      },
      {
        id: 'accuracy',
        title: '6. Data Accuracy Responsibility',
        paragraph: 'Incomplete or incorrect information can reduce prediction quality and cause delays or rejection.',
        bullets: [
          'Provide complete and truthful information',
          'Incorrect data can lead to delays, inaccurate results, or rejection'
        ]
      },
      {
        id: 'availability',
        title: '7. Service Availability',
        paragraph: 'Service may be temporarily unavailable due to maintenance, updates, or security actions.'
      },
      {
        id: 'liability',
        title: '8. Limitation of Liability',
        paragraph: 'The platform is provided as-is. To the extent allowed by law, we are not liable for indirect losses.'
      },
      {
        id: 'termination',
        title: '9. Suspension or Termination',
        paragraph: 'Accounts may be restricted or terminated for policy violations, fraud, or system abuse.'
      },
      {
        id: 'law',
        title: '10. Governing Law',
        paragraph: 'These terms are governed by the laws of the Republic of Rwanda.'
      }
    ],
    modelSections: [
      {
        id: 'eligibility-model',
        title: 'Loan Eligibility Prediction Model',
        uses: ['Age, income, employment status', 'Education level, loan purpose, credit history'],
        purpose: 'Estimates whether baseline eligibility conditions are likely to be satisfied.'
      },
      {
        id: 'risk-model',
        title: 'Credit Risk Assessment Model',
        uses: ['Credit score', 'Debt-to-income indicators', 'Payment history, defaults, bankruptcy indicators', 'Credit history length, open lines, inquiries'],
        purpose: 'Generates a risk score to support officer review and risk mitigation.'
      },
      {
        id: 'recommendation-model',
        title: 'Loan Amount Recommendation Model',
        uses: ['Income (normalized from submitted values)', 'Savings/checking balance indicators', 'Assets, liabilities, net worth indicators', 'Loan duration and debt burden features'],
        purpose: 'Suggests an affordability-aligned amount range for officer consideration.'
      },
      {
        id: 'fraud-model',
        title: 'Fraud Detection Model',
        uses: ['Transaction amount, duration, account balance', 'Login attempts and time-based features', 'Transaction type/channel patterns', 'Statement-extracted rows from uploaded PDF bank statements'],
        purpose: 'Flags suspicious behavior patterns for additional human verification.'
      },
      {
        id: 'chatbot-model',
        title: 'Chatbot Model',
        uses: ['User queries', 'Selected language (en/fr/rw)', 'Loan-related intents'],
        purpose: 'Provides multilingual guidance and support, not binding legal or credit decisions.'
      }
    ],
    privacySections: [
      {
        id: 'collect',
        title: '1. Data We Collect',
        paragraph: 'We collect data required for loan processing, account protection, fraud control, compliance, and support.',
        subsections: [
          {
            title: 'Account and Profile Information',
            bullets: [
              'Email, account role, secure password credential handling',
              'Profile fields: full name, location, phone, cooperative, gender, blood group, about text',
              'Profile photo file, metadata, and stored image content'
            ]
          },
          {
            title: 'Loan, Financial, and Farming Application Data',
            bullets: [
              'Age, annual income, credit score, requested amount, duration, employment, education, marital status, loan purpose',
              'Farming context: crops/activity, land size, season, yield, livestock, notes, farm record summaries/counts',
              'Workflow records: status history, review notes, decisions, repayment schedules'
            ]
          },
          {
            title: 'KYC and Supporting Documents Uploaded',
            bullets: [
              'National ID or passport',
              'Proof of income / bank statements',
              'Land certificate / proof of land ownership',
              'Marital status certificate',
              'Recommendation letter',
              'Proof of address',
              'Spouse ID (when applicable)'
            ]
          },
          {
            title: 'Communication, Activity, and Technical Data',
            bullets: [
              'Chat interaction logs: message, reply, language, timestamp',
              'Farmer-MFI application messages',
              'Onboarding activity logs: event type, role, IP address, user agent, timestamp',
              'Password reset token lifecycle records'
            ]
          },
          {
            title: 'Browser-Local Draft Data',
            bullets: [
              'Language preference and legal acknowledgement flags',
              'Session convenience data like local user object/token',
              'Farmer dashboard draft farm records stored locally by browser'
            ]
          }
        ]
      },
      {
        id: 'use',
        title: '2. How Your Data Is Used',
        paragraph: 'Data is used for lawful, specific, and transparent operational purposes.',
        bullets: [
          'Authentication and account security',
          'Loan processing and document verification',
          'Eligibility, risk, recommendation, and fraud-support analysis',
          'Security monitoring and abuse prevention',
          'Support communication and multilingual chatbot responses',
          'System and model quality improvement under controlled governance'
        ]
      },
      {
        id: 'models',
        title: '3. How Each Model Uses Your Data',
        paragraph: 'Each model uses different fields according to its function. Outputs are reviewed with human oversight before final actions.'
      },
      {
        id: 'basis',
        title: '4. Legal Basis for Processing Data',
        paragraph: 'Processing is based on recognized legal grounds.',
        bullets: ['Consent', 'Contractual necessity', 'Legal obligations', 'Legitimate interests']
      },
      {
        id: 'sharing',
        title: '5. Data Sharing',
        paragraph: 'Data sharing is restricted to necessity and legal duty.',
        bullets: [
          'Authorized internal users and participating financial officers only',
          'Internal processing of applications and compliance workflows',
          'Lawful disclosure to competent authorities when required',
          'No sale of personal data to third parties'
        ]
      },
      {
        id: 'retention',
        title: '6. Data Retention',
        paragraph: 'Data is retained only for required operational, legal, audit, and dispute-management periods, then deleted or anonymized.'
      },
      {
        id: 'safeguards',
        title: '7. Security Safeguards',
        paragraph: 'Security controls are applied across identity, infrastructure, files, and monitoring layers.',
        bullets: [
          'Secure authentication and token controls',
          'Role-based access controls',
          'Encryption in transit and controlled storage access',
          'Continuous monitoring and incident response practices'
        ]
      },
      {
        id: 'cross-border',
        title: '8. Cross-Border Processing',
        paragraph: 'Some processing may occur outside Rwanda under contractual and technical safeguards.'
      },
      {
        id: 'rights',
        title: '9. Your Rights',
        paragraph: 'You may request data actions subject to identity verification and applicable legal limits.',
        bullets: ['Access', 'Correction', 'Deletion', 'Restriction/objection', 'Portability']
      },
      {
        id: 'cookies',
        title: '10. Cookies and Local Storage',
        paragraph: 'Essential browser storage supports login continuity, language settings, and user experience stability.'
      },
      {
        id: 'children',
        title: '11. Children\'s Privacy and Age Restrictions',
        paragraph: 'The platform is intended for adult users in lending workflows.',
        bullets: [
          'Minimum intended lending-user age is 18 years',
          'Underage accounts may be suspended',
          'Underage data may be deleted/anonymized unless legally retained'
        ]
      },
      {
        id: 'deletion',
        title: '12. Account Deletion and What Happens to Your Data',
        paragraph: 'Account deletion disables sign-in, removes/anonymizes profile data, and retains legally required records in restricted storage until retention obligations expire.'
      },
      {
        id: 'laws',
        title: '13. Applicable Laws and Regulatory Commitments',
        paragraph: 'Privacy operations follow applicable legal and regulatory frameworks.',
        bullets: [
          'Rwanda Law No. 058/2021 on personal data and privacy protection',
          'Constitutional privacy principles under laws of Rwanda',
          'Financial-sector audit/compliance obligations for lending workflows',
          'Applicable international principles, including GDPR-style principles where relevant',
          'Children privacy protections where applicable'
        ]
      },
      {
        id: 'contact',
        title: '14. Contact and Complaints',
        paragraph: 'For privacy questions, concerns, or complaints, contact official support channels.',
        bullets: ['Email: support@agrifinconnect.rw', 'Phone: +250 788 000 123', 'Customer Support Line: +250 722 456 789']
      }
    ]
  },
  fr: {
    eyebrow: 'Juridique',
    title: 'Contrat de Licence Utilisateur (EULA) et Politique de Confidentialite',
    brand: 'AgriFinConnect Rwanda',
    lead: 'Cette page explique les regles d utilisation de la plateforme, la gestion de vos donnees et vos droits. En utilisant AgriFinConnect Rwanda, vous acceptez ces conditions.',
    updated: 'Derniere mise a jour: Mars 2026',
    eulaTitle: 'Contrat de Licence Utilisateur (EULA)',
    eulaIntro: 'Cet accord definit les conditions d utilisation, les responsabilites des utilisateurs et le cadre juridique de la plateforme.',
    privacyTitle: 'Politique de Confidentialite',
    privacyIntro: 'AgriFinConnect Rwanda protege les donnees personnelles et applique un traitement responsable, transparent et securise.',
    usesLabel: 'Utilise:',
    purposeLabel: 'Objectif:',
    modelAdvisory: 'Important: les resultats des modeles sont indicatifs. Les decisions finales de credit sont prises par des agents humains autorises.',
    eulaSections: [
      { id: 'acceptance', title: '1. Acceptation des Conditions', paragraph: 'En accedant a la plateforme, vous confirmez accepter cet accord. L utilisation continue apres mise a jour implique acceptation des modifications legalement publiees.' },
      { id: 'eligibility', title: '2. Eligibilite et Usage Legal', paragraph: 'La plateforme doit etre utilisee uniquement pour des activites agricoles et financieres legitimes. La fraude, l usurpation et l acces non autorise sont interdits.' },
      { id: 'permitted', title: '3. Usage Autorise de la Plateforme', paragraph: 'Les droits d acces dependent du role afin de garantir un flux de travail securise et tracable.', bullets: ['Soumettre et gerer des demandes de pret', 'Suivre le statut des demandes', 'Acceder aux analyses financieres', 'Utiliser le chatbot pour assistance'] },
      { id: 'security', title: '4. Securite du Compte', paragraph: 'Vous etes responsable de la securite de vos identifiants.', bullets: ['Proteger mot de passe et acces', 'Ne pas partager le compte', 'Signaler rapidement toute activite suspecte'] },
      { id: 'ai', title: '5. Clause de Non-Automatisation des Decisions', paragraph: 'Les modeles IA/ML assistent la coherence d evaluation mais ne remplacent pas le jugement humain ni les controles juridiques.', bullets: ['Prediction d eligibilite', 'Evaluation du risque', 'Recommandation de montant', 'Detection de fraude', 'Assistance chatbot'], note: 'Les resultats sont indicatifs; la decision finale reste humaine.' },
      { id: 'accuracy', title: '6. Responsabilite sur l Exactitude des Donnees', paragraph: 'Des informations inexactes peuvent entrainer retards, erreurs de prediction ou rejet.' },
      { id: 'availability', title: '7. Disponibilite du Service', paragraph: 'Le service peut etre temporairement indisponible pour maintenance, mise a jour ou securite.' },
      { id: 'liability', title: '8. Limitation de Responsabilite', paragraph: 'La plateforme est fournie en l etat. Dans les limites de la loi, nous ne sommes pas responsables des pertes indirectes.' },
      { id: 'termination', title: '9. Suspension ou Resiliation', paragraph: 'Les comptes peuvent etre suspendus ou resilies en cas de violation des regles, fraude ou usage abusif.' },
      { id: 'law', title: '10. Droit Applicable', paragraph: 'Ces conditions sont regies par les lois de la Republique du Rwanda.' }
    ],
    modelSections: [
      { id: 'eligibility-model', title: 'Modele de Prediction d Eligibilite', uses: ['Age, revenu, statut professionnel', 'Niveau d education, objet du pret, historique de credit'], purpose: 'Estimer si les conditions minimales d eligibilite sont probablement satisfaites.' },
      { id: 'risk-model', title: 'Modele d Evaluation du Risque', uses: ['Score de credit', 'Indicateurs dette/revenu', 'Historique de paiement, defauts, faillite', 'Anciennete du credit, lignes ouvertes, demandes'], purpose: 'Produire un score de risque pour appuyer la revue des agents.' },
      { id: 'recommendation-model', title: 'Modele de Recommandation du Montant', uses: ['Revenus normalises', 'Indicateurs epargne/compte courant', 'Actifs, passifs, patrimoine net', 'Duree et charge d endettement'], purpose: 'Proposer une fourchette de montant compatible avec la capacite financiere.' },
      { id: 'fraud-model', title: 'Modele de Detection de Fraude', uses: ['Montant, duree, solde de compte', 'Tentatives de connexion et horaires', 'Type/canal de transaction', 'Lignes extraites des releves bancaires PDF'], purpose: 'Signaler les comportements suspects pour verification humaine.' },
      { id: 'chatbot-model', title: 'Modele Chatbot', uses: ['Questions utilisateur', 'Langue choisie (en/fr/rw)', 'Intentions liees au pret'], purpose: 'Fournir une assistance multilingue, sans valeur de decision de credit.' }
    ],
    privacySections: [
      { id: 'collect', title: '1. Donnees Collectees', paragraph: 'Nous collectons les donnees necessaires au traitement des prets, a la securite, a la lutte contre la fraude et a la conformite.', subsections: [
        { title: 'Compte et Profil', bullets: ['Email, role de compte, gestion securisee du mot de passe', 'Nom complet, localisation, telephone, cooperative, genre, groupe sanguin, bio', 'Photo de profil, metadonnees et contenu image'] },
        { title: 'Donnees de Pret, Finance et Agriculture', bullets: ['Age, revenu annuel, score de credit, montant demande, duree, emploi, education, statut marital, objet', 'Contexte agricole: activite, surface, saison, rendement, elevage, notes', 'Historique de traitement: statuts, notes de revue, decisions, remboursements'] },
        { title: 'Documents KYC et Justificatifs', bullets: ['Carte d identite ou passeport', 'Preuve de revenu / releves bancaires', 'Certificat foncier', 'Certificat d etat civil', 'Lettre de recommandation', 'Preuve d adresse', 'ID du conjoint si applicable'] },
        { title: 'Communication, Activite et Donnees Techniques', bullets: ['Journaux chatbot: message, reponse, langue, date', 'Messages entre agriculteur et institution', 'Journaux activite onboarding: type d evenement, role, IP, user-agent, date', 'Cycle des jetons de reinitialisation mot de passe'] },
        { title: 'Donnees Locales Navigateur', bullets: ['Preference de langue et acceptation legale', 'Objets/session locaux de confort utilisateur', 'Brouillons de donnees agricoles stockes localement'] }
      ] },
      { id: 'use', title: '2. Utilisation de Vos Donnees', paragraph: 'Les donnees sont traitees pour des finalites legales, precises et transparentes.', bullets: ['Authentification et securite des comptes', 'Traitement des demandes et verification documentaire', 'Analyse eligibilite/risque/recommandation/fraude', 'Surveillance securite et prevention des abus', 'Support utilisateur et chatbot multilingue', 'Amelioration des systemes et modeles sous gouvernance controlee'] },
      { id: 'models', title: '3. Utilisation des Donnees par Modele', paragraph: 'Chaque modele consomme des variables adaptees a sa fonction. Les sorties sont revues avec supervision humaine.' },
      { id: 'basis', title: '4. Base Legale du Traitement', paragraph: 'Le traitement repose sur des bases legales reconnues.', bullets: ['Consentement', 'Necessite contractuelle', 'Obligations legales', 'Interets legitimes'] },
      { id: 'sharing', title: '5. Partage des Donnees', paragraph: 'Le partage est limite a la necessite operationnelle et aux obligations legales.', bullets: ['Acces reserve aux utilisateurs autorises', 'Usage interne pour traitement de dossiers', 'Divulgation aux autorites competentes si requise', 'Aucune vente de donnees personnelles'] },
      { id: 'retention', title: '6. Conservation des Donnees', paragraph: 'Les donnees sont conservees uniquement pendant les periodes operationnelles et legales requises, puis supprimees ou anonymisees.' },
      { id: 'safeguards', title: '7. Mesures de Securite', paragraph: 'Des controles de securite sont appliques a tous les niveaux techniques et operationnels.', bullets: ['Authentification securisee', 'Controle d acces par role', 'Chiffrement en transit et acces stockage controle', 'Surveillance continue et reponse aux incidents'] },
      { id: 'cross-border', title: '8. Traitement Transfrontalier', paragraph: 'Certaines operations peuvent se faire hors Rwanda avec garanties contractuelles et techniques.' },
      { id: 'rights', title: '9. Vos Droits', paragraph: 'Vous pouvez exercer vos droits sous verification d identite et limites legales.', bullets: ['Acces', 'Rectification', 'Suppression', 'Restriction/opposition', 'Portabilite'] },
      { id: 'cookies', title: '10. Cookies et Stockage Local', paragraph: 'Le stockage essentiel du navigateur est utilise pour la continuite de session et la preference de langue.' },
      { id: 'children', title: '11. Confidentialite des Enfants et Limites d Age', paragraph: 'La plateforme est destinee aux adultes pour les workflows de pret.', bullets: ['Age minimum vise: 18 ans', 'Comptes mineurs pouvant etre suspendus', 'Donnees mineurs supprimees/anonymisees sauf retention legale'] },
      { id: 'deletion', title: '12. Suppression de Compte et Sort des Donnees', paragraph: 'La suppression desactive l acces, retire/anonymise les donnees de profil, et conserve les enregistrements legalement obligatoires jusqu a expiration des obligations.' },
      { id: 'laws', title: '13. Lois Applicables et Engagements Reglementaires', paragraph: 'Le dispositif de confidentialite suit les cadres legaux applicables.', bullets: ['Loi rwandaise No 058/2021 sur la protection des donnees personnelles et de la vie privee', 'Principes constitutionnels de vie privee au Rwanda', 'Obligations d audit et de conformite du secteur financier', 'Principes internationaux applicables (ex. principes type GDPR)', 'Protections enfants lorsque applicables'] },
      { id: 'contact', title: '14. Contact et Reclamations', paragraph: 'Pour toute question ou reclamation sur la confidentialite, contactez les canaux officiels.', bullets: ['Email: support@agrifinconnect.rw', 'Telephone: +250 788 000 123', 'Ligne support: +250 722 456 789'] }
    ]
  },
  rw: {
    eyebrow: 'Amategeko',
    title: 'Amasezerano y Ikoreshwa (EULA) na Politiki ya Privacy',
    brand: 'AgriFinConnect Rwanda',
    lead: 'Iyi paji isobanura uko ukoresha urubuga, uko amakuru yawe acungwa, n uburenganzira bwawe. Gukoresha AgriFinConnect Rwanda bivuze ko wemeye aya mabwiriza.',
    updated: 'Byavuguruwe bwa nyuma: Werurwe 2026',
    eulaTitle: 'Amasezerano y Ikoreshwa (EULA)',
    eulaIntro: 'Aya masezerano asobanura uko urubuga rugomba gukoreshwa, inshingano z umukoresha, n imipaka y amategeko.',
    privacyTitle: 'Politiki ya Privacy',
    privacyIntro: 'AgriFinConnect Rwanda yiyemeje kurinda amakuru bwite no kuyacunga mu mucyo no mu mutekano.',
    usesLabel: 'Ikoresha:',
    purposeLabel: 'Intego:',
    modelAdvisory: 'Icyitonderwa: ibisubizo by imodeli ni ubufasha gusa. Icyemezo cya nyuma cy inguzanyo gifatwa n abakozi babifitiye ububasha.',
    eulaSections: [
      { id: 'acceptance', title: '1. Kwemera Amabwiriza', paragraph: 'Iyo winjiye cyangwa ukoresheje urubuga, uba wemeye aya mabwiriza. Gukomeza gukoresha nyuma y ivugururwa ryatangajwe mu buryo bwemewe nabyo ni ukwemera.' },
      { id: 'eligibility', title: '2. Kwemererwa no Gukoresha mu Mategeko', paragraph: 'Urubuga rugenewe ibikorwa by ubuhinzi n imari byemewe. Uburiganya, kwiyitirira abandi, cyangwa kwinjira mu buryo butemewe birabujijwe.' },
      { id: 'permitted', title: '3. Ikoreshwa Ryemewe ry Urubuga', paragraph: 'Uburenganzira bwo gukoresha bushingiye ku ruhare kugira ngo umutekano n igenzura byuzuye.', bullets: ['Gutanga no gucunga ubusabe bw inguzanyo', 'Gukurikirana aho ubusabe bugeze', 'Kubona isesengura ry imari', 'Gukoresha chatbot ku bufasha'] },
      { id: 'security', title: '4. Umutekano wa Konti', paragraph: 'Ufite inshingano zo kurinda amakuru ya konti yawe.', bullets: ['Rinda ijambobanga n amakuru yo kwinjira', 'Ntukagabane konti yawe', 'Menyesha vuba ibikorwa bikekwa'] },
      { id: 'ai', title: '5. Icyitonderwa ku Byemezo bya AI', paragraph: 'Imodeli za AI/ML zifasha isuzuma, ariko ntizisimbura umukozi w umuntu cyangwa amategeko y isuzuma.', bullets: ['Isuzuma rya eligibility', 'Isuzuma ry ibyago', 'Icyifuzo cy umubare w inguzanyo', 'Kumenya uburiganya', 'Ubufasha bwa chatbot'], note: 'Ibyavuye mu modeli ni ubufasha; icyemezo cya nyuma ni icy umuntu ubifitiye ububasha.' },
      { id: 'accuracy', title: '6. Inshingano ku Kuri kw Amakuru', paragraph: 'Amakuru atuzuye cyangwa atari yo ashobora gutera gutinda, amakosa y isuzuma, cyangwa kwangwa.' },
      { id: 'availability', title: '7. Kuboneka kwa Serivisi', paragraph: 'Serivisi ishobora guhagarara byigihe gito kubera maintenance, update, cyangwa umutekano.' },
      { id: 'liability', title: '8. Imipaka y Uburyozwe', paragraph: 'Urubuga rutangwa uko ruri. Aho amategeko abyemera, ntituryozwa ibihombo bitaziguye.' },
      { id: 'termination', title: '9. Guhagarika cyangwa Gufunga Konti', paragraph: 'Konti ishobora guhagarikwa cyangwa gufungwa mu gihe habonetse kurenga ku mabwiriza, uburiganya, cyangwa gukoresha nabi sisitemu.' },
      { id: 'law', title: '10. Amategeko Akurikizwa', paragraph: 'Aya mabwiriza akurikizwa n amategeko ya Repubulika y u Rwanda.' }
    ],
    modelSections: [
      { id: 'eligibility-model', title: 'Imodeli y Isuzuma rya Eligibility', uses: ['Imyaka, amafaranga yinjira, uko umuntu akora', 'Urwego rw amashuri, impamvu y inguzanyo, amateka ya credit'], purpose: 'Gupima niba ibisabwa by ibanze by inguzanyo byuzuye.' },
      { id: 'risk-model', title: 'Imodeli y Isuzuma ry Ibyago', uses: ['Inota rya credit', 'Ibipimo bya debt to income', 'Amateka yo kwishyura, defaults, bankruptcy', 'Igihe cya credit, open lines, inquiries'], purpose: 'Gutanga risk score ifasha abakozi mu isuzuma rya nyuma.' },
      { id: 'recommendation-model', title: 'Imodeli y Icyifuzo cy Umubare w Inguzanyo', uses: ['Amikoro yahinduwe ku gipimo gikwiye', 'Ibipimo bya savings/checking', 'Assets, liabilities, net worth', 'Igihe cy inguzanyo n umutwaro w imyenda'], purpose: 'Gutanga umurongo ngenderwaho ku mubare ushoboka w inguzanyo.' },
      { id: 'fraud-model', title: 'Imodeli yo Kumenya Uburiganya', uses: ['Transaction amount, duration, account balance', 'Login attempts n ibijyanye n igihe', 'Ubwoko/canal ya transaction', 'Imirongo yakuwemo muri PDF bank statements'], purpose: 'Kwerekana ibikorwa bikekwa kugira ngo hakorwe igenzura ry umuntu.' },
      { id: 'chatbot-model', title: 'Imodeli ya Chatbot', uses: ['Ibibazo by umukoresha', 'Ururimi rwatoranijwe (en/fr/rw)', 'Ibikorwa bifitanye isano n inguzanyo'], purpose: 'Gutanga ubufasha bw indimi nyinshi; si icyemezo cya credit.' }
    ],
    privacySections: [
      { id: 'collect', title: '1. Amakuru Dukusanya', paragraph: 'Dukusanya amakuru akenewe ku gutunganya inguzanyo, umutekano wa konti, kurwanya uburiganya, no kubahiriza amategeko.', subsections: [
        { title: 'Amakuru ya Konti na Profile', bullets: ['Email, role ya konti, uburyo bwumutekano bwo kubika ijambobanga', 'Amazina, aho atuye, telefone, cooperative, gender, blood group, about', 'Ifoto ya profile, metadata, n ibisigazwa by ifoto bibitswe'] },
        { title: 'Amakuru y Inguzanyo, Imari n Ubuhinzi', bullets: ['Imyaka, annual income, credit score, amount yasabwe, duration, employment, education, marital status, loan purpose', 'Amakuru y ubuhinzi: crops/activity, land size, season, yield, livestock, notes', 'Amakuru y inzira y ubusabe: status history, review notes, decisions, repayments'] },
        { title: 'Inyandiko z Identite n Izishyigikira Ubusabe', bullets: ['Indangamuntu cyangwa passport', 'Proof of income / bank statements', 'Land certificate / proof of land ownership', 'Marital status certificate', 'Recommendation letter', 'Proof of address', 'Spouse ID niba bikenewe'] },
        { title: 'Amakuru y Itumanaho, Activity na Technical', bullets: ['Chat logs: message, reply, language, igihe', 'Ubutumwa hagati ya farmer na MFI', 'Activity logs: event type, role, IP address, user agent, igihe', 'Amateka ya password reset token'] },
        { title: 'Amakuru abikwa muri Browser y Umukoresha', bullets: ['Language preference na legal acknowledgement', 'Session data yorohereza umukoresha', 'Farm draft records zibikwa local muri dashboard'] }
      ] },
      { id: 'use', title: '2. Uko Amakuru Yawe Akoreshwa', paragraph: 'Amakuru akoreshwa ku mpamvu zisobanutse, zemewe n amategeko kandi ziboneye.', bullets: ['Authentication n umutekano wa konti', 'Gutunganya ubusabe no kugenzura inyandiko', 'Isesengura rya eligibility/risk/recommendation/fraud', 'Gukurikirana umutekano no gukumira abuse', 'Ubufasha n chatbot mu ndimi nyinshi', 'Kunoza sisitemu n imodeli mu buryo bugenzurwa'] },
      { id: 'models', title: '3. Uko Buri Modeli Ikoresha Amakuru', paragraph: 'Buri modeli ifata amakuru ajyanye n icyo ikora. Ibisubizo byayo bigenzurwa n abantu mbere y icyemezo cya nyuma.' },
      { id: 'basis', title: '4. Impamvu z Amategeko zo Gutunganya Amakuru', paragraph: 'Gutunganya amakuru bishingira ku mpamvu zemewe n amategeko.', bullets: ['Consent', 'Contractual necessity', 'Legal obligations', 'Legitimate interests'] },
      { id: 'sharing', title: '5. Uko Amakuru Asangirwa', paragraph: 'Gusangira amakuru bikorwa gusa iyo bikenewe mu mikorere cyangwa amategeko abitegeka.', bullets: ['Abakozi bemewe gusa ni bo bayabona', 'Asangirwa imbere mu mikorere yo gutunganya ubusabe', 'Ashobora gutangwa ku nzego zibifitiye ububasha iyo bisabwe n amategeko', 'Ntiducuruza amakuru bwite'] },
      { id: 'retention', title: '6. Igihe cyo Kubika Amakuru', paragraph: 'Amakuru abikwa igihe gikenewe ku mikorere, audit, ibibazo by amategeko, hanyuma agasibwe cyangwa agahindurwe adashobora kumenya umuntu.' },
      { id: 'safeguards', title: '7. Ingamba z Umutekano', paragraph: 'Hari ingamba z umutekano ku rwego rwa konti, sisitemu, amadosiye, no gukurikirana ibikorwa.', bullets: ['Secure authentication na token controls', 'Role-based access control', 'Encryption mu kohereza no kugenzura storage access', 'Continuous monitoring n incident response'] },
      { id: 'cross-border', title: '8. Gutunganya Amakuru Hanze y Igihugu', paragraph: 'Hari processing ishobora gukorerwa hanze y u Rwanda ariko hakubahirizwa contractual na technical safeguards.' },
      { id: 'rights', title: '9. Uburenganzira Bwawe', paragraph: 'Ushobora gusaba ibikorwa ku makuru yawe nyuma yo kugenzura umwirondoro no kubahiriza amategeko akurikizwa.', bullets: ['Access', 'Correction', 'Deletion', 'Restriction/objection', 'Portability'] },
      { id: 'cookies', title: '10. Cookies na Local Storage', paragraph: 'Browser storage yingenzi ikoreshwa ku kubika login continuity, language preferences, n user experience stability.' },
      { id: 'children', title: '11. Kurinda Abana n Imyaka Yemerewe', paragraph: 'Urubuga rugenewe abantu bakuru mu bikorwa by inguzanyo.', bullets: ['Imyaka ntarengwa igamijwe: 18', 'Konti zabana zishobora guhagarikwa', 'Amakuru y umwana ashobora gusibwa/anonymized keretse ayagomba kubikwa n amategeko'] },
      { id: 'deletion', title: '12. Gusiba Konti n Icyo Biba ku Makuru', paragraph: 'Gusiba konti bihagarika kwinjira, bigakuraho cyangwa bigahindura profile data, kandi amakuru asabwa n amategeko aguma mu bubiko bugenzuwe kugeza igihe cyo kubika kirangiye.' },
      { id: 'laws', title: '13. Amategeko Akurikizwa n Inshingano za Compliance', paragraph: 'Uburyo bwa privacy bukurikiza amategeko n amabwiriza akurikizwa.', bullets: ['Rwanda Law No. 058/2021 ku kurinda amakuru bwite na privacy', 'Amahame ya constitutional privacy mu Rwanda', 'Audit/compliance obligations z urwego rw imari', 'Amahame mpuzamahanga akurikizwa aho bibereye (nk amahame asa na GDPR)', 'Kurinda abana aho bibereye'] },
      { id: 'contact', title: '14. Uko Watwandikira n Uko Watanga Ikirego', paragraph: 'Ku bibazo bya privacy cyangwa ikirego, twandikire unyuze ku nzira zemewe.', bullets: ['Email: support@agrifinconnect.rw', 'Phone: +250 788 000 123', 'Customer Support Line: +250 722 456 789'] }
    ]
  }
};

function getLocalizedContent(language) {
  return LEGAL_CONTENT[language] || LEGAL_CONTENT.en;
}

export default function LegalPage() {
  const { language, t } = useLanguage();
  const content = getLocalizedContent(language);

  return (
    <div className="app landing-layout">
      <Header />
      <main className="legal-page" aria-label={t('legal.pageAriaLabel')}>
        <section className="legal-page__hero">
          <h1 className="legal-page__title">{content.title}</h1>
          <p className="legal-page__lead">{content.brand}</p>
          <p className="legal-page__section-intro">{content.lead}</p>
          <p className="legal-page__meta">{content.updated}</p>
        </section>

        <section className="legal-page__section" id="eula" aria-labelledby="eula-title">
          <h2 id="eula-title" className="legal-page__section-title">{content.eulaTitle}</h2>
          <p className="legal-page__section-intro">{content.eulaIntro}</p>
          <ol className="legal-page__detailed-list">
            {content.eulaSections.map((section) => (
              <li key={section.id} className="legal-page__detailed-item">
                <h3 className="legal-page__clause-title">{section.title}</h3>
                <p className="legal-page__clause-text">{section.paragraph}</p>
                {Array.isArray(section.bullets) && section.bullets.length > 0 && (
                  <ul className="legal-page__bullet-list">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
                {section.note && <p className="legal-page__note">{section.note}</p>}
              </li>
            ))}
          </ol>
        </section>

        <section className="legal-page__section" id="privacy" aria-labelledby="privacy-title">
          <h2 id="privacy-title" className="legal-page__section-title">{content.privacyTitle}</h2>
          <p className="legal-page__section-intro">{content.privacyIntro}</p>

          <ol className="legal-page__detailed-list">
            {content.privacySections.map((section) => (
              <li key={section.id} id={section.id} className="legal-page__detailed-item">
                <h3 className="legal-page__clause-title">{section.title}</h3>
                <p className="legal-page__clause-text">{section.paragraph}</p>

                {Array.isArray(section.subsections) && section.subsections.map((subsection) => (
                  <div key={subsection.title} className="legal-page__model-card">
                    <h4 className="legal-page__subsection-title">{subsection.title}</h4>
                    <ul className="legal-page__bullet-list">
                      {subsection.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}

                {section.id === 'models' && (
                  <div className="legal-page__model-grid">
                    {content.modelSections.map((model) => (
                      <article key={model.id} className="legal-page__model-card">
                        <h4 className="legal-page__subsection-title">{model.title}</h4>
                        <p className="legal-page__mini-label">{content.usesLabel}</p>
                        <ul className="legal-page__bullet-list">
                          {model.uses.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                        <p className="legal-page__mini-label">{content.purposeLabel}</p>
                        <p className="legal-page__clause-text">{model.purpose}</p>
                      </article>
                    ))}
                    <p className="legal-page__note">{content.modelAdvisory}</p>
                  </div>
                )}

                {Array.isArray(section.bullets) && section.bullets.length > 0 && (
                  <ul className="legal-page__bullet-list">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>
      </main>
      <Footer />
      <BackToTop />
      <FloatingChatbot />
    </div>
  );
}
