import { Building2, Instagram, Linkedin, Youtube } from 'lucide-react';
import { toast } from 'sonner';

const links = {
    Spaces: ['Hot Desk', 'Dedicated Desk', 'Private Cabin', 'Virtual Office'],
    Company: ['About Us', 'Careers', 'Blog', 'Press'],
    Resources: ['Campus Tour', 'Brochure', 'Events', 'Community'],
    Legal: ['Privacy Policy', 'Terms', 'Cookie Policy'],
};

export default function Footer() {
    return (
        <footer className="bg-[#0B0C0F] border-t border-white/5 pt-16 pb-8 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-10 mb-12">
                    {/* Brand */}
                    <div className="col-span-2">
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-9 h-9 bg-[#FFBF00] rounded-xl flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-[#0B0C0F]" />
                            </div>
                            <span className="font-['Sora'] font-bold text-lg">
                                <span className="text-[#FFBF00]">Gupio</span>{' '}
                                <span className="text-[#F4F6F8]">Tech Park</span>
                            </span>
                        </div>
                        <p className="font-['Inter'] text-[#A7AFBA] text-sm leading-relaxed mb-5 max-w-xs">
                            Built for Builders. Designed for Growth. India's most connected tech campus.
                        </p>
                        <div className="space-y-1.5">
                            <p className="font-['Inter'] text-xs text-[#A7AFBA]">support@gupiotechpark.in</p>
                            <p className="font-['Inter'] text-xs text-[#A7AFBA]">+91-8446784175</p>
                            <p className="font-['Inter'] text-xs text-[#A7AFBA]">Bangalore, India</p>
                        </div>
                    </div>

                    {/* Link columns */}
                    {Object.entries(links).map(([title, items]) => (
                        <div key={title}>
                            <h4 className="font-['Sora'] font-semibold text-xs text-[#F4F6F8] uppercase tracking-[0.15em] mb-4">{title}</h4>
                            <ul className="space-y-2.5">
                                {items.map(item => (
                                    <li key={item}>
                                        <a href="#" onClick={e => { e.preventDefault(); toast.info(`${item} — coming soon`) }}
                                            className="font-['Inter'] text-sm text-[#A7AFBA] hover:text-[#F4F6F8] transition-colors">
                                            {item}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom bar */}
                <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="font-['Inter'] text-xs text-[#A7AFBA]">
                        © {new Date().getFullYear()} Gupio Tech Park. All rights reserved.
                    </p>
                    <div className="flex items-center gap-3">
                        {[
                            { Icon: Instagram, label: 'Instagram' },
                            { Icon: Linkedin, label: 'LinkedIn' },
                            { Icon: Youtube, label: 'YouTube' },
                        ].map(({ Icon, label }) => (
                            <button
                                key={label}
                                onClick={() => toast.info(`Follow us on ${label}!`)}
                                className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center text-[#A7AFBA] hover:text-[#FFBF00] hover:border-[#FFBF00]/30 transition-all">
                                <Icon className="w-4 h-4" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}
