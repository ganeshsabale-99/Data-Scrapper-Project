import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginFormData } from "@/lib/validation";
import { loginWithPassword } from "@/lib/auth";
import { getCityBasedLandingPage } from "@/lib/token";
import {
  ArrowRight, Eye, EyeOff,
  Building2, PhoneCall, Globe2, TrendingUp,
} from "lucide-react";
import gupioLogo from "@/assets/images/gupioLogo.png";

const highlights = [
  { icon: Building2, text: "2,400+ Tech Parks across India" },
  { icon: Globe2, text: "National · State · City geo-scope" },
  { icon: PhoneCall, text: "Full contact & visit log pipeline" },
  { icon: TrendingUp, text: "Funding news → instant lead signals" },
];

export function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "all",
  });

  const email = watch("email");
  const password = watch("password");
  const isFormValid = Boolean(email && password);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const response = await loginWithPassword(data.email, data.password);
      if (response.success && response.mfaRequired) {
        toast.success("OTP sent to your registered email.");
        navigate("/verify-otp", {
          state: {
            email: response.user?.email || data.email,
            phoneNumber: response.user?.phoneNumber || "",
            deliveryAddress: response.deliveryAddress,
            verificationData: response.verificationData,
            otp: response.otp,
            mfaToken: response.mfaToken,
            flow: "mfa",
          },
        });
      } else if (response.success && response.sessionToken) {
        toast.success("Login successful!");
        navigate(getCityBasedLandingPage());
      } else {
        toast.error(
          response.code === "ACCOUNT_INACTIVE"
            ? "Your account isn't active yet."
            : response.message || "Login failed"
        );
      }
    } catch {
      toast.error("Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">

      {/* ─── LEFT PANEL ─── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden p-12 border-r border-slate-100 bg-white">
        {/* Grid bg */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(59 130 246 / 0.2) 1px, transparent 1px), linear-gradient(90deg, rgb(59 130 246 / 0.2) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
        {/* Blue glow */}
        <div className="absolute bottom-[-60px] left-[-60px] w-[500px] h-[500px] rounded-full bg-[#FFBF00]/10 blur-[120px] pointer-events-none" />
        {/* Top-right glow */}
        <div className="absolute top-[-80px] right-[-80px] w-[350px] h-[350px] rounded-full bg-indigo-600/8 blur-[100px] pointer-events-none" />

        {/* Logo */}
        <Link to="/" className="relative z-10 flex items-center gap-2.5 group">
          <div className="w-9 h-9 flex items-center justify-center transition-transform group-hover:scale-105">
            <img src={gupioLogo} alt="Gupio Logo" className="w-full h-full object-contain" />
          </div>
          <span className="font-['Sora'] font-bold text-slate-900 text-lg">
            Gupio <span className="text-[#FFBF00]">Analyzer</span>
          </span>
        </Link>

        {/* Main copy */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-12">
          <p className="font-['IBM_Plex_Mono'] text-[11px] text-[#FFBF00] uppercase tracking-widest mb-4">
            Operations Intelligence Platform
          </p>
          <h2 className="font-['Sora'] font-bold text-4xl xl:text-5xl text-slate-900 leading-[1.1] mb-5">
            Command Center for<br />
            <span className="text-[#FFBF00]">Tech Park</span> Teams
          </h2>
          <p className="font-['Inter'] text-slate-600 text-base leading-relaxed max-w-sm mb-10">
            Everything your Sales and Operations teams need to discover, qualify, and close tech park opportunities — in one place.
          </p>

          {/* Feature list */}
          <ul className="space-y-3.5">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#FFBF00]/10 border border-[#FFBF00]/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-[#FFBF00]" />
                </div>
                <span className="font-['Inter'] text-slate-600 text-sm">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ─── RIGHT PANEL ─── */}
      <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Faint radial */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#FFBF00]/4 blur-[100px] pointer-events-none" />

        <div className="w-full max-w-sm relative z-10">
          {/* Mobile logo */}
          <Link to="/" className="flex flex-col items-center mb-8 lg:hidden group">
            <div className="w-12 h-12 flex items-center justify-center mb-2 transition-transform group-hover:scale-105">
              <img src={gupioLogo} alt="Gupio Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="font-['Sora'] font-bold text-xl text-slate-900">
              Gupio <span className="text-[#FFBF00]">Analyzer</span>
            </h1>
          </Link>

          <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/50">
            <div className="mb-7">
              <h2 className="font-['Sora'] font-bold text-slate-900 text-2xl mb-1">Welcome back</h2>
              <p className="font-['Inter'] text-slate-500 text-sm">Sign in to access your dashboard</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="font-['Inter'] text-xs font-medium text-slate-500">
                  Work Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 h-10 focus:ring-[#FFBF00]/20 focus:border-[#FFBF00] transition-all px-4"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-red-500 text-[11px] ml-1">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-0.5">
                  <Label htmlFor="password" className="font-['Inter'] text-xs font-medium text-slate-500">
                    Password
                  </Label>
                  <Link
                    to="/forgot-password"
                    className="text-[#FFBF00] hover:text-[#E6AC00] text-[11px] font-medium transition-colors"
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative group">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 h-10 px-4 pr-10 focus:ring-[#FFBF00]/20 focus:border-[#FFBF00] transition-all"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#FFBF00] transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-[11px] ml-1">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !isFormValid}
                className={`w-full h-11 rounded-lg font-['Sora'] font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${isFormValid
                  ? "bg-[#FFBF00] hover:bg-[#E6AC00] text-white shadow-[#FFBF00]/20"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none"
                  }`}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-white/5" />
              <span className="font-['IBM_Plex_Mono'] text-[10px] text-slate-600">OR</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            <p className="text-center text-slate-500 text-xs">
              Don't have an account?{" "}
              <Link to="/signup" className="text-[#FFBF00] hover:text-[#E6AC00] font-semibold transition-colors">
                Request access →
              </Link>
            </p>
          </div>

          <p className="text-center font-['IBM_Plex_Mono'] text-[10px] text-slate-400 mt-5">
            © {new Date().getFullYear()} Gupio Analyzer
          </p>
        </div>
      </div>
    </div>
  );
}
