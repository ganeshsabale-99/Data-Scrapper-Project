const testimonials = [
    {
        quote: "Before this platform, we were tracking tech parks in Excel sheets. Now I can log a contact, schedule a follow-up, and see my whole pipeline in one place.",
        name: "Priya Menon",
        role: "City Sales Lead",
        initials: "PM",
        color: "#34d399",
    },
    {
        quote: "The geo-scoped access is a game changer. My team in Pune only sees Pune data — no confusion, no noise. The contact pipeline is crystal clear.",
        name: "Rohit Desai",
        role: "State Operations Manager",
        initials: "RD",
        color: "#60a5fa",
    },
    {
        quote: "AI review summaries cut our data verification time by half. We can now process 3x more venues per week without compromising on data quality.",
        name: "Ananya Sharma",
        role: "Operations Analyst",
        initials: "AS",
        color: "#a78bfa",
    },
];

export default function TestimonialsSection() {
    return (
        <section className="bg-slate-900/50 py-24 px-6 border-t border-white/6">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-14">
                    <p className="font-['IBM_Plex_Mono'] text-xs text-[#FF7B00] uppercase tracking-widest mb-4">
                        From the Team
                    </p>
                    <h2 className="font-['Sora'] font-bold text-4xl md:text-5xl text-[#F4F6F8]">
                        What your colleagues say
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {testimonials.map(({ quote, name, role, initials, color }) => (
                        <div
                            key={name}
                            className="rounded-2xl border border-white/8 bg-slate-900 p-7 flex flex-col justify-between hover:border-white/14 transition-all"
                        >
                            <p className="font-['Inter'] text-[#A7AFBA] text-sm leading-relaxed mb-6">
                                "{quote}"
                            </p>
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-9 h-9 rounded-full flex items-center justify-center font-['Sora'] font-bold text-xs flex-shrink-0"
                                    style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}30` }}
                                >
                                    {initials}
                                </div>
                                <div>
                                    <div className="font-['Inter'] font-semibold text-[#F4F6F8] text-sm">{name}</div>
                                    <div className="font-['Inter'] text-[#64748b] text-xs">{role}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
