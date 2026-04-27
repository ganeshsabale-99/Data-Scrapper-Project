import { useEffect, useRef, useState } from 'react';
import { TrendingUp, Settings, Shield } from 'lucide-react';

const teams = [
    {
        icon: TrendingUp,
        color: '#34d399',
        name: 'Sales Team',
        tagline: 'Find, contact, and close',
        access: [
            'Browse tech parks by city/state',
            'Log calls, emails, visits',
            'Track pipeline stages',
            'Monitor funding news leads',
            'View contact history',
        ],
        scope: 'City / State Level',
    },
    {
        icon: Settings,
        color: '#a78bfa',
        name: 'Operations Team',
        tagline: 'Verify, enrich, and report',
        access: [
            'Full national data access',
            'AI review & quality scoring',
            'Verify and approve tech parks',
            'Generate coverage reports',
            'Manage data integrity',
        ],
        scope: 'National Level',
    },
    {
        icon: Shield,
        color: '#fb923c',
        name: 'Admin',
        tagline: 'Configure and control',
        access: [
            'Manage users & approvals',
            'Configure departments & roles',
            'Assign permissions & access scopes',
            'View system activity logs',
            'Full platform access',
        ],
        scope: 'Full Access',
    },
];

export default function CommunitySection() {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.15 });
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return (
        <section id="team-access" className="bg-slate-950 py-24 px-6 border-t border-white/6">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <p className="font-['IBM_Plex_Mono'] text-xs text-[#FF7B00] uppercase tracking-widest mb-4">
                        Team Access
                    </p>
                    <h2 className="font-['Sora'] font-bold text-4xl md:text-5xl text-[#F4F6F8] mb-4">
                        The right access for every role
                    </h2>
                    <p className="font-['Inter'] text-[#A7AFBA] text-lg max-w-xl mx-auto">
                        Granular role-based permissions ensure each team has exactly the tools and data they need.
                    </p>
                </div>

                <div
                    ref={ref}
                    className={`grid grid-cols-1 md:grid-cols-3 gap-5 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                >
                    {teams.map(({ icon: Icon, color, name, tagline, access, scope }) => (
                        <div
                            key={name}
                            className="rounded-2xl border border-white/8 bg-slate-900 p-7 hover:border-white/16 transition-all hover:bg-slate-800"
                        >
                            <div className="flex items-center gap-3 mb-5">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ backgroundColor: `${color}15`, border: `1px solid ${color}25` }}
                                >
                                    <Icon className="w-4.5 h-4.5" style={{ color }} />
                                </div>
                                <div>
                                    <h3 className="font-['Sora'] font-semibold text-[#F4F6F8] text-sm">{name}</h3>
                                    <p className="font-['Inter'] text-[#64748b] text-xs">{tagline}</p>
                                </div>
                            </div>

                            <ul className="space-y-2.5 mb-5">
                                {access.map((item) => (
                                    <li key={item} className="flex items-start gap-2">
                                        <div
                                            className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                                            style={{ backgroundColor: color }}
                                        />
                                        <span className="font-['Inter'] text-[#A7AFBA] text-xs leading-relaxed">{item}</span>
                                    </li>
                                ))}
                            </ul>

                            <div
                                className="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-['IBM_Plex_Mono'] border"
                                style={{ color, borderColor: `${color}35`, backgroundColor: `${color}10` }}
                            >
                                {scope}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
