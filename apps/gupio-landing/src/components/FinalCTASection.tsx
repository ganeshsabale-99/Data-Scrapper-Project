import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Phone } from 'lucide-react';
import { toast } from 'sonner';

const headline = "Ready to build something great?";
const words = headline.split(' ');

export default function FinalCTASection() {
    const [wordVisible, setWordVisible] = useState<boolean[]>(new Array(words.length).fill(false));
    const [lineDrawn, setLineDrawn] = useState(false);
    const sectionRef = useRef<HTMLElement>(null!);
    const triggered = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !triggered.current) {
                triggered.current = true;
                words.forEach((_, i) => {
                    setTimeout(() => {
                        setWordVisible(prev => { const u = [...prev]; u[i] = true; return u; });
                    }, 300 + i * 50);
                });
                setTimeout(() => setLineDrawn(true), 300 + words.length * 50 + 200);
            }
        }, { threshold: 0.3 });
        if (sectionRef.current) observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <section ref={sectionRef} className="relative min-h-screen flex items-center overflow-hidden">
            <img
                src="https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=1600&q=80"
                alt="Tech campus aerial"
                className="absolute inset-0 w-full h-full object-cover cinematic-grade"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B0C0F]/85 via-[#0B0C0F]/50 to-transparent" />

            {/* SVG accent line */}
            <svg className="absolute top-1/4 left-0 w-full" viewBox="0 0 1200 60" preserveAspectRatio="none" height="60">
                <path
                    d="M 0 20 Q 300 50 600 20 Q 900 -10 1200 30"
                    className="accent-line"
                    style={{
                        strokeDasharray: 1500,
                        strokeDashoffset: lineDrawn ? 0 : 1500,
                        transition: 'stroke-dashoffset 1.5s ease-out',
                        filter: 'drop-shadow(0 0 8px rgba(255,191,0,0.5))',
                    }}
                />
            </svg>

            <div className="relative z-10 px-8 lg:px-24 max-w-3xl">
                <p className="font-['IBM_Plex_Mono'] text-xs text-[#FFBF00] uppercase tracking-[0.2em] mb-6">Get Started</p>
                <h2 className="font-['Sora'] font-bold text-4xl md:text-5xl xl:text-6xl text-[#F4F6F8] leading-tight mb-2">
                    {words.map((word, i) => (
                        <span key={i}
                            className={`${wordVisible[i] ? 'word-visible' : 'word-hidden'} mr-3`}
                            style={{ transitionDelay: `${i * 50}ms` }}>
                            {word === 'great?' ? <span className="text-[#FFBF00]">{word}</span> : word}
                        </span>
                    ))}
                </h2>

                {/* Animated SVG underline */}
                <svg className="mb-6" viewBox="0 0 240 16" width="260" height="16">
                    <path d="M 0 10 Q 60 2 120 10 Q 180 18 240 10"
                        className="accent-line"
                        style={{
                            strokeDasharray: 300,
                            strokeDashoffset: lineDrawn ? 0 : 300,
                            transition: 'stroke-dashoffset 1.5s ease-out 0.3s',
                            filter: 'drop-shadow(0 0 8px rgba(255,191,0,0.5))',
                        }}
                    />
                </svg>

                <p className="font-['Inter'] text-[#A7AFBA] text-lg leading-relaxed mb-10 max-w-xl">
                    Schedule a visit, pick your space, and move in within 72 hours. Your next chapter starts here.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={() => {
                            toast.success('Visit request sent!', { description: 'We\'ll reach out within 24 hours.' });
                            document.querySelector('#spaces')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="btn-primary px-8 py-4 rounded-xl font-['Inter'] font-semibold text-base flex items-center justify-center gap-2 group">
                        Schedule a Visit <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button
                        onClick={() => toast.info('Call us: +91-8446784175', { description: 'Mon–Sat, 9AM–7PM.' })}
                        className="px-8 py-4 rounded-xl font-['Inter'] font-semibold text-base border border-white/15 text-[#F4F6F8] hover:border-white/25 hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                        <Phone className="w-5 h-5" /> Call Us
                    </button>
                </div>
            </div>
        </section>
    );
}
