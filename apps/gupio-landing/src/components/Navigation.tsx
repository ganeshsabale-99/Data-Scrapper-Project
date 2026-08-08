import { useState, useEffect } from 'react';
import { Building2, Menu, X, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const navLinks = [
    { label: 'Spaces', href: '#spaces' },
    { label: 'Amenities', href: '#amenities' },
    { label: 'Community', href: '#community' },
    { label: 'Pricing', href: '#pricing' },
];

export default function Navigation() {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 100);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        e.preventDefault();
        const el = document.querySelector(href);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        setMenuOpen(false);
    };

    return (
        <>
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0B0C0F]/90 backdrop-blur-lg border-b border-white/5' : 'bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    {/* Logo */}
                    <a href="#" className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-[#FFBF00] rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-[#0B0C0F]" />
                        </div>
                        <span className="font-['Sora'] font-bold text-lg text-[#FFBF00]">Gupio Tech Park</span>
                    </a>

                    {/* Desktop links */}
                    <div className="hidden md:flex items-center gap-8">
                        {navLinks.map(link => (
                            <a key={link.label} href={link.href} onClick={e => handleScroll(e, link.href)}
                                className="font-['Inter'] text-sm text-[#A7AFBA] hover:text-[#F4F6F8] transition-colors">
                                {link.label}
                            </a>
                        ))}
                    </div>

                    {/* CTA */}
                    <div className="hidden md:flex items-center gap-5">
                        <a href="http://localhost:5174/login" target="_blank" rel="noopener noreferrer" className="font-['Inter'] text-sm font-semibold text-[#A7AFBA] hover:text-[#F4F6F8] transition-colors">
                            Sign In
                        </a>
                        <a href="http://localhost:5174/signup" target="_blank" rel="noopener noreferrer" className="btn-primary px-5 py-2.5 rounded-lg text-sm font-semibold font-['Inter'] flex items-center gap-2">
                            Sign Up <ArrowRight className="w-4 h-4" />
                        </a>
                    </div>

                    {/* Mobile menu toggle */}
                    <button className="md:hidden text-[#A7AFBA] hover:text-[#F4F6F8]" onClick={() => setMenuOpen(!menuOpen)}>
                        {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </nav>

            {/* Mobile overlay */}
            {menuOpen && (
                <div className="fixed inset-0 z-40 bg-[#0B0C0F]/95 backdrop-blur-lg flex flex-col items-center justify-center gap-8">
                    {navLinks.map((link, i) => (
                        <a key={link.label} href={link.href} onClick={e => handleScroll(e, link.href)}
                            style={{ transitionDelay: `${i * 80}ms` }}
                            className="font-['Sora'] text-3xl font-semibold text-[#F4F6F8] hover:text-[#FFBF00] transition-colors">
                            {link.label}
                        </a>
                    ))}
                    <div className="flex flex-col gap-5 mt-6 w-full max-w-[220px]">
                        <a href="http://localhost:5174/login" target="_blank" rel="noopener noreferrer" className="text-center font-['Inter'] text-lg font-medium text-[#A7AFBA] hover:text-[#F4F6F8] transition-colors">Sign In</a>
                        <a href="http://localhost:5174/signup" target="_blank" rel="noopener noreferrer" className="btn-primary w-full py-3.5 rounded-xl text-base font-semibold font-['Inter'] flex justify-center items-center">Sign Up</a>
                    </div>
                </div>
            )}
        </>
    );
}
