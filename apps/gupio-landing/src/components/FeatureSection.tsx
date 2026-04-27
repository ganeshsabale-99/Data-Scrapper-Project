import { useRef, useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

export default function FeatureSection() {
    const cardRef = useScrollAnimation();
    const svgRef = useRef<SVGPathElement>(null!);
    const sectionRef = useRef<HTMLElement>(null!);
    const [lineDrawn, setLineDrawn] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) setLineDrawn(true);
        }, { threshold: 0.3 });
        if (sectionRef.current) observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <section ref={sectionRef} className="relative min-h-screen flex items-center overflow-hidden">
            <img
                src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1600&q=80"
                alt="Open plan office"
                className="absolute inset-0 w-full h-full object-cover cinematic-grade"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B0C0F]/70 via-[#0B0C0F]/30 to-transparent" />

            {/* SVG accent line */}
            <svg className="absolute top-1/3 left-0 w-full" viewBox="0 0 1200 60" preserveAspectRatio="none" height="60">
                <path
                    ref={svgRef}
                    d="M 0 30 Q 300 10 600 30 Q 900 50 1200 30"
                    className="accent-line"
                    style={{
                        strokeDasharray: 1500,
                        strokeDashoffset: lineDrawn ? 0 : 1500,
                        transition: 'stroke-dashoffset 1.5s ease-out',
                        filter: 'drop-shadow(0 0 8px rgba(255,191,0,0.5))',
                    }}
                />
            </svg>

            {/* Floating glass card — top right */}
            <div ref={cardRef} className="relative z-10 ml-auto mr-8 lg:mr-24 w-full max-w-lg glass-card rounded-2xl p-8 md:p-10 card-hover">
                <p className="font-['IBM_Plex_Mono'] text-xs text-[#FFBF00] uppercase tracking-[0.2em] mb-4">Campus Overview</p>
                <h2 className="font-['Sora'] font-bold text-2xl md:text-4xl text-[#F4F6F8] leading-tight mb-4">
                    Every desk has a story.{' '}
                    <span className="text-[#FFBF00]">We build the chapter.</span>
                </h2>
                <p className="font-['Inter'] text-[#A7AFBA] text-base leading-relaxed mb-8">
                    Our 50,000 sq ft campus comes fully loaded — high-speed fiber, 24/7 security, meeting rooms, cafeteria, and concierge support.
                </p>
                <button
                    onClick={() => { const el = document.querySelector('#amenities'); el?.scrollIntoView({ behavior: 'smooth' }) }}
                    className="btn-primary px-6 py-3.5 rounded-xl font-['Inter'] font-semibold text-sm flex items-center gap-2 group w-full justify-center">
                    <ClipboardCheck className="w-4 h-4" /> See Amenities
                </button>
            </div>
        </section>
    );
}
