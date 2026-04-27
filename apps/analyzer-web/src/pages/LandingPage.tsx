import Navigation from '../components/landing/Navigation';
import HeroSection from '../components/landing/HeroSection';

export default function LandingPage() {
    return (
        <div className="relative min-h-screen bg-white">
            <div className="grain-overlay opacity-[0.02]" />
            <Navigation />
            <main>
                <HeroSection />
            </main>
        </div>
    );
}
