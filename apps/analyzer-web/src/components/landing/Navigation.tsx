import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Menu, X } from 'lucide-react';
import gupioLogo from '@/assets/images/gupioLogo.png';

const navLinks: { label: string; href: string }[] = [];

export default function Navigation() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const handleNavClick = (href: string) => {
        const el = document.querySelector(href);
        el?.scrollIntoView({ behavior: 'smooth' });
        setMobileOpen(false);
    };

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-md border-b border-slate-200/50 shadow-sm' : 'bg-transparent'
                }`}
        >
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-2.5 group">
                    <div className="w-9 h-9 flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105">
                        <img src={gupioLogo} alt="Gupio Logo" className="w-full h-full object-contain" />
                    </div>
                    <div className="leading-none">
                        <span className="font-['Sora'] font-bold text-slate-900 text-base tracking-tight">Gupio</span>
                        <span className="font-['Sora'] font-light text-[#FFBF00] text-base ml-1">Analyzer</span>
                    </div>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-6">
                    {navLinks.map((link) => (
                        <button
                            key={link.href}
                            onClick={() => handleNavClick(link.href)}
                            className="font-['Inter'] text-sm text-[#A7AFBA] hover:text-[#F4F6F8] transition-colors cursor-pointer"
                        >
                            {link.label}
                        </button>
                    ))}
                </div>

                {/* CTA */}
                <div className="hidden md:flex items-center gap-3">
                    <Link
                        to="/login"
                        className="font-['Inter'] text-sm text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        Sign In
                    </Link>
                    <Link
                        to="/login"
                        className="px-4 py-2 rounded-lg bg-[#FFBF00] text-white font-['Inter'] font-semibold text-sm hover:bg-[#FF7B00] transition-colors shadow-lg shadow-[#FFBF00]/20"
                    >
                        Get Started →
                    </Link>
                </div>

                {/* Mobile hamburger */}
                <button
                    className="md:hidden text-slate-600 hover:text-slate-900 transition-colors"
                    onClick={() => setMobileOpen((v) => !v)}
                >
                    {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </div>

            {/* Mobile Menu */}
            {mobileOpen && (
                <div className="md:hidden bg-white/98 border-t border-slate-100 px-6 py-4 flex flex-col gap-4 shadow-xl">
                    {navLinks.map((link) => (
                        <button
                            key={link.href}
                            onClick={() => handleNavClick(link.href)}
                            className="text-left font-['Inter'] text-sm text-[#A7AFBA] hover:text-white transition-colors"
                        >
                            {link.label}
                        </button>
                    ))}
                    <Link
                        to="/login"
                        className="mt-2 px-4 py-2.5 rounded-lg bg-[#FFBF00] text-white font-['Inter'] font-semibold text-sm text-center"
                        onClick={() => setMobileOpen(false)}
                    >
                        Sign In →
                    </Link>
                </div>
            )}
        </nav>
    );
}
