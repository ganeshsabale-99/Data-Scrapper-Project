import { Link } from 'react-router';
import { BarChart3 } from 'lucide-react';

const footerLinks = [
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Team Access', href: '#team-access' },
    { label: 'FAQ', href: '#faq' },
];

export default function Footer() {
    const scrollTo = (href: string) => {
        const el = document.querySelector(href);
        el?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <footer className="bg-slate-950 border-t border-white/8 py-10 px-6">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    {/* Brand */}
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#FFBF00] flex items-center justify-center">
                            <BarChart3 className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                        </div>
                        <div>
                            <span className="font-['Sora'] font-bold text-[#F4F6F8] text-sm">Gupio</span>
                            <span className="font-['Sora'] font-light text-[#FF7B00] text-sm ml-1">Analyzer</span>
                        </div>
                    </div>

                    {/* Nav links */}
                    <div className="flex items-center gap-6 flex-wrap justify-center">
                        {footerLinks.map((link) => (
                            <button
                                key={link.href}
                                onClick={() => scrollTo(link.href)}
                                className="font-['Inter'] text-xs text-[#64748b] hover:text-[#A7AFBA] transition-colors cursor-pointer"
                            >
                                {link.label}
                            </button>
                        ))}
                        <Link to="/login" className="font-['Inter'] text-xs text-[#FF7B00] hover:text-blue-400 transition-colors font-medium">
                            Sign In →
                        </Link>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/6 flex flex-col md:flex-row items-center justify-between gap-2 text-center">
                    <p className="font-['IBM_Plex_Mono'] text-[11px] text-[#475569]">
                        © 2025 Gupio Tech Park Analyzer
                    </p>
                </div>
            </div>
        </footer>
    );
}
