import { Quote, Star } from 'lucide-react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const testimonials = [
    {
        quote: 'Moving into Gupio Tech Park was the best decision for our team. The infrastructure is flawless and the community is electric.',
        name: 'Arjun Mehta',
        role: 'CTO, FinStack AI',
        initials: 'AM',
    },
    {
        quote: 'We scaled from 5 to 50 people without changing our address. The team at Gupio made every transition seamless.',
        name: 'Sneha Reddy',
        role: 'Founder, UrbanLens',
        initials: 'SR',
    },
    {
        quote: 'The fiber is actually 1Gbps. The cafeteria food is genuinely good. And the events are real networking — not just pizza.',
        name: 'Vivek Iyer',
        role: 'Engineering Lead, Korrect',
        initials: 'VI',
    },
];

export default function TestimonialsSection() {
    const headerRef = useScrollAnimation();

    return (
        <section className="py-24 px-6 bg-[#14171C]">
            <div className="max-w-6xl mx-auto">
                <div ref={headerRef} className="text-center mb-16">
                    <p className="font-['IBM_Plex_Mono'] text-xs text-[#FFBF00] uppercase tracking-[0.2em] mb-3">Testimonials</p>
                    <h2 className="font-['Sora'] font-bold text-3xl md:text-4xl text-[#F4F6F8] mb-3">
                        What <span className="text-[#FFBF00]">companies say</span>
                    </h2>
                    <p className="font-['Inter'] text-[#A7AFBA] text-base">Real teams. Real growth. Real results.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {testimonials.map(({ quote, name, role, initials }, i) => (
                        <div
                            key={name}
                            className="glass-card card-hover rounded-2xl p-8 border border-white/6 flex flex-col"
                            style={{ transitionDelay: `${100 + i * 100}ms` }}>
                            <Quote className="w-8 h-8 text-[#FFBF00]/40 mb-4" />
                            <p className="font-['Inter'] text-[#A7AFBA] text-sm leading-relaxed flex-1 mb-6">"{quote}"</p>

                            {/* Stars */}
                            <div className="flex gap-1 mb-4">
                                {[...Array(5)].map((_, j) => (
                                    <Star key={j} className="w-3.5 h-3.5 text-[#FFBF00] fill-[#FFBF00]" />
                                ))}
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFBF00]/30 to-[#FFBF00]/10 flex items-center justify-center">
                                    <span className="font-['IBM_Plex_Mono'] text-xs font-bold text-[#FFBF00]">{initials}</span>
                                </div>
                                <div>
                                    <p className="font-['Inter'] font-semibold text-sm text-[#F4F6F8]">{name}</p>
                                    <p className="font-['Inter'] text-xs text-[#A7AFBA]">{role}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
