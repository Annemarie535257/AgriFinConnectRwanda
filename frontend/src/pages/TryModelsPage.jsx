import Header from '../components/Header';
import LoanEligibilityCard from '../components/LoanEligibilityCard';
import RiskAssessmentCard from '../components/RiskAssessmentCard';
import LoanRecommendationCard from '../components/LoanRecommendationCard';
import ChatbotCard from '../components/ChatbotCard';
import Footer from '../components/Footer';
import BackToTop from '../components/BackToTop';
import { useLanguage } from '../context/LanguageContext';
import '../App.css';

export default function TryModelsPage() {
  const { t } = useLanguage();

  return (
    <div className="app">
      <Header />
      <main id="try-models" className="main" aria-labelledby="services-heading">
        <div className="main__inner">
          <section className="services-intro" aria-labelledby="services-heading">
            <h2 id="services-heading" className="services-intro__title">{t('nav.tryModels')}</h2>
            <p className="services-intro__text">{t('services.intro')}</p>
          </section>
          <LoanEligibilityCard />
          <RiskAssessmentCard />
          <LoanRecommendationCard />
          <ChatbotCard />
        </div>
      </main>
      <Footer />
      <BackToTop />
    </div>
  );
}
