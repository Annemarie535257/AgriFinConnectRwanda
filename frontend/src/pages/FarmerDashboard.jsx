import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import {
  getFarmerProfile,
  updateFarmerProfile,
  getFarmerApplications,
  submitFarmerApplication,
  getRequiredDocuments,
  uploadApplicationDocument,
  downloadFarmerApplicationPackage,
  getFarmerLoans,
  getFarmerRepayments,
  predictEligibility,
  predictRisk,
  recommendLoanAmount,
} from '../api/client';
import FloatingChatbot from '../components/FloatingChatbot';
import DashboardTopBar from '../components/DashboardTopBar';
import ApplicationTracker from '../components/ApplicationTracker';
import './Dashboard.css';
import './FarmerDashboard.css';

const EMPLOYMENT_OPTIONS = ['Employed', 'Self-Employed', 'Unemployed'];
const EDUCATION_OPTIONS = ['High School', 'Associate', 'Bachelor', 'Master'];
const MARITAL_OPTIONS = ['Single', 'Married', 'Divorced'];
const PURPOSE_OPTIONS = ['Other', 'Education', 'Home', 'Debt Consolidation'];

/** Map farmer form to ML model API payload (PascalCase) */
function formToMlPayload(form) {
  return {
    Age: Number(form.age) || 35,
    AnnualIncome: Number(form.annual_income) || 600000,
    CreditScore: Number(form.credit_score) || 600,
    LoanAmount: Number(form.loan_amount_requested) || 200000,
    LoanDuration: Number(form.loan_duration_months) || 24,
    EmploymentStatus: form.employment_status || 'Self-Employed',
    EducationLevel: form.education_level || 'High School',
    MaritalStatus: form.marital_status || 'Married',
    LoanPurpose: form.loan_purpose || 'Other',
    DebtToIncomeRatio: 0.35,
  };
}

export default function FarmerDashboard() {
  const { t, language } = useLanguage();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'apply';
  const [activeFarmTab, setActiveFarmTab] = useState('employees'); // 'employees' | 'fertilizers' | 'seeds' | 'production'
  const [profile, setProfile] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loans, setLoans] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [downloadingPackageId, setDownloadingPackageId] = useState(null);
  const [modelLoading, setModelLoading] = useState(null); // 'eligibility' | 'risk' | 'recommend' | null
  const [modelResults, setModelResults] = useState({ eligibility: null, risk: null, recommend: null });

  // Form state for loan application
  const [form, setForm] = useState({
    age: 35,
    annual_income: 600000,
    credit_score: 600,
    loan_amount_requested: 200000,
    loan_duration_months: 24,
    employment_status: 'Self-Employed',
    education_level: 'High School',
    marital_status: 'Married',
    loan_purpose: 'Other',
    // Farming / what they're planting
    farming_crops_or_activity: '',
    farming_land_size_hectares: '',
    farming_season: '',
    farming_estimated_yield: '',
    farming_livestock: '',
    farming_notes: '',
  });
  // Required documents (Rwanda) — from API
  const [requiredDocuments, setRequiredDocuments] = useState([]);
  // Selected files per document_type for the current application
  const [documentFiles, setDocumentFiles] = useState({});
  // Farm data (stored locally for now – can be connected to backend later)
  const [farmEmployees, setFarmEmployees] = useState(() => {
    try {
      const raw = localStorage.getItem('farm-employees');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [seedStock, setSeedStock] = useState(() => {
    try {
      const raw = localStorage.getItem('farm-seed-stock');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [productionRecords, setProductionRecords] = useState(() => {
    try {
      const raw = localStorage.getItem('farm-production-records');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [employeeForm, setEmployeeForm] = useState({
    full_name: '',
    role: '',
    start_date: '',
    pay_frequency: 'monthly',
    pay_amount: '',
    phone: '',
    national_id: '',
    employee_type: 'permanent',
    status: 'active',
    notes: '',
  });
  const [seedForm, setSeedForm] = useState({
    name: '',
    variety: '',
    quantity: '',
    unit: 'kg',
    supplier: '',
    lot_number: '',
    purchase_date: '',
    storage_location: '',
    notes: '',
  });
  const [productionForm, setProductionForm] = useState({
    crop: '',
    season: '',
    area_hectares: '',
    planting_date: '',
    harvest_date: '',
    harvested_quantity: '',
    harvested_unit: 'kg',
    field_name: '',
    buyer: '',
    price_per_unit: '',
    total_revenue: '',
    notes: '',
  });
  const [fertilizerRecords, setFertilizerRecords] = useState(() => {
    try {
      const raw = localStorage.getItem('farm-fertilizer-records');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [fertilizerForm, setFertilizerForm] = useState({
    crop: '',
    field_name: '',
    fertilizer_name: '',
    application_date: '',
    rate: '',
    interval_days: '',
    fertilizer_type: 'basal',
    method: 'broadcast',
    supplier: '',
    cost: '',
    notes: '',
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileRes, appsRes, loansRes, repayRes] = await Promise.all([
        getFarmerProfile().catch(() => null),
        getFarmerApplications().catch(() => ({ applications: [] })),
        getFarmerLoans().catch(() => ({ loans: [] })),
        getFarmerRepayments().catch(() => ({ repayments: [] })),
      ]);
      if (profileRes) setProfile(profileRes);
      if (appsRes?.applications) setApplications(appsRes.applications);
      if (loansRes?.loans) setLoans(loansRes.loans);
      if (repayRes?.repayments) setRepayments(repayRes.repayments);
    } catch (err) {
      setError(err.body?.error || err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    getRequiredDocuments(language)
      .then((res) => setRequiredDocuments(res.documents || []))
      .catch(() => setRequiredDocuments([]));
  }, [language]);

  const persistFarmEmployees = (next) => {
    setFarmEmployees(next);
    try {
      localStorage.setItem('farm-employees', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const persistSeedStock = (next) => {
    setSeedStock(next);
    try {
      localStorage.setItem('farm-seed-stock', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const persistProductionRecords = (next) => {
    setProductionRecords(next);
    try {
      localStorage.setItem('farm-production-records', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const persistFertilizerRecords = (next) => {
    setFertilizerRecords(next);
    try {
      localStorage.setItem('farm-fertilizer-records', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleAddEmployee = (e) => {
    e.preventDefault();
    if (!employeeForm.full_name.trim()) return;
    const next = [
      ...farmEmployees,
      {
        id: Date.now(),
        ...employeeForm,
      },
    ];
    persistFarmEmployees(next);
    setEmployeeForm({
      full_name: '',
      role: '',
      start_date: '',
      pay_frequency: 'monthly',
      pay_amount: '',
      phone: '',
      national_id: '',
      employee_type: 'permanent',
      status: 'active',
      notes: '',
    });
  };

  const handleAddSeed = (e) => {
    e.preventDefault();
    if (!seedForm.name.trim()) return;
    const next = [
      ...seedStock,
      {
        id: Date.now(),
        ...seedForm,
      },
    ];
    persistSeedStock(next);
    setSeedForm({
      name: '',
      variety: '',
      quantity: '',
      unit: 'kg',
      supplier: '',
      lot_number: '',
      purchase_date: '',
      storage_location: '',
      notes: '',
    });
  };

  const handleAddProduction = (e) => {
    e.preventDefault();
    if (!productionForm.crop.trim()) return;
    const next = [
      ...productionRecords,
      {
        id: Date.now(),
        ...productionForm,
      },
    ];
    persistProductionRecords(next);
    setProductionForm({
      crop: '',
      season: '',
      area_hectares: '',
      planting_date: '',
      harvest_date: '',
      harvested_quantity: '',
      harvested_unit: 'kg',
      field_name: '',
      buyer: '',
      price_per_unit: '',
      total_revenue: '',
      notes: '',
    });
  };

  const handleAddFertilizer = (e) => {
    e.preventDefault();
    if (!fertilizerForm.fertilizer_name.trim()) return;
    const next = [
      ...fertilizerRecords,
      {
        id: Date.now(),
        ...fertilizerForm,
      },
    ];
    persistFertilizerRecords(next);
    setFertilizerForm({
      crop: '',
      field_name: '',
      fertilizer_name: '',
      application_date: '',
      rate: '',
      interval_days: '',
      fertilizer_type: 'basal',
      method: 'broadcast',
      supplier: '',
      cost: '',
      notes: '',
    });
  };

  const handleExportFarmData = () => {
    const rows = [];
    const pushRow = (cols) => rows.push(cols.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));

    if (activeFarmTab === 'employees') {
      pushRow(['Section', 'Name', 'Role', 'Start date', 'Pay frequency', 'Pay amount (RWF)']);
      farmEmployees.forEach((e) => {
        pushRow([
          'Employee',
          e.full_name,
          e.role,
          e.start_date,
          e.pay_frequency,
          e.pay_amount,
        ]);
      });
    } else if (activeFarmTab === 'seeds') {
      pushRow(['Section', 'Name', 'Variety', 'Quantity', 'Unit']);
      seedStock.forEach((s) => {
        pushRow([
          'SeedStock',
          s.name,
          s.variety,
          s.quantity,
          s.unit,
        ]);
      });
    } else if (activeFarmTab === 'production') {
      pushRow(['Section', 'Crop', 'Season', 'Area (ha)', 'Planting date', 'Harvest date', 'Harvested qty', 'Unit']);
      productionRecords.forEach((p) => {
        pushRow([
          'Production',
          p.crop,
          p.season,
          p.area_hectares,
          p.planting_date,
          p.harvest_date,
          p.harvested_quantity,
          p.harvested_unit,
        ]);
      });
    } else if (activeFarmTab === 'fertilizers') {
      pushRow(['Section', 'Crop/field', 'Fertilizer', 'Date applied', 'Rate', 'Interval (days)']);
      fertilizerRecords.forEach((f) => {
        pushRow([
          'Fertilizer',
          f.crop,
          f.fertilizer_name,
          f.application_date,
          f.rate,
          f.interval_days,
        ]);
      });
    }

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'farm_data.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmitApplication = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await submitFarmerApplication({ ...form, language });
      const appId = res?.id;
      if (appId && typeof appId === 'number') {
        for (const [docType, file] of Object.entries(documentFiles)) {
          if (file && file instanceof File) {
            try {
              await uploadApplicationDocument(appId, docType, file);
            } catch (upErr) {
              console.warn('Document upload failed:', docType, upErr);
              setError(prev => (prev ? `${prev} Document "${docType}" upload failed.` : `Document "${docType}" upload failed.`));
            }
          }
        }
        setDocumentFiles({});
      }
      setSuccess(t('farmer.applicationSubmitted') || 'Application submitted successfully!');
      setModelResults({ eligibility: null, risk: null, recommend: null });
      setForm({
        age: 35,
        annual_income: 600000,
        credit_score: 600,
        loan_amount_requested: 200000,
        loan_duration_months: 24,
        employment_status: 'Self-Employed',
        education_level: 'High School',
        marital_status: 'Married',
        loan_purpose: 'Other',
        farming_crops_or_activity: '',
        farming_land_size_hectares: '',
        farming_season: '',
        farming_estimated_yield: '',
        farming_livestock: '',
        farming_notes: '',
      });
      fetchData();
    } catch (err) {
      setError(err.body?.error || err.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckEligibility = async () => {
    setModelLoading('eligibility');
    setModelResults((r) => ({ ...r, eligibility: null }));
    try {
      const data = await predictEligibility(formToMlPayload(form), language);
      setModelResults((r) => ({ ...r, eligibility: data }));
    } catch (err) {
      setModelResults((r) => ({ ...r, eligibility: { error: err.body?.error || err.message || 'Model unavailable' } }));
    } finally {
      setModelLoading(null);
    }
  };

  const handleCheckRisk = async () => {
    setModelLoading('risk');
    setModelResults((r) => ({ ...r, risk: null }));
    try {
      const data = await predictRisk(formToMlPayload(form), language);
      setModelResults((r) => ({ ...r, risk: data }));
    } catch (err) {
      setModelResults((r) => ({ ...r, risk: { error: err.body?.error || err.message || 'Model unavailable' } }));
    } finally {
      setModelLoading(null);
    }
  };

  const handleGetRecommendation = async () => {
    setModelLoading('recommend');
    setModelResults((r) => ({ ...r, recommend: null }));
    try {
      const data = await recommendLoanAmount(formToMlPayload(form), language);
      setModelResults((r) => ({ ...r, recommend: data }));
    } catch (err) {
      setModelResults((r) => ({ ...r, recommend: { error: err.body?.error || err.message || 'Model unavailable' } }));
    } finally {
      setModelLoading(null);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      location: fd.get('location') || '',
      phone: fd.get('phone') || '',
      cooperative_name: fd.get('cooperative_name') || '',
    };
    setLoading(true);
    setError(null);
    try {
      const res = await updateFarmerProfile(data);
      setProfile(res);
      setSuccess(t('farmer.profileUpdated') || 'Profile updated');
    } catch (err) {
      setError(err.body?.error || err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPackage = async (app) => {
    setDownloadingPackageId(app.id);
    setError(null);
    try {
      const { blob, contentDisposition } = await downloadFarmerApplicationPackage(app.id);
      const inferred = /filename="?([^"]+)"?/i.exec(contentDisposition || '')?.[1];
      const filename = inferred || `${app.folder_name || `application_${app.id}`}.zip`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.body?.error || err.message || 'Failed to download package');
    } finally {
      setDownloadingPackageId(null);
    }
  };

  const pendingCount = applications.filter((a) => a.status === 'pending').length;
  const approvedCount = applications.filter((a) => a.status === 'approved').length;

  return (
    <div className="dashboard-page farmer-dashboard">
      <DashboardTopBar title={t('dashboard.farmerTitle')} />
      <div className="dashboard-content">
        {error && <div className="farmer-dashboard__message farmer-dashboard__message--error">{error}</div>}
        {success && <div className="farmer-dashboard__message farmer-dashboard__message--success">{success}</div>}
        {loading && (
          <div className="farmer-dashboard__loading" aria-live="polite">
            {t('getStarted.submitting') || 'Loading…'}
          </div>
        )}

        {activeTab === 'apply' && (
        <>
          <div className="dashboard-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="dashboard-card">
              <h3 className="dashboard-card__title">{t('dashboard.myApplications')}</h3>
              <div className="dashboard-donut" style={{ background: `conic-gradient(var(--color-primary) ${(applications.length ? (approvedCount / applications.length) * 100 : 0)}%, #e8eaed 0)` }}>
                <span className="dashboard-donut__inner">{applications.length}</span>
              </div>
              <span className="dashboard-card__label">{t('farmer.totalApplications') || 'Total applications'}</span>
            </div>
            <div className="dashboard-card">
              <h3 className="dashboard-card__title">{t('farmer.myLoans') || 'My loans'}</h3>
              <div className="dashboard-card__value">{loans.length}</div>
              <span className="dashboard-card__label">{t('farmer.activeLoans') || 'Active loans'}</span>
            </div>
            <div className="dashboard-card">
              <h3 className="dashboard-card__title">{t('farmer.repayments') || 'Repayments'}</h3>
              <div className="dashboard-card__value">{repayments.filter((r) => r.status === 'paid').length}/{repayments.length}</div>
              <span className="dashboard-card__label">{t('farmer.paid') || 'Paid'}</span>
            </div>
          </div>
        <section className="farmer-dashboard__section" aria-labelledby="apply-heading">
          <h2 id="apply-heading" className="farmer-dashboard__section-title">{t('dashboard.applyLoan')}</h2>
          <form className="farmer-dashboard__form" onSubmit={handleSubmitApplication}>
            <div className="farmer-dashboard__form-row">
              <label>
                <span>{t('card1.age')}</span>
                <input
                  type="number"
                  min={18}
                  max={100}
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: parseInt(e.target.value, 10) || 35 })}
                />
              </label>
              <label>
                <span>{t('card1.annualIncome')}</span>
                <input
                  type="number"
                  min={0}
                  value={form.annual_income}
                  onChange={(e) => setForm({ ...form, annual_income: parseInt(e.target.value, 10) || 0 })}
                />
              </label>
            </div>
            <div className="farmer-dashboard__form-row">
              <label>
                <span>{t('card1.creditScore')}</span>
                <input
                  type="number"
                  min={300}
                  max={850}
                  value={form.credit_score}
                  onChange={(e) => setForm({ ...form, credit_score: parseInt(e.target.value, 10) || 600 })}
                />
              </label>
              <label>
                <span>{t('card1.loanAmount')}</span>
                <input
                  type="number"
                  min={0}
                  value={form.loan_amount_requested}
                  onChange={(e) => setForm({ ...form, loan_amount_requested: parseInt(e.target.value, 10) || 0 })}
                />
              </label>
            </div>
            <div className="farmer-dashboard__form-row">
              <label>
                <span>{t('card1.loanDuration')}</span>
                <input
                  type="number"
                  min={6}
                  max={84}
                  value={form.loan_duration_months}
                  onChange={(e) => setForm({ ...form, loan_duration_months: parseInt(e.target.value, 10) || 24 })}
                />
              </label>
              <label>
                <span>{t('card1.employment')}</span>
                <select
                  value={form.employment_status}
                  onChange={(e) => setForm({ ...form, employment_status: e.target.value })}
                >
                  {EMPLOYMENT_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="farmer-dashboard__form-row">
              <label>
                <span>{t('card1.education')}</span>
                <select
                  value={form.education_level}
                  onChange={(e) => setForm({ ...form, education_level: e.target.value })}
                >
                  {EDUCATION_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>{t('farmer.maritalStatus') || 'Marital status'}</span>
                <select
                  value={form.marital_status}
                  onChange={(e) => setForm({ ...form, marital_status: e.target.value })}
                >
                  {MARITAL_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="farmer-dashboard__form-row">
              <label>
                <span>{t('farmer.loanPurpose') || 'Loan purpose'}</span>
                <select
                  value={form.loan_purpose}
                  onChange={(e) => setForm({ ...form, loan_purpose: e.target.value })}
                >
                  {PURPOSE_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* Farming / what you're planting */}
            <div className="farmer-dashboard__farming-section">
              <h3 className="farmer-dashboard__farming-title">
                {t('farmer.farmingSectionTitle') || "Farming & what you're planting"}
              </h3>
              <p className="farmer-dashboard__farming-intro">
                {t('farmer.farmingSectionIntro') || 'Tell us about your farm and crops so we can better assess your application.'}
              </p>
              <div className="farmer-dashboard__form-row">
                <label className="farmer-dashboard__form-label-full">
                  <span>{t('farmer.farmingCrops') || 'Crops / what you are planting (e.g. maize, beans, potatoes)'}</span>
                  <input
                    type="text"
                    placeholder={t('farmer.farmingCropsPlaceholder') || 'e.g. Maize, beans, Irish potatoes'}
                    value={form.farming_crops_or_activity}
                    onChange={(e) => setForm({ ...form, farming_crops_or_activity: e.target.value })}
                  />
                </label>
              </div>
              <div className="farmer-dashboard__form-row">
                <label>
                  <span>{t('farmer.farmingLandSize') || 'Land size (hectares)'}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0"
                    value={form.farming_land_size_hectares}
                    onChange={(e) => setForm({ ...form, farming_land_size_hectares: e.target.value })}
                  />
                </label>
                <label>
                  <span>{t('farmer.farmingSeason') || 'Season (e.g. Season A 2025)'}</span>
                  <input
                    type="text"
                    placeholder={t('farmer.farmingSeasonPlaceholder') || 'e.g. Season A 2025'}
                    value={form.farming_season}
                    onChange={(e) => setForm({ ...form, farming_season: e.target.value })}
                  />
                </label>
              </div>
              <div className="farmer-dashboard__form-row">
                <label>
                  <span>{t('farmer.farmingEstimatedYield') || 'Estimated yield (kg or value)'}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0"
                    value={form.farming_estimated_yield}
                    onChange={(e) => setForm({ ...form, farming_estimated_yield: e.target.value })}
                  />
                </label>
                <label>
                  <span>{t('farmer.farmingLivestock') || 'Livestock (if any)'}</span>
                  <input
                    type="text"
                    placeholder={t('farmer.farmingLivestockPlaceholder') || 'e.g. 2 cows, 10 chickens'}
                    value={form.farming_livestock}
                    onChange={(e) => setForm({ ...form, farming_livestock: e.target.value })}
                  />
                </label>
              </div>
              <div className="farmer-dashboard__form-row">
                <label className="farmer-dashboard__form-label-full">
                  <span>{t('farmer.farmingNotes') || 'Other farming notes'}</span>
                  <textarea
                    rows={3}
                    placeholder={t('farmer.farmingNotesPlaceholder') || 'Any other details about your farm, cooperative, or how you will use the loan'}
                    value={form.farming_notes}
                    onChange={(e) => setForm({ ...form, farming_notes: e.target.value })}
                  />
                </label>
              </div>
            </div>

            {/* Required documents for loan application in Rwanda */}
            {requiredDocuments.length > 0 && (
              <div className="farmer-dashboard__documents-section">
                <h3 className="farmer-dashboard__documents-title">
                  {t('farmer.requiredDocumentsTitle') || 'Required documents for loan application (Rwanda)'}
                </h3>
                <p className="farmer-dashboard__documents-intro">
                  {t('farmer.requiredDocumentsIntro') || 'You can upload documents now or after submitting. PDF or image (JPG, PNG) preferred.'}
                </p>
                <ul className="farmer-dashboard__documents-list">
                  {requiredDocuments.map((doc) => (
                    <li key={doc.document_type} className="farmer-dashboard__documents-item">
                      <div className="farmer-dashboard__documents-item-header">
                        <span className="farmer-dashboard__documents-name">{doc.name}</span>
                        {doc.required && <span className="farmer-dashboard__documents-required">{t('farmer.required') || 'Required'}</span>}
                      </div>
                      {doc.description && <p className="farmer-dashboard__documents-desc">{doc.description}</p>}
                      <div className="farmer-dashboard__documents-upload">
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            setDocumentFiles((prev) => (f ? { ...prev, [doc.document_type]: f } : { ...prev, [doc.document_type]: null }));
                          }}
                        />
                        {documentFiles[doc.document_type] && (
                          <span className="farmer-dashboard__documents-uploaded">
                            {t('farmer.uploaded') || 'Selected'}: {documentFiles[doc.document_type].name}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ML model preview - runs before submit */}
            <div className="farmer-dashboard__model-section">
              <h3 className="farmer-dashboard__model-title">
                {t('farmer.modelPreviewTitle') || 'AI model preview'}
              </h3>
              <p className="farmer-dashboard__model-hint">
                {t('farmer.modelPreviewHint') || 'Check eligibility, risk score, and recommended amount before submitting your application.'}
              </p>
              <div className="farmer-dashboard__model-buttons">
                <button
                  type="button"
                  className="farmer-dashboard__model-btn"
                  onClick={handleCheckEligibility}
                  disabled={loading || !!modelLoading}
                >
                  {modelLoading === 'eligibility' ? (t('card1.checking') || 'Checking…') : t('card1.submit') || 'Check eligibility'}
                </button>
                <button
                  type="button"
                  className="farmer-dashboard__model-btn"
                  onClick={handleCheckRisk}
                  disabled={loading || !!modelLoading}
                >
                  {modelLoading === 'risk' ? (t('card2.assessing') || 'Assessing…') : t('card2.submit') || 'Get risk score'}
                </button>
                <button
                  type="button"
                  className="farmer-dashboard__model-btn"
                  onClick={handleGetRecommendation}
                  disabled={loading || !!modelLoading}
                >
                  {modelLoading === 'recommend' ? (t('getStarted.submitting') || 'Loading…') : (t('card3.submit') || 'Get recommended amount')}
                </button>
              </div>
              {(modelResults.eligibility || modelResults.risk || modelResults.recommend) && (
                <div className="farmer-dashboard__model-results">
                  {modelResults.eligibility && (
                    <div className="farmer-dashboard__model-card">
                      <strong>{t('card1.title')}</strong>
                      {modelResults.eligibility.error ? (
                        <span className="farmer-dashboard__model-error">{modelResults.eligibility.error}</span>
                      ) : (
                        <span className={modelResults.eligibility.approved ? 'farmer-dashboard__model-ok' : 'farmer-dashboard__model-warn'}>
                          {modelResults.eligibility.approved ? t('card1.approved') : t('card1.denied')}
                          {modelResults.eligibility.reason && ` — ${modelResults.eligibility.reason}`}
                        </span>
                      )}
                    </div>
                  )}
                  {modelResults.risk && (
                    <div className="farmer-dashboard__model-card">
                      <strong>{t('card2.title')}</strong>
                      {modelResults.risk.error ? (
                        <span className="farmer-dashboard__model-error">{modelResults.risk.error}</span>
                      ) : (
                        <span>
                          {t('card2.riskScore')}: {Number(modelResults.risk.risk_score ?? modelResults.risk.score).toFixed(2)}
                          {modelResults.risk.interpretation && ` — ${modelResults.risk.interpretation}`}
                        </span>
                      )}
                    </div>
                  )}
                  {modelResults.recommend && (
                    <div className="farmer-dashboard__model-card">
                      <strong>{t('card3.title') || 'Loan recommendation'}</strong>
                      {modelResults.recommend.error ? (
                        <span className="farmer-dashboard__model-error">{modelResults.recommend.error}</span>
                      ) : (
                        <div>
                          <span className="farmer-dashboard__model-ok">
                            {t('farmer.modelRecommendedLabel') || 'Recommended'}: RWF {Number(modelResults.recommend.recommended_amount ?? modelResults.recommend.recommendedAmount ?? modelResults.recommend.amount).toLocaleString()}
                          </span>
                          <button
                            type="button"
                            className="farmer-dashboard__model-btn farmer-dashboard__model-btn--small"
                            onClick={() => {
                              const amt = modelResults.recommend.recommended_amount ?? modelResults.recommend.recommendedAmount ?? modelResults.recommend.amount;
                              if (amt != null) setForm((f) => ({ ...f, loan_amount_requested: Number(amt) }));
                            }}
                          >
                            {t('farmer.modelUseAmount') || 'Use this amount'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button type="submit" className="farmer-dashboard__submit" disabled={loading}>
              {loading ? t('getStarted.submitting') : t('farmer.submitApplication') || 'Submit application'}
            </button>
          </form>
        </section>
        </>
        )}

        {activeTab === 'applications' && (
        <section className="farmer-dashboard__section" aria-labelledby="apps-heading">
          <h2 id="apps-heading" className="farmer-dashboard__section-title">{t('dashboard.myApplications')}</h2>

          <div className="farmer-dashboard__process-overview" role="region" aria-labelledby="process-overview-heading">
            <h3 id="process-overview-heading" className="farmer-dashboard__process-overview-title">
              {t('farmer.processOverviewTitle')}
            </h3>
            <p className="farmer-dashboard__process-overview-intro">{t('farmer.processOverviewIntro')}</p>
            <ol className="farmer-dashboard__process-steps">
              <li><strong>{t('tracker.pending')}</strong> — {t('farmer.processStepSubmitted')}</li>
              <li><strong>{t('tracker.underReview')}</strong> — {t('farmer.processStepUnderReview')}</li>
              <li><strong>{t('tracker.documentsRequested')}</strong> — {t('farmer.processStepDocumentsRequested')}</li>
              <li><strong>{t('tracker.approved')}</strong> — {t('farmer.processStepApproved')}</li>
              <li><strong>{t('tracker.rejected')}</strong> — {t('farmer.processStepRejected')}</li>
            </ol>
          </div>

          {applications.length === 0 ? (
            <p className="farmer-dashboard__empty">{t('farmer.noApplications') || 'No applications yet.'}</p>
          ) : (
            <div className="farmer-dashboard__list">
              {applications.map((app) => {
                const statusLabel = app.status === 'under_review' ? 'UnderReview' : app.status === 'documents_requested' ? 'DocumentsRequested' : app.status.charAt(0).toUpperCase() + app.status.slice(1);
                const statusSummary = t(`farmer.statusSummary${statusLabel}`);
                const statusTextMap = {
                  pending: t('tracker.pending'),
                  under_review: t('tracker.underReview'),
                  documents_requested: t('tracker.documentsRequested'),
                  approved: t('tracker.approved'),
                  rejected: t('tracker.rejected'),
                };
                const statusText = statusTextMap[app.status] || app.status.replace(/_/g, ' ');
                return (
                  <div key={app.id} className="farmer-dashboard__card farmer-dashboard__card--application">
                    <div className="farmer-dashboard__card-row">
                      <strong>Application #{app.id}</strong>
                      <span className={`farmer-dashboard__status farmer-dashboard__status--${app.status}`}>{statusText}</span>
                    </div>
                    <p className="farmer-dashboard__card-meta">Amount: RWF {Number(app.loan_amount_requested).toLocaleString()} · {app.loan_duration_months} months</p>
                    {app.eligibility_approved != null && (
                      <p>Eligibility: {app.eligibility_approved ? t('card1.approved') : t('card1.denied')}</p>
                    )}
                    {app.risk_score != null && <p>Risk score: {app.risk_score?.toFixed(2)}</p>}
                    {app.recommended_amount != null && (
                      <p>Recommended: RWF {Number(app.recommended_amount).toLocaleString()}</p>
                    )}
                    <p className="farmer-dashboard__date">Submitted: {new Date(app.created_at).toLocaleDateString()}</p>
                    {(app.farming_crops_or_activity || app.farming_land_size_hectares || app.farming_livestock) && (
                      <p className="farmer-dashboard__card-farming">
                        {t('farmer.farmingSummary') || 'Farming'}: {[app.farming_crops_or_activity, app.farming_land_size_hectares != null ? `${app.farming_land_size_hectares} ha` : null, app.farming_livestock].filter(Boolean).join(' · ')}
                      </p>
                    )}

                    <div className="farmer-dashboard__package">
                      <p className="farmer-dashboard__package-folder">
                        <strong>{t('farmer.applicationFolderLabel') || 'Application folder'}:</strong>{' '}
                        {app.folder_name || `application_${app.id}`}
                      </p>
                      {app.documents?.length ? (
                        <ul className="farmer-dashboard__package-docs">
                          {app.documents.map((doc) => (
                            <li key={`${app.id}-${doc.document_type}`} className="farmer-dashboard__package-doc-item">
                              <span>{doc.document_name || doc.document_type}</span>
                              {doc.file_url ? (
                                <a href={doc.file_url} target="_blank" rel="noreferrer" className="farmer-dashboard__package-doc-link">
                                  {doc.file_name || 'Open'}
                                </a>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="farmer-dashboard__package-empty">{t('farmer.noAttachedDocuments') || 'No documents attached yet.'}</p>
                      )}
                      <button
                        type="button"
                        className="farmer-dashboard__model-btn"
                        onClick={() => handleDownloadPackage(app)}
                        disabled={downloadingPackageId === app.id}
                      >
                        {downloadingPackageId === app.id
                          ? (t('getStarted.submitting') || 'Loading…')
                          : (t('farmer.downloadPackage') || 'Download application package')}
                      </button>
                    </div>

                    <div className="farmer-dashboard__status-summary">
                      <p className="farmer-dashboard__status-summary-text">{statusSummary}</p>
                    </div>

                    <div className="farmer-dashboard__tracker">
                      <span className="farmer-dashboard__tracker-title">{t('farmer.applicationProgress')}</span>
                      <ApplicationTracker
                        statusHistory={app.status_history}
                        currentStatus={app.status}
                        compact={false}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}

        {activeTab === 'loans' && (
        <section className="farmer-dashboard__section" aria-labelledby="loans-heading">
          <h2 id="loans-heading" className="farmer-dashboard__section-title">{t('farmer.myLoans') || 'My loans'}</h2>
          {loans.length === 0 ? (
            <p className="farmer-dashboard__empty">{t('farmer.noLoans') || 'No approved loans yet.'}</p>
          ) : (
            <div className="farmer-dashboard__list">
              {loans.map((loan) => (
                <div key={loan.id} className="farmer-dashboard__card">
                  <p><strong>Loan #{loan.id}</strong></p>
                  <p>Amount: RWF {Number(loan.amount).toLocaleString()}</p>
                  <p>Duration: {loan.duration_months} months · Monthly: RWF {Number(loan.monthly_payment).toLocaleString()}</p>
                  <p className="farmer-dashboard__date">{new Date(loan.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </section>
        )}

        {activeTab === 'repayments' && (
        <section className="farmer-dashboard__section" aria-labelledby="rep-heading">
          <h2 id="rep-heading" className="farmer-dashboard__section-title">{t('farmer.repayments') || 'Repayments'}</h2>
          {repayments.length === 0 ? (
            <p className="farmer-dashboard__empty">{t('farmer.noRepayments') || 'No repayments yet.'}</p>
          ) : (
            <div className="farmer-dashboard__list">
              {repayments.map((r) => (
                <div key={r.id} className="farmer-dashboard__card farmer-dashboard__card--small">
                  <span>RWF {Number(r.amount).toLocaleString()}</span>
                  <span>Due: {r.due_date}</span>
                  <span className={`farmer-dashboard__status farmer-dashboard__status--${r.status}`}>{r.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        )}

        {activeTab === 'farm' && (
        <section className="farmer-dashboard__section" aria-labelledby="farm-heading">
          <div className="farmer-farm-header">
            <h2 id="farm-heading" className="farmer-dashboard__section-title">{t('farmer.farmDataTitle') || 'Farm & production data'}</h2>
            <button type="button" className="farmer-dashboard__submit farmer-farm-download-btn" onClick={handleExportFarmData}>
              {t('farmer.farmExportLabel') || 'Download this section (CSV)'}
            </button>
          </div>

          <div className="farmer-farm-tabs" role="tablist" aria-label="Farm data sections">
            <button
              type="button"
              className={`farmer-farm-tab ${activeFarmTab === 'employees' ? 'farmer-farm-tab--active' : ''}`}
              onClick={() => setActiveFarmTab('employees')}
            >
              {t('farmer.farmEmployeesTitle') || 'Employees'}
            </button>
            <button
              type="button"
              className={`farmer-farm-tab ${activeFarmTab === 'fertilizers' ? 'farmer-farm-tab--active' : ''}`}
              onClick={() => setActiveFarmTab('fertilizers')}
            >
              {t('farmer.farmFertilizerTitle') || 'Fertilizers'}
            </button>
            <button
              type="button"
              className={`farmer-farm-tab ${activeFarmTab === 'seeds' ? 'farmer-farm-tab--active' : ''}`}
              onClick={() => setActiveFarmTab('seeds')}
            >
              {t('farmer.farmSeedsTitle') || 'Seed & input stock'}
            </button>
            <button
              type="button"
              className={`farmer-farm-tab ${activeFarmTab === 'production' ? 'farmer-farm-tab--active' : ''}`}
              onClick={() => setActiveFarmTab('production')}
            >
              {t('farmer.farmProductionTitle') || 'Production records'}
            </button>
          </div>

          <div className="farmer-farm-panel" style={{ marginTop: '1.5rem' }}>
            {activeFarmTab === 'employees' && (
            <>
              <div className="dashboard-card">
                <h3 className="dashboard-card__title">{t('farmer.farmEmployeesTitle') || 'Employees'}</h3>
                <form className="farmer-dashboard__form" onSubmit={handleAddEmployee}>
                  <div className="farmer-dashboard__form-row">
                    <label>
                      <span>Full name</span>
                      <input
                        type="text"
                        value={employeeForm.full_name}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, full_name: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>Role</span>
                      <input
                        type="text"
                        value={employeeForm.role}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="farmer-dashboard__form-row">
                    <label>
                      <span>Start date</span>
                      <input
                        type="date"
                        value={employeeForm.start_date}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, start_date: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>Pay frequency</span>
                      <select
                        value={employeeForm.pay_frequency}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, pay_frequency: e.target.value })}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Every 2 weeks</option>
                        <option value="monthly">Monthly</option>
                        <option value="per_season">Per season</option>
                      </select>
                    </label>
                    <label>
                      <span>Pay amount (RWF)</span>
                      <input
                        type="number"
                        min={0}
                        value={employeeForm.pay_amount}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, pay_amount: e.target.value })}
                      />
                    </label>
                  </div>
                  <button type="submit" className="farmer-dashboard__submit">
                    Add employee
                  </button>
                </form>
              </div>
              {farmEmployees.length > 0 && (
              <div className="dashboard-card farmer-dashboard__card-table">
                <h3 className="dashboard-card__title">Employee records</h3>
                <div className="farmer-dashboard__table-wrapper">
                  <table className="farmer-dashboard__table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Start date</th>
                        <th>Pay freq.</th>
                        <th>Pay amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {farmEmployees.map((e) => (
                        <tr key={e.id}>
                          <td>{e.full_name}</td>
                          <td>{e.role}</td>
                          <td>{e.start_date}</td>
                          <td>{e.pay_frequency}</td>
                          <td>{e.pay_amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
            </>
            )}

            {activeFarmTab === 'seeds' && (
            <>
              <div className="dashboard-card">
                <h3 className="dashboard-card__title">{t('farmer.farmSeedsTitle') || 'Seed & input stock'}</h3>
                <form className="farmer-dashboard__form" onSubmit={handleAddSeed}>
                  <div className="farmer-dashboard__form-row">
                    <label>
                      <span>Name</span>
                      <input
                        type="text"
                        value={seedForm.name}
                        onChange={(e) => setSeedForm({ ...seedForm, name: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>Variety</span>
                      <input
                        type="text"
                        value={seedForm.variety}
                        onChange={(e) => setSeedForm({ ...seedForm, variety: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="farmer-dashboard__form-row">
                    <label>
                      <span>Quantity</span>
                      <input
                        type="number"
                        min={0}
                        value={seedForm.quantity}
                        onChange={(e) => setSeedForm({ ...seedForm, quantity: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>Unit</span>
                      <select
                        value={seedForm.unit}
                        onChange={(e) => setSeedForm({ ...seedForm, unit: e.target.value })}
                      >
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="bag">bag</option>
                        <option value="sack">sack</option>
                        <option value="litre">litre</option>
                      </select>
                    </label>
                  </div>
                  <button type="submit" className="farmer-dashboard__submit">
                    Add stock
                  </button>
                </form>
              </div>
              {seedStock.length > 0 && (
              <div className="dashboard-card farmer-dashboard__card-table">
                <h3 className="dashboard-card__title">Seed & input records</h3>
                <div className="farmer-dashboard__table-wrapper">
                  <table className="farmer-dashboard__table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Variety</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seedStock.map((s) => (
                        <tr key={s.id}>
                          <td>{s.name}</td>
                          <td>{s.variety}</td>
                          <td>{s.quantity}</td>
                          <td>{s.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
            </>
            )}

            {activeFarmTab === 'fertilizers' && (
            <>
              <div className="dashboard-card">
                <h3 className="dashboard-card__title">{t('farmer.farmFertilizerTitle') || 'Fertilizer applications'}</h3>
                <form className="farmer-dashboard__form" onSubmit={handleAddFertilizer}>
                  <div className="farmer-dashboard__form-row">
                    <label>
                      <span>Crop / field</span>
                      <input
                        type="text"
                        placeholder="e.g. Maize - Field A"
                        value={fertilizerForm.crop}
                        onChange={(e) => setFertilizerForm({ ...fertilizerForm, crop: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>Fertilizer name</span>
                      <input
                        type="text"
                        placeholder="e.g. NPK 17-17-17"
                        value={fertilizerForm.fertilizer_name}
                        onChange={(e) => setFertilizerForm({ ...fertilizerForm, fertilizer_name: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="farmer-dashboard__form-row">
                    <label>
                      <span>Date applied</span>
                      <input
                        type="date"
                        value={fertilizerForm.application_date}
                        onChange={(e) => setFertilizerForm({ ...fertilizerForm, application_date: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>Application rate</span>
                      <input
                        type="text"
                        placeholder="e.g. 50 kg/ha"
                        value={fertilizerForm.rate}
                        onChange={(e) => setFertilizerForm({ ...fertilizerForm, rate: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>Interval (days)</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="e.g. 30"
                        value={fertilizerForm.interval_days}
                        onChange={(e) => setFertilizerForm({ ...fertilizerForm, interval_days: e.target.value })}
                      />
                    </label>
                  </div>
                  <button type="submit" className="farmer-dashboard__submit">
                    Add application
                  </button>
                </form>
              </div>
              {fertilizerRecords.length > 0 && (
              <div className="dashboard-card farmer-dashboard__card-table">
                <h3 className="dashboard-card__title">Fertilizer records</h3>
                <div className="farmer-dashboard__table-wrapper">
                  <table className="farmer-dashboard__table">
                    <thead>
                      <tr>
                        <th>Crop / field</th>
                        <th>Fertilizer</th>
                        <th>Date applied</th>
                        <th>Rate</th>
                        <th>Interval (days)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fertilizerRecords.map((f) => (
                        <tr key={f.id}>
                          <td>{f.crop}</td>
                          <td>{f.fertilizer_name}</td>
                          <td>{f.application_date}</td>
                          <td>{f.rate}</td>
                          <td>{f.interval_days}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
            </>
            )}

            {activeFarmTab === 'production' && (
            <>
              <div className="dashboard-card">
                <h3 className="dashboard-card__title">{t('farmer.farmProductionTitle') || 'Production records'}</h3>
                <form className="farmer-dashboard__form" onSubmit={handleAddProduction}>
                  <div className="farmer-dashboard__form-row">
                    <label>
                      <span>Crop</span>
                      <input
                        type="text"
                        value={productionForm.crop}
                        onChange={(e) => setProductionForm({ ...productionForm, crop: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>Season</span>
                      <input
                        type="text"
                        value={productionForm.season}
                        onChange={(e) => setProductionForm({ ...productionForm, season: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>Area (ha)</span>
                      <input
                        type="number"
                        min={0}
                        value={productionForm.area_hectares}
                        onChange={(e) => setProductionForm({ ...productionForm, area_hectares: e.target.value })}
                      />
                    </label>
                  </div>
                  <div className="farmer-dashboard__form-row">
                    <label>
                      <span>Planting date</span>
                      <input
                        type="date"
                        value={productionForm.planting_date}
                        onChange={(e) => setProductionForm({ ...productionForm, planting_date: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>Harvest date</span>
                      <input
                        type="date"
                        value={productionForm.harvest_date}
                        onChange={(e) => setProductionForm({ ...productionForm, harvest_date: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>Harvested quantity</span>
                      <input
                        type="number"
                        min={0}
                        value={productionForm.harvested_quantity}
                        onChange={(e) => setProductionForm({ ...productionForm, harvested_quantity: e.target.value })}
                      />
                    </label>
                    <label>
                      <span>Unit</span>
                      <select
                        value={productionForm.harvested_unit}
                        onChange={(e) => setProductionForm({ ...productionForm, harvested_unit: e.target.value })}
                      >
                        <option value="kg">kg</option>
                        <option value="ton">ton</option>
                        <option value="bag">bag</option>
                        <option value="sack">sack</option>
                        <option value="litre">litre</option>
                      </select>
                    </label>
                  </div>
                  <button type="submit" className="farmer-dashboard__submit">
                    Add production record
                  </button>
                </form>
              </div>
              {productionRecords.length > 0 && (
              <div className="dashboard-card farmer-dashboard__card-table">
                <h3 className="dashboard-card__title">Production records</h3>
                <div className="farmer-dashboard__table-wrapper">
                  <table className="farmer-dashboard__table">
                    <thead>
                      <tr>
                        <th>Crop</th>
                        <th>Season</th>
                        <th>Area (ha)</th>
                        <th>Planting date</th>
                        <th>Harvest date</th>
                        <th>Harvested qty</th>
                        <th>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productionRecords.map((p) => (
                        <tr key={p.id}>
                          <td>{p.crop}</td>
                          <td>{p.season}</td>
                          <td>{p.area_hectares}</td>
                          <td>{p.planting_date}</td>
                          <td>{p.harvest_date}</td>
                          <td>{p.harvested_quantity}</td>
                          <td>{p.harvested_unit || 'kg'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              )}
            </>
            )}
          </div>
        </section>
        )}

        {activeTab === 'profile' && (
        <section className="farmer-dashboard__section" aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="farmer-dashboard__section-title">{t('farmer.profile') || 'Profile'}</h2>
          <form className="farmer-dashboard__form" onSubmit={handleUpdateProfile}>
            <label>
              <span>{t('farmer.location') || 'Location'}</span>
              <input name="location" defaultValue={profile?.location || ''} placeholder="e.g. Kigali" />
            </label>
            <label>
              <span>{t('farmer.phone') || 'Phone'}</span>
              <input name="phone" type="tel" defaultValue={profile?.phone || ''} placeholder="+250 788 000 000" />
            </label>
            <label>
              <span>{t('farmer.cooperative') || 'Cooperative name'}</span>
              <input name="cooperative_name" defaultValue={profile?.cooperative_name || ''} placeholder="Optional" />
            </label>
            <button type="submit" className="farmer-dashboard__submit" disabled={loading}>
              {t('farmer.saveProfile') || 'Save profile'}
            </button>
          </form>
        </section>
        )}
      </div>
      <FloatingChatbot />
    </div>
  );
}
