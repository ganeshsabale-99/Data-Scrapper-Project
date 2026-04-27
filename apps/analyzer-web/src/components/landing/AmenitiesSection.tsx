import { useEffect, useRef, useState } from 'react';
import { Globe2, MapPin, BarChart3, ShieldCheck, Activity, Cpu } from 'lucide-react';

const capabilities = [
    {
        icon: Globe2,
        title: 'Geo-Scoped Dashboards',
        desc: 'National → State → City hierarchy. Each user sees only their assigned geography.',
    },
    {
        icon: Activity,
        title: 'Real-Time Contact Pipeline',
        desc: 'Track every touchpoint: Not Contacted → Interested → Proposal Sent → Closed.',
    },
    {
        icon: Cpu,
        title: 'AI-Assisted Quality Reviews',
        desc: 'Automated confidence scoring and review summaries for faster data verification.',
    },
    {
        icon: BarChart3,
        title: 'Activity Audit Logs',
        desc: 'Full audit trail of every create, update, and status change across all entities.',
    },
    {
        icon: ShieldCheck,
        title: 'Department & Role Management',
        desc: 'Granular RBAC with departments, roles, and permission inheritance.',
    },
    {
        icon: MapPin,
        title: 'Multi-Source Data',
        desc: 'Combine data from Google Maps, SPOC contacts, site visits, and funding signals.',
    },
];

export default function AmenitiesSection() {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return (
        <section id="capabilities" className="bg-slate-900/50 py-24 px-6 border-t border-white/6">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <p className="font-['IBM_Plex_Mono'] text-xs text-[#FF7B00] uppercase tracking-widest mb-4">
                        Capabilities
                    </p>
                    <h2 className="font-['Sora'] font-bold text-4xl md:text-5xl text-[#F4F6F8] mb-4">
                        Platform highlights
                    </h2>
                    <p className="font-['Inter'] text-[#A7AFBA] text-lg max-w-xl mx-auto">
                        The features that make your day-to-day operations faster, smarter, and more organized.
                    </p>
                </div>

                <div
                    ref={ref}
                    className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                >
                    {capabilities.map(({ icon: Icon, title, desc }) => (
                        <div
                            key={title}
                            className="flex gap-4 p-5 rounded-xl border border-white/8 bg-slate-900 hover:border-blue-500/20 hover:bg-slate-800 transition-all"
                        >
                            <div className="w-9 h-9 rounded-lg bg-[#FF7B00]/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Icon className="w-4 h-4 text-[#FF7B00]" />
                            </div>
                            <div>
                                <h4 className="font-['Sora'] font-semibold text-[#F4F6F8] text-sm mb-1">{title}</h4>
                                <p className="font-['Inter'] text-[#64748b] text-xs leading-relaxed">{desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
