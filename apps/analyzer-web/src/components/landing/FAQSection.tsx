import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqs = [
    {
        q: 'How do I get access to the platform?',
        a: 'Contact your team admin or manager to create an account for you. Once created, you will receive login credentials and be assigned to your department with the appropriate access level.',
    },
    {
        q: 'What is the difference between Sales and Operations access?',
        a: 'Sales team members typically have City or State-level access to log contacts and manage pipelines. Operations team members have National-level access for data verification, AI review, and reporting. Your admin configures this when creating your role.',
    },
    {
        q: 'How does geo-scoped access work?',
        a: 'Your admin assigns your account a geographic scope (National, State, or City). You will only see tech parks, coworking spaces, and contact logs within your assigned geography — keeping dashboards focused and clutter-free.',
    },
    {
        q: 'How does contact log tracking work?',
        a: 'Each tech park or coworking space has a contact log where you can add calls, emails, meetings, and site visits. You can set a status (Not Contacted, Interested, Proposal Sent, etc.) and set follow-up reminders to ensure nothing falls through the cracks.',
    },
    {
        q: 'What is the AI Review Summary feature?',
        a: 'The AI review system analyzes venue data, detects potential duplicates, scores data confidence, and gives a structured summary. Operations team members can then review and mark venues as Approved or Rejected based on this assessment.',
    },
    {
        q: 'Can I export or report on my contacts?',
        a: 'Yes. The Reports section allows Operations and Admin users to view activity summaries, contact conversion rates, and coverage metrics across geographies.',
    },
];

function FAQItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="border-b border-white/8 last:border-0">
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-start justify-between py-5 text-left gap-4 group"
            >
                <span className="font-['Inter'] font-medium text-[#F4F6F8] text-sm leading-relaxed">{q}</span>
                <ChevronDown
                    className={`w-4 h-4 text-[#64748b] flex-shrink-0 mt-0.5 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                />
            </button>
            <div
                className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-48 pb-5' : 'max-h-0'}`}
            >
                <p className="font-['Inter'] text-[#A7AFBA] text-sm leading-relaxed">{a}</p>
            </div>
        </div>
    );
}

export default function FAQSection() {
    return (
        <section id="faq" className="bg-slate-950 py-24 px-6 border-t border-white/6">
            <div className="max-w-3xl mx-auto">
                <div className="text-center mb-14">
                    <p className="font-['IBM_Plex_Mono'] text-xs text-[#FF7B00] uppercase tracking-widest mb-4">FAQ</p>
                    <h2 className="font-['Sora'] font-bold text-4xl md:text-5xl text-[#F4F6F8] mb-4">
                        Frequently asked questions
                    </h2>
                    <p className="font-['Inter'] text-[#A7AFBA] text-lg">
                        Everything your team needs to know to get started.
                    </p>
                </div>

                <div className="rounded-2xl border border-white/8 bg-slate-900 px-8">
                    {faqs.map((faq) => (
                        <FAQItem key={faq.q} {...faq} />
                    ))}
                </div>
            </div>
        </section>
    );
}
