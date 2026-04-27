import { Phone, FileText, Handshake } from 'lucide-react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const steps = [
    {
        num: '01',
        icon: Phone,
        title: 'Schedule a Visit',
        desc: 'Pick a slot. Our team gives you a full campus tour and answers every question.',
    },
    {
        num: '02',
        icon: FileText,
        title: 'Choose Your Space',
        desc: 'Select the plan that fits — hot desk, dedicated desk, private cabin, or full floor.',
    },
    {
        num: '03',
        icon: Handshake,
        title: 'Move In & Scale',
        desc: 'Agreement, setup, and access card — ready in 72 hours. We handle the rest.',
    },
];

export default function HowItWorksSection() {
    const headerRef = useScrollAnimation();

    return (
        <section className="py-24 px-6 bg-[#14171C]">
            <div className="max-w-6xl mx-auto">
                <div ref={headerRef} className="text-center mb-16">
                    <p className="font-['IBM_Plex_Mono'] text-xs text-[#FFBF00] uppercase tracking-[0.2em] mb-3">Process</p>
                    <h2 className="font-['Sora'] font-bold text-3xl md:text-4xl text-[#F4F6F8] mb-3">
                        How <span className="text-[#FFBF00]">Tech Park</span> works
                    </h2>
                    <p className="font-['Inter'] text-[#A7AFBA] text-base">
                        From inquiry to move-in — in 72 hours.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 relative">
                    {/* Horizontal amber line between cards */}
                    <div className="hidden md:block absolute top-1/3 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-[#FFBF00]/30 to-transparent" />

                    {steps.map(({ num, icon: Icon, title, desc }, i) => (
                        <div
                            key={num}
                            className="card-hover border border-white/8 rounded-2xl p-8 bg-[#0B0C0F]/60 group"
                            style={{ transition: 'all 0.4s ease', transitionDelay: `${100 + i * 100}ms` }}>
                            {/* Large faded number */}
                            <div className="font-['Sora'] text-7xl font-bold text-white/5 mb-2 -mt-2 select-none">{num}</div>
                            <div className="w-10 h-10 rounded-xl bg-[#FFBF00]/10 flex items-center justify-center mb-4 group-hover:bg-[#FFBF00]/20 transition-colors">
                                <Icon className="w-5 h-5 text-[#FFBF00]" />
                            </div>
                            <h3 className="font-['Sora'] font-bold text-xl text-[#F4F6F8] mb-2">{title}</h3>
                            <p className="font-['Inter'] text-[#A7AFBA] text-sm leading-relaxed">{desc}</p>
                            {/* Amber bottom border on hover */}
                            <div className="mt-6 h-0.5 w-0 group-hover:w-full bg-[#FFBF00] transition-all duration-500" />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
