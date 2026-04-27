import { Toaster } from 'sonner';
import Navigation from './components/Navigation';
import HeroSection from './components/HeroSection';
import FeatureSection from './components/FeatureSection';
import SpacesSection from './components/SpacesSection';
import CommunitySection from './components/CommunitySection';
import HowItWorksSection from './components/HowItWorksSection';
import AmenitiesSection from './components/AmenitiesSection';
import PricingSection from './components/PricingSection';
import TestimonialsSection from './components/TestimonialsSection';
import FAQSection from './components/FAQSection';
import FinalCTASection from './components/FinalCTASection';
import Footer from './components/Footer';

export default function App() {
    return (
        <div className="relative min-h-screen bg-[#0B0C0F]">
            <div className="grain-overlay" />
            <div className="vignette" />
            <Toaster theme="dark" richColors position="top-right" />
            <Navigation />
            <HeroSection />
            <FeatureSection />
            <SpacesSection />
            <CommunitySection />
            <HowItWorksSection />
            <AmenitiesSection />
            <PricingSection />
            <TestimonialsSection />
            <FAQSection />
            <FinalCTASection />
            <Footer />
        </div>
    );
}
