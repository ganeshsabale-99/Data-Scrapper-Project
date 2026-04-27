import { Mail } from 'lucide-react';
import { Link } from 'react-router';

export default function PricingSection() {
    return (
        <section className="bg-slate-900/50 py-20 px-6 border-t border-white/6">
            <div className="max-w-2xl mx-auto text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#FF7B00]/10 border border-blue-500/25 flex items-center justify-center mx-auto mb-6">
                    <Mail className="w-5 h-5 text-[#FF7B00]" />
                </div>
                <h2 className="font-['Sora'] font-bold text-3xl md:text-4xl text-[#F4F6F8] mb-4">
                    Need access?
                </h2>
                <p className="font-['Inter'] text-[#A7AFBA] text-base leading-relaxed mb-8 max-w-lg mx-auto">
                    This is an internal platform. If you don't have credentials yet, contact your team admin or manager to create your account and assign you to the right department and role.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <a
                        href="mailto:admin@gupio.in"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-blue-500/30 bg-[#FF7B00]/8 text-[#FF7B00] font-['Inter'] font-semibold text-sm hover:bg-[#FF7B00]/15 transition-all"
                    >
                        <Mail className="w-4 h-4" />
                        Contact Admin
                    </a>
                    <Link
                        to="/login"
                        className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[#FFBF00] text-white font-['Inter'] font-bold text-sm hover:bg-[#FF7B00] transition-all shadow-lg shadow-[#FFBF00]/20"
                    >
                        Already have an account? Sign In →
                    </Link>
                </div>
            </div>
        </section>
    );
}
