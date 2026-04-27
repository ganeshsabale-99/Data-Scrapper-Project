import { Link } from 'react-router';
import { ArrowRight, BarChart3 } from 'lucide-react';

export default function FinalCTASection() {
    return (
        <section className="bg-slate-950 py-28 px-6 border-t border-white/6">
            <div className="max-w-3xl mx-auto text-center">
                {/* Subtle glow */}
                <div className="absolute inset-x-0 flex justify-center pointer-events-none -z-0">
                    <div className="w-96 h-48 rounded-full bg-[#FFBF00]/8 blur-[80px]" />
                </div>

                <div className="relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-[#FFBF00] flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(37,99,235,0.3)]">
                        <BarChart3 className="w-6 h-6 text-white" strokeWidth={2.5} />
                    </div>

                    <h2 className="font-['Sora'] font-bold text-4xl md:text-5xl text-[#F4F6F8] mb-5 leading-tight">
                        Ready to start analyzing?
                    </h2>

                    <p className="font-['Inter'] text-[#A7AFBA] text-lg leading-relaxed max-w-xl mx-auto mb-10">
                        Sign in to your Gupio Tech Park Analyzer account and get back to what matters — finding, qualifying, and closing tech park opportunities.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            to="/login"
                            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#FFBF00] text-white font-['Inter'] font-bold text-base hover:bg-[#FF7B00] transition-all hover:scale-[1.02] active:scale-[0.98] group shadow-[0_0_30px_rgba(37,99,235,0.25)]"
                        >
                            Sign In to Your Account
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <a
                            href="mailto:admin@gupio.in"
                            className="inline-flex items-center justify-center px-8 py-4 rounded-xl border border-white/12 text-[#A7AFBA] font-['Inter'] font-semibold text-base hover:border-white/25 hover:text-[#F4F6F8] hover:bg-white/5 transition-all"
                        >
                            Request Access
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}
