import { useRef, useEffect, useState } from 'react';
import { Download, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const checklist = [
    'High-Speed Fiber (1 Gbps)',
    '24/7 Security & CCTV',
    'Meeting Rooms (fully equipped)',
    'Cafeteria & Pantry',
    'Power Backup (100%)',
    'EV Charging Points',
];

export default function AmenitiesSection() {
    const cardRef = useScrollAnimation();
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
        <section id="amenities" ref={sectionRef} className="relative min-h-screen flex items-center overflow-hidden">
            <img
                src="https://images.unsplash.com/photo-1600607687643-6f2c0a0f7a35?w=1600&q=80"
                alt="Campus amenities"
                className="absolute inset-0 w-full h-full object-cover cinematic-grade"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B0C0F]/60 to-[#0B0C0F]/20" />

            {/* Animated SVG accent line */}
            <svg className="absolute bottom-1/3 left-0 w-full" viewBox="0 0 1200 60" preserveAspectRatio="none" height="60">
                <path
                    d="M 0 40 Q 400 10 800 40 Q 1000 60 1200 30"
                    className="accent-line"
                    style={{
                        strokeDasharray: 1500,
                        strokeDashoffset: lineDrawn ? 0 : 1500,
                        transition: 'stroke-dashoffset 1.5s ease-out',
                        filter: 'drop-shadow(0 0 8px rgba(255,191,0,0.5))',
                    }}
                />
            </svg>

            {/* Floating glass card — bottom right */}
            <div ref={cardRef} className="relative z-10 ml-auto mr-8 lg:mr-24 w-full max-w-md glass-card rounded-2xl p-8 card-hover">
                <p className="font-['IBM_Plex_Mono'] text-xs text-[#FFBF00] uppercase tracking-[0.2em] mb-4">Campus Amenities</p>
                <h2 className="font-['Sora'] font-bold text-2xl md:text-3xl text-[#F4F6F8] leading-tight mb-4">
                    Everything you need.{' '}
                    <span className="text-[#FFBF00]">Nothing you don't.</span>
                </h2>

                <div className="space-y-3 mb-8">
                    {checklist.map(item => (
                        <div key={item} className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full bg-[#FFBF00]/15 flex items-center justify-center flex-shrink-0">
                                <Check className="w-3 h-3 text-[#FFBF00]" />
                            </div>
                            <span className="font-['Inter'] text-sm text-[#F4F6F8]">{item}</span>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => toast.info('Brochure download starting…', { description: 'Full campus brochure (PDF, 4.2 MB)' })}
                    className="btn-primary w-full py-3.5 rounded-xl font-['Inter'] font-semibold text-sm flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" /> Download Brochure
                </button>
            </div>
        </section>
    );
}
