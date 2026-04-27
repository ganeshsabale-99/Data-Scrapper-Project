import { useEffect, useRef, useState } from 'react';
import { Building2, Layers, PhoneCall, Newspaper, Sparkles, ShieldCheck } from 'lucide-react';

const features = [
    {
        icon: Building2,
        title: 'Tech Park Database',
        description:
            'Comprehensive directory of tech parks across India. Search by city, state, tenant signals, amenities, and business status with powerful filters.',
        tag: 'Sales & Ops',
        color: '#60a5fa',
    },
    {
        icon: Layers,
        title: 'Coworking Space Tracker',
        description:
            'Track coworking operators, their venues, and tenant companies. Log visits, verify data, and manage outreach pipelines seamlessly.',
        tag: 'Sales',
        color: '#60a5fa',
    },
    {
        icon: PhoneCall,
        title: 'Contact & Visit Logs',
        description:
            'Log every call, email, meeting, and site visit. Track pipeline stages from Not Contacted → Meeting Scheduled → Closed with follow-up reminders.',
        tag: 'Sales',
        color: '#34d399',
    },
    {
        icon: Newspaper,
        title: 'Funding News & Leads',
        description:
            'Monitor startup funding rounds from YourStory, Inc42, Entrackr, and more. Turn funding signals into qualified leads instantly.',
        tag: 'Sales',
        color: '#f472b6',
    },
    {
        icon: Sparkles,
        title: 'AI Review Summaries',
        description:
            'AI-powered data quality reviews flag inconsistencies, score confidence, and summarize venue details — saving hours of manual verification.',
        tag: 'Operations',
        color: '#a78bfa',
    },
    {
        icon: ShieldCheck,
        title: 'Role-Based Access Control',
        description:
            'Granular permissions by department and role. National, State, and City-level access scopes ensure the right team sees the right data.',
        tag: 'Admin',
        color: '#fb923c',
    },
];

function FeatureCard({
    icon: Icon,
    title,
    description,
    tag,
    color,
    delay,
}: (typeof features)[0] & { delay: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setTimeout(() => setVisible(true), delay);
                }
            },
            { threshold: 0.1 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [delay]);

    return (
        <div
            ref={ref}
            className={`group relative rounded-2xl border border-white/8 bg-slate-900 p-6 hover:border-white/16 transition-all duration-500 hover:bg-slate-800 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
            style={{ transition: `opacity 0.6s ease, transform 0.6s ease, border-color 0.3s, background 0.3s` }}
        >
            {/* Glow on hover */}
            <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ boxShadow: `inset 0 0 30px ${color}10` }}
            />

            <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 flex-shrink-0"
                style={{ backgroundColor: `${color}15`, border: `1px solid ${color}25` }}
            >
                <Icon className="w-5 h-5" style={{ color }} />
            </div>

            <div className="flex items-start justify-between mb-2">
                <h3 className="font-['Sora'] font-semibold text-[#F4F6F8] text-base">{title}</h3>
                <span
                    className="text-[10px] font-['IBM_Plex_Mono'] px-2 py-0.5 rounded-full border flex-shrink-0 ml-2"
                    style={{ color, borderColor: `${color}40`, backgroundColor: `${color}10` }}
                >
                    {tag}
                </span>
            </div>

            <p className="font-['Inter'] text-[#64748b] text-sm leading-relaxed">{description}</p>
        </div>
    );
}

export default function FeatureSection() {
    return (
        <section id="features" className="bg-slate-950 py-24 px-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <p className="font-['IBM_Plex_Mono'] text-xs text-[#FF7B00] uppercase tracking-widest mb-4">
                        Platform Modules
                    </p>
                    <h2 className="font-['Sora'] font-bold text-4xl md:text-5xl text-[#F4F6F8] mb-4">
                        Everything your team needs
                    </h2>
                    <p className="font-['Inter'] text-[#A7AFBA] text-lg max-w-xl mx-auto">
                        Six powerful modules built for the way your sales and operations teams actually work.
                    </p>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {features.map((feature, i) => (
                        <FeatureCard key={feature.title} {...feature} delay={i * 80} />
                    ))}
                </div>
            </div>
        </section>
    );
}
