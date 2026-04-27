import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';

const HEADLINE = 'Your Command Center for Tech Park Intelligence';

export default function HeroSection() {
    const [visible, setVisible] = useState(false);
    const sectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 100);
        return () => clearTimeout(t);
    }, []);

    return (
        <section
            ref={sectionRef}
            className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-white"
        >
            {/* Background grid */}
            <div
                className="absolute inset-0 opacity-[0.05]"
                style={{
                    backgroundImage:
                        'linear-gradient(rgb(59 130 246 / 0.1) 1px, transparent 1px), linear-gradient(90deg, rgb(59 130 246 / 0.1) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }}
            />

            {/* Radial glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[#FF7B00]/10 blur-[120px] pointer-events-none" />

            {/* Content */}
            <div
                className={`relative z-10 text-center px-6 max-w-5xl mx-auto transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                    }`}
            >
                {/* Headline */}
                <h1 className="font-['Sora'] font-bold text-5xl md:text-6xl xl:text-7xl text-slate-900 leading-[1.08] tracking-tight mb-6">
                    {HEADLINE.split('Tech Park').map((part, i) =>
                        i === 0 ? (
                            <span key={i}>{part}</span>
                        ) : (
                            <span key={i}>
                                <span className="text-[#FFBF00]">Tech Park</span>
                                {part}
                            </span>
                        )
                    )}
                </h1>

                {/* Subtext */}
                <p className="font-['Inter'] text-slate-600 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto mb-10">
                    Built for your Sales and Operations teams — discover, qualify, and manage tech parks & coworking spaces across India from one unified platform.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        to="/login"
                        className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#FFBF00] text-white font-['Inter'] font-bold text-base hover:bg-[#FF7B00] transition-all hover:scale-[1.02] active:scale-[0.98] group shadow-[0_0_30px_rgba(37,99,235,0.2)]"
                    >
                        Sign In to Dashboard
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
        </section>
    );
}
