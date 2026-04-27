import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { toast } from 'sonner';

const headline = "Built for Builders. Designed for Growth.";
const words = headline.split(' ');

export default function HeroSection() {
    const [wordVisible, setWordVisible] = useState<boolean[]>(new Array(words.length).fill(false));
    const [lineDrawn, setLineDrawn] = useState(false);
    const svgRef = useRef<SVGPathElement>(null!);

    useEffect(() => {
        words.forEach((_, i) => {
            setTimeout(() => {
                setWordVisible(prev => {
                    const updated = [...prev];
                    updated[i] = true;
                    return updated;
                });
            }, 400 + i * 50);
        });
        setTimeout(() => setLineDrawn(true), 400 + words.length * 50 + 200);
    }, []);

    const pathLength = 200;

    return (
        <section className="relative min-h-screen flex overflow-hidden">
            {/* Left — cinematic image panel */}
            <div className="relative w-[56%] min-h-screen hidden lg:block flex-shrink-0">
                <img
                    src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80"
                    alt="Tech campus"
                    className="absolute inset-0 w-full h-full object-cover cinematic-grade"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#0B0C0F]/80" />
                {/* Vertical divider */}
                <div className="absolute right-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
            </div>

            {/* Right — content */}
            <div className="flex-1 flex items-center relative z-10 bg-[#0B0C0F] lg:bg-transparent">
                {/* Mobile background */}
                <div className="absolute inset-0 lg:hidden">
                    <img src="https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80"
                        alt="" className="w-full h-full object-cover cinematic-grade opacity-30" />
                </div>

                <div className="relative z-10 px-8 lg:px-16 py-24 max-w-2xl">
                    {/* Mono label */}
                    <p className="font-['IBM_Plex_Mono'] text-xs text-[#FFBF00] uppercase tracking-[0.2em] mb-6">
                        Managed Tech Campus
                    </p>

                    {/* Animated headline */}
                    <h1 className="font-['Sora'] font-bold text-4xl md:text-5xl xl:text-6xl text-[#F4F6F8] leading-tight mb-2">
                        {words.map((word, i) => (
                            <span key={i}
                                className={`${wordVisible[i] ? 'word-visible' : 'word-hidden'} mr-3`}
                                style={{ transitionDelay: `${i * 50}ms` }}>
                                {word}
                            </span>
                        ))}
                    </h1>

                    {/* Animated SVG underline */}
                    <svg className="mb-6" viewBox="0 0 300 20" width="320" height="20">
                        <path
                            ref={svgRef}
                            d="M 0 12 Q 80 2 160 12 Q 240 22 300 12"
                            className="accent-line"
                            style={{
                                strokeDasharray: pathLength,
                                strokeDashoffset: lineDrawn ? 0 : pathLength,
                                transition: 'stroke-dashoffset 1.5s ease-out',
                                filter: 'drop-shadow(0 0 8px rgba(255,191,0,0.5))',
                            }}
                        />
                    </svg>

                    <p className="font-['Inter'] text-[#A7AFBA] text-base md:text-lg leading-relaxed mb-8 max-w-lg">
                        Gupio Tech Park offers plug-and-play office spaces, enterprise-grade infrastructure, and a thriving innovation community — all in one address.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={() => toast.success('We\'ll be in touch within 24 hours!', { description: 'Visit request received.' })}
                            className="btn-primary px-6 py-3.5 rounded-xl font-['Inter'] font-semibold text-sm flex items-center justify-center gap-2 group">
                            Schedule a Visit <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button
                            onClick={() => { const el = document.querySelector('#spaces'); el?.scrollIntoView({ behavior: 'smooth' }) }}
                            className="px-6 py-3.5 rounded-xl font-['Inter'] font-semibold text-sm border border-white/10 text-[#F4F6F8] hover:border-white/20 hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                            Explore Spaces <Search className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
