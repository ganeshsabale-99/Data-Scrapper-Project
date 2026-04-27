import { useEffect, useRef, useState } from 'react';
import { Globe2, Building2, MapPin, Briefcase } from 'lucide-react';

const coverageStats = [
    { value: '2,400+', label: 'Tech Parks', subLabel: 'across India', icon: Building2, color: '#60a5fa' },
    { value: '28', label: 'States Mapped', subLabel: 'full national coverage', icon: Globe2, color: '#60a5fa' },
    { value: '180+', label: 'Cities Indexed', subLabel: 'and growing', icon: MapPin, color: '#34d399' },
    { value: '8,500+', label: 'Companies Tracked', subLabel: 'inside tech parks', icon: Briefcase, color: '#f472b6' },
];

export default function SpacesSection() {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return (
        <section id="coverage" className="bg-slate-950 py-24 px-6 border-t border-white/6">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <p className="font-['IBM_Plex_Mono'] text-xs text-[#FF7B00] uppercase tracking-widest mb-4">
                        Platform Coverage
                    </p>
                    <h2 className="font-['Sora'] font-bold text-4xl md:text-5xl text-[#F4F6F8] mb-4">
                        India's most complete tech park dataset
                    </h2>
                    <p className="font-['Inter'] text-[#A7AFBA] text-lg max-w-xl mx-auto">
                        Continuously updated data on tech parks, coworking spaces, and the companies inside them.
                    </p>
                </div>

                <div
                    ref={ref}
                    className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                >
                    {coverageStats.map(({ value, label, subLabel, icon: Icon, color }) => (
                        <div
                            key={label}
                            className="group rounded-2xl border border-white/8 bg-slate-900 p-7 text-center hover:border-white/16 transition-all hover:bg-slate-800"
                        >
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                                style={{ backgroundColor: `${color}15`, border: `1px solid ${color}25` }}
                            >
                                <Icon className="w-5 h-5" style={{ color }} />
                            </div>
                            <div
                                className="font-['Sora'] font-bold text-4xl mb-1"
                                style={{ color }}
                            >
                                {value}
                            </div>
                            <div className="font-['Inter'] font-semibold text-[#F4F6F8] text-sm mb-1">{label}</div>
                            <div className="font-['Inter'] text-[#64748b] text-xs">{subLabel}</div>
                        </div>
                    ))}
                </div>

                {/* India map placeholder bar */}
                <div className="mt-12 rounded-2xl border border-white/8 bg-slate-900 p-6 flex flex-col md:flex-row items-center gap-6">
                    <div className="flex-1">
                        <h3 className="font-['Sora'] font-semibold text-[#F4F6F8] text-lg mb-2">
                            Geo-scoped access for your team
                        </h3>
                        <p className="font-['Inter'] text-[#64748b] text-sm leading-relaxed">
                            Every team member sees data filtered to their assigned geography — National, State, or City level — ensuring focus and data hygiene across your organization.
                        </p>
                    </div>
                    <div className="flex gap-3 flex-shrink-0">
                        {['National', 'State', 'City'].map((scope) => (
                            <div
                                key={scope}
                                className="px-4 py-2.5 rounded-xl border border-white/10 bg-slate-950 text-center"
                            >
                                <div className="font-['IBM_Plex_Mono'] text-[10px] text-[#FF7B00] uppercase tracking-wider">{scope}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
