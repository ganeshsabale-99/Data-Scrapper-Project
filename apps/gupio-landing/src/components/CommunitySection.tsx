import { Users } from 'lucide-react';
import { toast } from 'sonner';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const stats = [
    { value: '200+', label: 'Companies' },
    { value: '5,000+', label: 'Professionals' },
    { value: '98%', label: 'Renewal Rate' },
];

export default function CommunitySection() {
    const cardRef = useScrollAnimation();

    return (
        <section id="community" className="relative min-h-screen flex items-center overflow-hidden">
            <img
                src="https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=1600&q=80"
                alt="Community networking"
                className="absolute inset-0 w-full h-full object-cover cinematic-grade"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-[#0B0C0F]/80 via-[#0B0C0F]/40 to-transparent" />

            {/* Content — right side */}
            <div ref={cardRef} className="relative z-10 ml-auto mr-6 lg:mr-24 w-full max-w-lg glass-card rounded-2xl p-8 md:p-10 card-hover">
                <p className="font-['IBM_Plex_Mono'] text-xs text-[#FFBF00] uppercase tracking-[0.2em] mb-4">Community</p>
                <h2 className="font-['Sora'] font-bold text-3xl md:text-4xl text-[#F4F6F8] leading-tight mb-4">
                    Join <span className="text-[#FFBF00]">200+ companies</span>
                </h2>
                <p className="font-['Inter'] text-[#A7AFBA] text-base leading-relaxed mb-8">
                    From funded startups to Fortune 500 teams, Gupio Tech Park is where ambition meets action. Regular events, mentorship, and a network that works.
                </p>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-4 mb-8 py-6 border-t border-b border-white/10">
                    {stats.map(({ value, label }) => (
                        <div key={label} className="text-center">
                            <p className="font-['IBM_Plex_Mono'] text-2xl font-bold text-[#FFBF00]">{value}</p>
                            <p className="font-['Inter'] text-xs text-[#A7AFBA] mt-1">{label}</p>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => toast.success('Welcome to the Gupio community!', { description: 'We\'ll send you details about upcoming events.' })}
                    className="btn-primary w-full py-3.5 rounded-xl font-['Inter'] font-semibold text-sm flex items-center justify-center gap-2">
                    <Users className="w-4 h-4" /> Join the Community
                </button>
            </div>
        </section>
    );
}
