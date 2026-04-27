import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const plans = [
    {
        name: 'Hot Desk',
        price: '₹8,999',
        tagline: 'Flexible coworking',
        highlight: false,
        features: [
            'Any available desk',
            'High-speed internet',
            'Meeting room credits (4 hrs/mo)',
            'Cafeteria access',
            'Community events',
        ],
        cta: 'Book Hot Desk',
    },
    {
        name: 'Dedicated Desk',
        price: '₹15,999',
        tagline: 'Your own locked desk',
        highlight: true,
        badge: 'Most Popular',
        features: [
            'Everything in Hot Desk',
            'Reserved desk + locker',
            '8 hrs meeting room/mo',
            'Printing & scanning',
            'Priority support',
        ],
        cta: 'Book Dedicated',
    },
    {
        name: 'Private Cabin',
        price: '₹39,999',
        tagline: 'Full privacy for your team',
        highlight: false,
        features: [
            'Everything in Dedicated',
            'Private lockable cabin',
            'Unlimited meeting rooms',
            'Dedicated internet line',
            'Custom branding',
            'Concierge support',
        ],
        cta: 'Book Cabin',
    },
];

export default function PricingSection() {
    const headerRef = useScrollAnimation();

    return (
        <section id="pricing" className="py-24 px-6 bg-[#0B0C0F]">
            <div className="max-w-6xl mx-auto">
                <div ref={headerRef} className="text-center mb-16">
                    <p className="font-['IBM_Plex_Mono'] text-xs text-[#FFBF00] uppercase tracking-[0.2em] mb-3">Pricing</p>
                    <h2 className="font-['Sora'] font-bold text-3xl md:text-4xl text-[#F4F6F8] mb-3">
                        <span className="text-[#FFBF00]">Space packages</span>
                    </h2>
                    <p className="font-['Inter'] text-[#A7AFBA] text-base">Transparent pricing. No hidden fees.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {plans.map((plan, i) => (
                        <div
                            key={plan.name}
                            className={`card-hover rounded-2xl p-8 border flex flex-col ${plan.highlight
                                    ? 'border-[#FFBF00] bg-[#FFBF00]/5 relative'
                                    : 'border-white/8 bg-[#14171C]/60'
                                }`}
                            style={{ transitionDelay: `${100 + i * 100}ms` }}>

                            {plan.badge && (
                                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                                    <span className="bg-[#FFBF00] text-[#0B0C0F] text-xs font-bold font-['IBM_Plex_Mono'] px-4 py-1.5 rounded-full">
                                        {plan.badge}
                                    </span>
                                </div>
                            )}

                            <div className="mb-6">
                                <h3 className="font-['Sora'] font-bold text-xl text-[#F4F6F8] mb-1">{plan.name}</h3>
                                <p className="font-['Inter'] text-xs text-[#A7AFBA] mb-4">{plan.tagline}</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="font-['Sora'] font-bold text-4xl text-[#F4F6F8]">{plan.price}</span>
                                    <span className="font-['Inter'] text-[#A7AFBA] text-sm">/mo</span>
                                </div>
                            </div>

                            <ul className="space-y-3 flex-1 mb-8">
                                {plan.features.map(f => (
                                    <li key={f} className="flex items-start gap-2.5">
                                        <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.highlight ? 'text-[#FFBF00]' : 'text-[#A7AFBA]'}`} />
                                        <span className="font-['Inter'] text-sm text-[#A7AFBA]">{f}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => toast.success(`${plan.name} plan request sent!`, { description: 'Our team will contact you shortly.' })}
                                className={`w-full py-3.5 rounded-xl font-['Inter'] font-semibold text-sm transition-all ${plan.highlight
                                        ? 'btn-primary'
                                        : 'border border-white/10 text-[#F4F6F8] hover:border-white/20 hover:bg-white/5'
                                    }`}>
                                {plan.cta}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
