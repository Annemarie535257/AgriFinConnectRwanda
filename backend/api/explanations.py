"""
Human-readable explanations for ML API responses.
Supports language: en (English), fr (French), rw (Kinyarwanda).
"""

# Translations for explanation snippets and full strings. Keys: en, fr, rw.
TRANSLATIONS = {
    "en": {
        "approved_prefix": "Approved: The application was approved based on ",
        "denied_prefix": "Denied: The application was not approved primarily due to ",
        "strong_credit": "strong credit score ({}).",
        "acceptable_credit": "acceptable credit score ({}).",
        "income_supports": "income supports the requested loan amount and repayment.",
        "manageable_dti": "manageable debt-to-income ratio ({:.0%}).",
        "stable_employment": "stable employment status.",
        "no_defaults": "no previous loan defaults.",
        "no_bankruptcy": "no bankruptcy history.",
        "good_payment": "good payment history.",
        "profile_meets": "your overall profile meets the eligibility criteria.",
        "credit_low": "credit score ({}).",
        "high_dti": "high debt-to-income ratio ({:.0%}).",
        "prev_defaults": "previous loan default(s).",
        "bankruptcy_hist": "bankruptcy history.",
        "employment_status": "employment status.",
        "income_insufficient": "income may be insufficient for the requested amount.",
        "weak_payment": "limited or weak payment history.",
        "combined_risk": "the combined risk factors in your profile.",
        "eligibility_description": "Approved means the model predicts the application would be accepted; denied means it would likely be rejected. The reason is derived from your application features (e.g. credit score, income, debt-to-income, employment, payment history).",
        "low_risk": "Low risk",
        "moderate_risk": "Moderate risk",
        "higher_risk": "Higher risk",
        "risk_low_interpretation": "The score indicates a lower likelihood of default. Lenders may offer more favorable terms for applications in this range.",
        "risk_mod_interpretation": "The score indicates a moderate level of default risk. Lenders may apply standard terms or request additional assurance.",
        "risk_high_interpretation": "The score indicates a higher likelihood of default. Lenders may require stronger guarantees or offer different terms.",
        "risk_score_label": "Risk score: {:.1f}. ",
        "risk_relative": "This is a relative measure of default risk (higher number = higher risk). ",
        "interpretation_label": "Interpretation: {} — {}",
        "score_meaning": "Scores are typically in a range where lower values (e.g. below 40) indicate lower default risk and higher values (e.g. above 55) indicate higher default risk. The exact scale depends on the model training data.",
        "recommend_intro": "The recommended amount of {:.0f} RWF is based on your profile: {}. ",
        "recommend_outro": "The model considers these and other application features to suggest a loan amount that aligns with typical approvals for similar profiles while respecting affordability and risk.",
        "your_income": "your annual income ({} RWF)",
        "your_credit": "your credit score ({})",
        "your_dti": "your debt-to-income ratio ({:.0%})",
        "your_net_worth": "your net worth ({} RWF)",
        "savings_reserves": "savings and reserves ({} RWF)",
        "employment_status_f": "employment status ({})",
        "loan_duration": "requested loan duration ({} months)",
        "recommend_basis": "The recommendation is driven by income, credit score, debt burden, assets, employment, and loan term from your application.",
    },
    "fr": {
        "approved_prefix": "Approuvé : La demande a été approuvée en raison de ",
        "denied_prefix": "Refusé : La demande n'a pas été approuvée principalement en raison de ",
        "strong_credit": "un bon score de crédit ({}).",
        "acceptable_credit": "un score de crédit acceptable ({}).",
        "income_supports": "les revenus permettent de supporter le montant demandé et le remboursement.",
        "manageable_dti": "un ratio dette/revenus gérable ({:.0%}).",
        "stable_employment": "une situation d'emploi stable.",
        "no_defaults": "aucun défaut de prêt antérieur.",
        "no_bankruptcy": "aucun antécédent de faillite.",
        "good_payment": "un bon historique de paiement.",
        "profile_meets": "votre profil global répond aux critères d'éligibilité.",
        "credit_low": "le score de crédit ({}).",
        "high_dti": "un ratio dette/revenus élevé ({:.0%}).",
        "prev_defaults": "des défauts de prêt antérieurs.",
        "bankruptcy_hist": "des antécédents de faillite.",
        "employment_status": "la situation d'emploi.",
        "income_insufficient": "les revenus peuvent être insuffisants pour le montant demandé.",
        "weak_payment": "un historique de paiement limité ou faible.",
        "combined_risk": "l'ensemble des facteurs de risque de votre profil.",
        "eligibility_description": "Approuvé signifie que le modèle prédit que la demande serait acceptée ; refusé signifie qu'elle serait probablement rejetée. La raison est dérivée de vos données (score de crédit, revenus, ratio dette/revenus, emploi, historique de paiement).",
        "low_risk": "Risque faible",
        "moderate_risk": "Risque modéré",
        "higher_risk": "Risque élevé",
        "risk_low_interpretation": "Le score indique une probabilité plus faible de défaut. Les prêteurs peuvent offrir des conditions plus favorables pour les demandes dans cette plage.",
        "risk_mod_interpretation": "Le score indique un niveau modéré de risque de défaut. Les prêteurs peuvent appliquer des conditions standard ou demander des garanties supplémentaires.",
        "risk_high_interpretation": "Le score indique une probabilité plus élevée de défaut. Les prêteurs peuvent exiger des garanties plus solides ou proposer des conditions différentes.",
        "risk_score_label": "Score de risque : {:.1f}. ",
        "risk_relative": "C'est une mesure relative du risque de défaut (nombre plus élevé = risque plus élevé). ",
        "interpretation_label": "Interprétation : {} — {}",
        "score_meaning": "Les scores sont typiquement dans une plage où les valeurs basses (ex. sous 40) indiquent un risque de défaut plus faible et les valeurs hautes (ex. au-dessus de 55) un risque plus élevé. L'échelle exacte dépend des données d'entraînement du modèle.",
        "recommend_intro": "Le montant recommandé de {:.0f} RWF est basé sur votre profil : {}. ",
        "recommend_outro": "Le modèle prend en compte ces éléments et d'autres données de la demande pour proposer un montant qui correspond aux approbations typiques pour des profils similaires tout en respectant la capacité de remboursement et le risque.",
        "your_income": "vos revenus annuels ({} RWF)",
        "your_credit": "votre score de crédit ({})",
        "your_dti": "votre ratio dette/revenus ({:.0%})",
        "your_net_worth": "votre actif net ({} RWF)",
        "savings_reserves": "épargne et réserves ({} RWF)",
        "employment_status_f": "situation d'emploi ({})",
        "loan_duration": "durée du prêt demandée ({} mois)",
        "recommend_basis": "La recommandation est basée sur les revenus, le score de crédit, l'endettement, les actifs, l'emploi et la durée du prêt de votre demande.",
    },
    "rw": {
        "approved_prefix": "Yemewe: Gusaba kwemewe kubera ",
        "denied_prefix": "Yahakanwe: Gusaba ntiyemewe cyane cyane kubera ",
        "strong_credit": "inote yiza y'inguzanyo ({}).",
        "acceptable_credit": "inote y'inguzanyo yemewe ({}).",
        "income_supports": "amikoro ashobora gutanga inguzanyo yasabwe no kwishyura.",
        "manageable_dti": "ingeri y'inguzanyo n'amikoro itunganye ({:.0%}).",
        "stable_employment": "akazi keza.",
        "no_defaults": "nta mpinga y'inguzanyo yabanje.",
        "no_bankruptcy": "nta mateka y'ubusambanyi bw'ubukungu.",
        "good_payment": "amateka meza yo kwishyura.",
        "profile_meets": "profili yawe ihuje n'ibisabwa kugira ngo ugire uburenganzira.",
        "credit_low": "inote y'inguzanyo ({}).",
        "high_dti": "ingeri y'inguzanyo n'amikoro hejuru ({:.0%}).",
        "prev_defaults": "impinga z'inguzanyo zabanje.",
        "bankruptcy_hist": "amateka y'ubusambanyi bw'ubukungu.",
        "employment_status": "akazi.",
        "income_insufficient": "amikoro bishobora kutagira bihagije kuri ayo mafaranga yasabwe.",
        "weak_payment": "amateke yo kwishyura make cyangwa butubutse.",
        "combined_risk": "ibintu byose by'ingorane mu profili yawe.",
        "eligibility_description": "Yemewe bivuze ko imodeli yitegereza ko gusaba kuzemewe; yahakanwe bivuze ko bishobora guhakanwa. Impamvu ituruka ku makuru yawe (urugero: inote, amikoro, ingeri, akazi, amateka yo kwishyura).",
        "low_risk": "Ingorane nke",
        "moderate_risk": "Ingorane idasumba",
        "higher_risk": "Ingorane nini",
        "risk_low_interpretation": "Inyungu igaragaza ko hari uburo buke bwo kutishyura. Abaha inguzanyo bashobora gutanga amasezerano meza kuri gusaba muri iki gice.",
        "risk_mod_interpretation": "Inyungu igaragaza ingorane idasumba yo kutishyura. Abaha inguzanyo bashobora gutanga amasezerano busanzwe cyangwa gusaba umuhamya.",
        "risk_high_interpretation": "Inyungu igaragaza ko hari uburo bukabije bwo kutishyura. Abaha inguzanyo bashobora gusaba inkunga zikomeye cyangwa gutanga amasezerano atandukanye.",
        "risk_score_label": "Inyungu: {:.1f}. ",
        "risk_relative": "Iyi ni igipimo cy'ingorane yo kutishyura (nomero hejuru = ingorane nini). ",
        "interpretation_label": "Gusobanura: {} — {}",
        "score_meaning": "Inyungu ziba ziri mu gice cyo hasi (urugero munsi ya 40) zerekana ingorane nke, n'izo hejuru (urugero hejuru ya 55) zerekana ingorane nini. Icyitegererezo bitandukanye bitewe n'amakuru y'imyigishirize.",
        "recommend_intro": "Amafaranga yemerwa {:.0f} RWF yashingiwe ku profili yawe: {}. ",
        "recommend_outro": "Imodeli itereye izi n'izindi makuru kugira ngo itange umubare w'inguzanyo uhuza n'icyemewe gisanzwe kuri profili nk'iyawe, mu gihe igenera ubushobozi n'ingorane.",
        "your_income": "amikoro y'umwaka ({} RWF)",
        "your_credit": "inote yawe ({})",
        "your_dti": "ingeri y'inguzanyo n'amikoro ({:.0%})",
        "your_net_worth": "agaciro k'umutungo ({} RWF)",
        "savings_reserves": "ububiko n'ibindi ({} RWF)",
        "employment_status_f": "akazi ({})",
        "loan_duration": "igihe cy'inguzanyo yasabwe ({} amezi)",
        "recommend_basis": "Icyitegererezo gishingiye ku mikoro, inote, inguzanyo, umutungo, akazi n'igihe cy'inguzanyo mu gusaba kwawe.",
    },
}


def _tr(lang, key, *args):
    """Get translation for key in language; fallback to English. Format with args if given."""
    texts = TRANSLATIONS.get(lang, TRANSLATIONS["en"])
    s = texts.get(key, TRANSLATIONS["en"].get(key, key))
    if args:
        try:
            return s.format(*args)
        except (TypeError, ValueError):
            return s
    return s


def _num(payload, key, default=0):
    try:
        v = payload.get(key, default)
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default


def _str(payload, key, default=""):
    v = payload.get(key, default)
    return str(v).strip() if v is not None else default


def _lang(payload):
    """Get language from payload; default 'en'. Valid: en, fr, rw."""
    lang = (payload.get("language") or payload.get("lang") or "en")
    lang = str(lang).strip().lower()[:2]
    return lang if lang in ("en", "fr", "rw") else "en"


def eligibility_reason(payload, approved, language="en"):
    """
    Build a short reason for approval or denial based on the application features.
    language: 'en' | 'fr' | 'rw'
    """
    lang = language if language in ("en", "fr", "rw") else "en"
    income = _num(payload, "AnnualIncome", 60000)
    credit = _num(payload, "CreditScore", 620)
    loan_amt = _num(payload, "LoanAmount", 20000)
    dti = _num(payload, "DebtToIncomeRatio", 0.35)
    employment = _str(payload, "EmploymentStatus", "Employed")
    prev_defaults = _num(payload, "PreviousLoanDefaults", 0)
    bankruptcy = _num(payload, "BankruptcyHistory", 0)
    payment_hist = _num(payload, "PaymentHistory", 25)

    reasons = []
    if approved:
        if credit >= 650:
            reasons.append(_tr(lang, "strong_credit", int(credit)))
        elif credit >= 600:
            reasons.append(_tr(lang, "acceptable_credit", int(credit)))
        if income >= 50000 and loan_amt > 0 and (income / 12) > loan_amt / 48:
            reasons.append(_tr(lang, "income_supports"))
        if dti <= 0.40:
            reasons.append(_tr(lang, "manageable_dti", dti))
        if employment == "Employed":
            reasons.append(_tr(lang, "stable_employment"))
        if prev_defaults == 0:
            reasons.append(_tr(lang, "no_defaults"))
        if bankruptcy == 0:
            reasons.append(_tr(lang, "no_bankruptcy"))
        if payment_hist >= 20:
            reasons.append(_tr(lang, "good_payment"))
        if not reasons:
            reasons.append(_tr(lang, "profile_meets"))
        return _tr(lang, "approved_prefix") + " ".join(reasons)
    else:
        if credit < 600:
            reasons.append(_tr(lang, "credit_low", int(credit)))
        if dti > 0.45:
            reasons.append(_tr(lang, "high_dti", dti))
        if prev_defaults > 0:
            reasons.append(_tr(lang, "prev_defaults"))
        if bankruptcy > 0:
            reasons.append(_tr(lang, "bankruptcy_hist"))
        if employment == "Unemployed":
            reasons.append(_tr(lang, "employment_status"))
        if income < 30000 and loan_amt > 10000:
            reasons.append(_tr(lang, "income_insufficient"))
        if payment_hist < 15:
            reasons.append(_tr(lang, "weak_payment"))
        if not reasons:
            reasons.append(_tr(lang, "combined_risk"))
        return _tr(lang, "denied_prefix") + ", ".join(reasons)


def risk_score_description(risk_score, language="en"):
    """
    Return interpretation and description of what the risk score means.
    language: 'en' | 'fr' | 'rw'
    """
    lang = language if language in ("en", "fr", "rw") else "en"
    score = float(risk_score)
    if score < 35:
        band = _tr(lang, "low_risk")
        interpretation = _tr(lang, "risk_low_interpretation")
    elif score < 55:
        band = _tr(lang, "moderate_risk")
        interpretation = _tr(lang, "risk_mod_interpretation")
    else:
        band = _tr(lang, "higher_risk")
        interpretation = _tr(lang, "risk_high_interpretation")

    description = (
        _tr(lang, "risk_score_label", score)
        + _tr(lang, "risk_relative")
        + _tr(lang, "interpretation_label", band, interpretation)
    )
    return {
        "interpretation": band,
        "description": description,
        "score_meaning": _tr(lang, "score_meaning"),
    }


def recommend_amount_explanation(payload, recommended_amount, language="en"):
    """
    Explain why this loan amount was recommended based on the main features.
    language: 'en' | 'fr' | 'rw'
    """
    lang = language if language in ("en", "fr", "rw") else "en"
    income = _num(payload, "AnnualIncome", 60000)
    credit = _num(payload, "CreditScore", 620)
    dti = _num(payload, "DebtToIncomeRatio", 0.35)
    net_worth = _num(payload, "NetWorth", 30000)
    savings = _num(payload, "SavingsAccountBalance", 5000)
    employment = _str(payload, "EmploymentStatus", "Employed")
    loan_duration = _num(payload, "LoanDuration", 48)

    factors = []
    if income > 0:
        factors.append(_tr(lang, "your_income", int(income)))
    factors.append(_tr(lang, "your_credit", int(credit)))
    factors.append(_tr(lang, "your_dti", dti))
    if net_worth > 0:
        factors.append(_tr(lang, "your_net_worth", int(net_worth)))
    if savings > 0:
        factors.append(_tr(lang, "savings_reserves", int(savings)))
    factors.append(_tr(lang, "employment_status_f", employment))
    if loan_duration > 0:
        factors.append(_tr(lang, "loan_duration", int(loan_duration)))

    # Join with comma (language-neutral for list)
    factors_str = ", ".join(factors)
    explanation = _tr(lang, "recommend_intro", float(recommended_amount), factors_str) + _tr(lang, "recommend_outro")
    return {
        "explanation": explanation,
        "basis": _tr(lang, "recommend_basis"),
    }


def eligibility_description(language="en"):
    """Static description for eligibility API response."""
    lang = language if language in ("en", "fr", "rw") else "en"
    return _tr(lang, "eligibility_description")
