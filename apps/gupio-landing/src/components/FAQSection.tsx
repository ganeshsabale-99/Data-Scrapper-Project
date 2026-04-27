import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const faqs = [
    {
        q: 'What is included in the monthly membership?',
        a: 'All plans include high-speed internet, 24/7 access, cafeteria access, security, and electricity. Meeting rooms and additional services vary by plan.',
    },
    {
        q: 'Can I upgrade my plan as my team grows?',
        a: 'Yes, you can upgrade at any time with just 7 days notice. We will allocate the new space and adjust billing from the next cycle.',
    },
    {
        q: 'Is there a security deposit?',
        a: 'We require a 2-month refundable security deposit for all plans.',
    },
    {
        q: 'Do you offer custom enterprise floors?',
        a: 'Yes, for teams of 50+, we offer fully customizable floors with dedicated infrastructure, branding, and a dedicated account manager.',
    },
    {
        q: 'How quickly can we move in?',
        a: 'Typically within 72 hours of signing the agreement. Hot desks can be activated the same day.',
    },
];

export default function FAQSection() {
    const headerRef = useScrollAnimation();

    return (
        <section className="py-24 px-6 bg-[#0B0C0F]">
            <div className="max-w-2xl mx-auto">
                <div ref={headerRef} className="text-center mb-12">
                    <p className="font-['IBM_Plex_Mono'] text-xs text-[#FFBF00] uppercase tracking-[0.2em] mb-3">FAQ</p>
                    <h2 className="font-['Sora'] font-bold text-3xl md:text-4xl text-[#F4F6F8] mb-3">
                        <span className="text-[#FFBF00]">Common questions</span>
                    </h2>
                    <p className="font-['Inter'] text-[#A7AFBA] text-base">Everything you need to know about Gupio Tech Park.</p>
                </div>

                <Accordion.Root type="multiple" className="space-y-3">
                    {faqs.map(({ q, a }) => (
                        <Accordion.Item key={q} value={q}
                            className="border border-white/8 rounded-xl bg-[#14171C]/60 overflow-hidden group data-[state=open]:border-[#FFBF00]/30 transition-all">
                            <Accordion.Trigger className="w-full flex items-center justify-between px-6 py-5 text-left group-hover:bg-white/3 transition-colors">
                                <span className="font-['Inter'] font-semibold text-sm text-[#F4F6F8]">{q}</span>
                                <ChevronDown className="w-4 h-4 text-[#A7AFBA] transition-transform duration-300 data-[state=open]:rotate-180 flex-shrink-0 ml-4" />
                            </Accordion.Trigger>
                            <Accordion.Content className="overflow-hidden data-[state=open]:animate-[slideDown_0.3s_ease] data-[state=closed]:animate-[slideUp_0.3s_ease]">
                                <p className="font-['Inter'] text-[#A7AFBA] text-sm leading-relaxed px-6 pb-5">{a}</p>
                            </Accordion.Content>
                        </Accordion.Item>
                    ))}
                </Accordion.Root>
            </div>
        </section>
    );
}
