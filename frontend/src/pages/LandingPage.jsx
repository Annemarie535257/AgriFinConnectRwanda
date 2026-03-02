import Header from '../components/Header';
import Hero from '../components/Hero';
import AboutSection from '../components/AboutSection';
import OurServicesSection from '../components/OurServicesSection';
import FaqSection from '../components/FaqSection';
import ContactSection from '../components/ContactSection';
import Footer from '../components/Footer';
import BackToTop from '../components/BackToTop';
import FloatingChatbot from '../components/FloatingChatbot';
import '../App.css';

export default function LandingPage() {
  return (
    <div className="app landing-layout">
      <Header />
      <main className="landing-main" aria-label="AgriFinConnect Rwanda landing content">
        <Hero />
        <AboutSection />
        <OurServicesSection />
        <FaqSection />
        <ContactSection />
      </main>
      <Footer />
      <BackToTop />
      <FloatingChatbot />
    </div>
  );
}
