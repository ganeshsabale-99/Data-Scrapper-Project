import { useEffect, useRef, useState } from 'react';
import { Search, PhoneCall, CalendarCheck, TrendingUp, ClipboardCheck, Cpu, FileBarChart2, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const salesSteps = [
    { icon: Search, label: 'Discover', desc: 'Search tech parks & coworking spaces by city, state, or keyword.' },
    { icon: PhoneCall, label: 'Reach Out', desc: 'Log calls, emails, and meetings. Update pipeline status in real-time.' },
    { icon: CalendarCheck, label: 'Schedule', desc: 'Book site visits and demos. Set follow-up reminders with due dates.' },
    { icon: TrendingUp, label: 'Close Deals', desc: 'Move prospects through the pipeline and mark them as Closed.' },
];

const opsSteps = [
    { icon: ClipboardCheck, label: 'Verify Data', desc: 'Review AI-flagged venues for accuracy and completeness.' },
    { icon: Cpu, label: 'AI Review', desc: 'Run AI summaries on venue profiles to catch duplicates and errors.' },
    { icon: FileBarChart2, label: 'Report', desc: 'Generate coverage and activity reports across states and cities.' },
    { icon: Users, label: 'Manage Teams', desc: 'Configure RBAC departments, roles, and geo-level access permissions.' },
];

function StepCard({ icon: Icon, label, desc, index }: { icon: LucideIcon; label: string; desc: string; index: number }) {
    return (
        <div className="flex gap-4">
            <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-xl bg-[#FF7B00]/10 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4.5 h-4.5 text-[#FF7B00]" />
                </div>
                {index < 3 && <div className="w-px flex-1 bg-gradient-to-b from-blue-500/20 to-transparent mt-2" />}
            </div>
            <div className="pb-8">
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-['IBM_Plex_Mono'] text-[10px] text-[#FF7B00] opacity-60">0{index + 1}</span>
                    <h4 className="font-['Sora'] font-semibold text-[#F4F6F8] text-sm">{label}</h4>
                </div>
                <p className="font-['Inter'] text-[#64748b] text-sm leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}

export default function HowItWorksSection() {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return (
        <section id="how-it-works" className="bg-slate-900/50 py-24 px-6 border-t border-white/6">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <p className="font-['IBM_Plex_Mono'] text-xs text-[#FF7B00] uppercase tracking-widest mb-4">Workflow</p>
                    <h2 className="font-['Sora'] font-bold text-4xl md:text-5xl text-[#F4F6F8] mb-4">
                        Built for your team's workflow
                    </h2>
                    <p className="font-['Inter'] text-[#A7AFBA] text-lg max-w-xl mx-auto">
                        Tailored experiences for Sales and Operations — each role gets exactly what they need.
                    </p>
                </div>

                <div
                    ref={ref}
                    className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                >
                    {/* Sales Column */}
                    <div className="rounded-2xl border border-white/8 bg-slate-900 p-8">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-8 h-8 rounded-lg bg-[#34d399]/15 border border-[#34d399]/25 flex items-center justify-center">
                                <TrendingUp className="w-4 h-4 text-[#34d399]" />
                            </div>
                            <div>
                                <h3 className="font-['Sora'] font-semibold text-[#F4F6F8] text-base">Sales Team</h3>
                                <p className="font-['Inter'] text-[#64748b] text-xs">Prospecting → Pipeline → Close</p>
                            </div>
                        </div>
                        {salesSteps.map((step, i) => (
                            <StepCard key={step.label} {...step} index={i} />
                        ))}
                    </div>

                    {/* Ops Column */}
                    <div className="rounded-2xl border border-white/8 bg-slate-900 p-8">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-8 h-8 rounded-lg bg-[#a78bfa]/15 border border-[#a78bfa]/25 flex items-center justify-center">
                                <ClipboardCheck className="w-4 h-4 text-[#a78bfa]" />
                            </div>
                            <div>
                                <h3 className="font-['Sora'] font-semibold text-[#F4F6F8] text-base">Operations Team</h3>
                                <p className="font-['Inter'] text-[#64748b] text-xs">Verify → Enrich → Report</p>
                            </div>
                        </div>
                        {opsSteps.map((step, i) => (
                            <StepCard key={step.label} {...step} index={i} />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
