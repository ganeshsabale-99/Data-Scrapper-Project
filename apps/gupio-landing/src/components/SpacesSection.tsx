import { Search, Wifi, Users, Clock, Shield, Coffee, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const specs = [
    { icon: Wifi, label: 'Internet', value: '1 Gbps Fiber' },
    { icon: Users, label: 'Capacity', value: '2–200 Seats' },
    { icon: Clock, label: 'Access', value: '24/7 Access' },
    { icon: Shield, label: 'Security', value: 'CCTV + Guards' },
    { icon: Coffee, label: 'Dining', value: 'Cafeteria Incl.' },
    { icon: Star, label: 'Rating', value: '4.9/5 Stars' },
];

export default function SpacesSection() {
    const cardRef = useScrollAnimation();

    return (
        <section id="spaces" className="relative min-h-screen flex items-center overflow-hidden">
            <img
                src="https://images.unsplash.com/photo-1604328698692-f76ea9498e76?w=1600&q=80"
                alt="Private office"
                className="absolute inset-0 w-full h-full object-cover cinematic-grade"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0B0C0F]/80 via-[#0B0C0F]/40 to-transparent" />

            {/* Glass spec card — left side */}
            <div ref={cardRef} className="relative z-10 ml-6 lg:ml-24 w-full max-w-md glass-card rounded-2xl p-8 card-hover">
                <p className="font-['IBM_Plex_Mono'] text-xs text-[#FFBF00] uppercase tracking-[0.2em] mb-4">Our Spaces</p>
                <h2 className="font-['Sora'] font-bold text-3xl md:text-4xl text-[#F4F6F8] leading-tight mb-3">
                    Work in your <span className="text-[#FFBF00]">element.</span>
                </h2>
                <p className="font-['Inter'] text-[#A7AFBA] text-sm leading-relaxed mb-6">
                    From hot desks to dedicated suites — every space is designed for focus, collaboration, and scale.
                </p>

                {/* Spec grid */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {specs.map(({ icon: Icon, label, value }) => (
                        <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                            <Icon className="w-4 h-4 text-[#FFBF00] mx-auto mb-1.5" />
                            <p className="font-['IBM_Plex_Mono'] text-[10px] text-[#A7AFBA] mb-0.5">{label}</p>
                            <p className="font-['Inter'] text-xs font-semibold text-[#F4F6F8]">{value}</p>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => toast.info('Explore all space configurations', { description: 'Hot Desk, Dedicated Desk, Private Cabin, Full Floor' })}
                    className="btn-primary w-full py-3.5 rounded-xl font-['Inter'] font-semibold text-sm flex items-center justify-center gap-2">
                    <Search className="w-4 h-4" /> Explore Spaces
                </button>
            </div>
        </section>
    );
}
