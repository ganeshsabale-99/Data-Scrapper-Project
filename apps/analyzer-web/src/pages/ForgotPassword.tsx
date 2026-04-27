import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { otpSchema, passwordSchema } from "@/lib/validation";
import { requestPasswordReset, resetPassword } from "@/lib/auth";
import {
  ArrowRight, KeyRound, Eye, EyeOff, RotateCcw, Mail,
  Building2, Globe2, PhoneCall, TrendingUp,
} from "lucide-react";
import gupioLogo from "@/assets/images/gupioLogo.png";

const resetSchema = z.object({
  otp: otpSchema.shape.otp,
  newPassword: passwordSchema,
  confirmPassword: z.string().min(8, "Confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const requestSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
});

type ResetFormData = z.infer<typeof resetSchema>;

type VerificationData = {
  hash: string;
  timestamp: number;
  counter: number;
  expiresAt: number;
};

const highlights = [
  { icon: Building2, text: "2,400+ Tech Parks across India" },
  { icon: Globe2, text: "National · State · City geo-scope" },
  { icon: PhoneCall, text: "Full contact & visit log pipeline" },
  { icon: TrendingUp, text: "Funding news → instant lead signals" },
];

const lightInput =
  "h-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#FFBF00] focus:ring-[#FFBF00]/20 transition-all font-['Inter'] text-sm rounded-xl";

export function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"request" | "reset">("request");
  const [accountEmail, setAccountEmail] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const requestForm = useForm<{ email: string }>({
    resolver: zodResolver(requestSchema),
    mode: "all",
  });

  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    mode: "all",
  });



  const handleRequest = async (data: { email: string }) => {
    setIsLoading(true);
    try {
      const response = await requestPasswordReset(data.email);
      if (response.success) {
        if (response.verificationData) {
          setAccountEmail(data.email);
          setDeliveryAddress(response.deliveryAddress || "");
          setVerificationData(response.verificationData);
          setStep("reset");
          toast.success("OTP sent to your registered email.");
          return;
        }

        toast.success(
          response.message || "If an account exists, an OTP has been sent.",
        );
      } else {
        toast.error(response.message || "Failed to send OTP");
      }
    } catch {
      toast.error("Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (data: ResetFormData) => {
    if (!verificationData) { toast.error("Invalid reset session"); return; }
    setIsLoading(true);
    try {
      const response = await resetPassword(accountEmail, data.otp, verificationData, data.newPassword);
      if (response.success) {
        toast.success("Password reset successfully!");
        navigate("/login");
      } else {
        toast.error(response.message || "Failed to reset password");
      }
    } catch {
      toast.error("Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!accountEmail) return;
    setIsLoading(true);
    try {
      const response = await requestPasswordReset(accountEmail);
      if (response.success && response.verificationData) {
        setVerificationData(response.verificationData);
        if (response.deliveryAddress) {
          setDeliveryAddress(response.deliveryAddress);
        }
        toast.success("OTP resent successfully!");
      } else {
        toast.error(response.message || "Failed to resend OTP");
      }
    } catch {
      toast.error("Failed to resend OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const maskEmail = (value: string) => {
    const [localRaw = "", domainRaw = ""] = value.split("@");
    if (!localRaw || !domainRaw) return value;
    const local =
      localRaw.length <= 2
        ? `${localRaw[0] || ""}*`
        : `${localRaw.slice(0, 2)}${"*".repeat(Math.max(2, localRaw.length - 2))}`;
    return `${local}@${domainRaw}`;
  };
  const deliveryHint = deliveryAddress || (accountEmail ? maskEmail(accountEmail) : "your registered email");

  return (
    <div className="min-h-screen flex bg-slate-50">

      {/* ─── LEFT PANEL ─── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden p-12 border-r border-slate-100 bg-white">
        {/* Grid bg */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(59 130 246 / 0.1) 1px, transparent 1px), linear-gradient(90deg, rgb(59 130 246 / 0.1) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
        <div className="absolute bottom-[-60px] left-[-60px] w-[500px] h-[500px] rounded-full bg-[#FF7B00]/5 blur-[120px] pointer-events-none" />
        <div className="absolute top-[-80px] right-[-80px] w-[350px] h-[350px] rounded-full bg-indigo-500/5 blur-[100px] pointer-events-none" />

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
            Security & Access
          </p>
          <h2 className="font-['Sora'] font-bold text-4xl xl:text-5xl text-slate-900 leading-[1.1] mb-5">
            Reset Your<br />
            <span className="text-[#FFBF00]">Secure</span> Access
          </h2>
          <p className="font-['Inter'] text-slate-500 text-base leading-relaxed max-w-sm mb-10">
            Everything your Sales and Operations teams need to discover, qualify, and close tech park opportunities — in one place.
          </p>
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
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#FF7B00]/5 blur-[100px] pointer-events-none" />

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

          {/* Card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/50">

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#FFBF00]/10 border border-[#FFBF00]/20 flex items-center justify-center shadow-lg shadow-blue-50">
                <KeyRound className="w-7 h-7 text-[#FFBF00]" />
              </div>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 justify-center mb-6">
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-['IBM_Plex_Mono'] font-bold border transition-all ${step === "request" ? "bg-[#FFBF00] text-white border-[#FFBF00]" : "bg-[#FFBF00]/10 text-[#FFBF00] border-[#FFBF00]/20"}`}>
                1
              </div>
              <div className={`flex-1 h-px max-w-[40px] ${step === "reset" ? "bg-blue-200" : "bg-slate-100"}`} />
              <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-['IBM_Plex_Mono'] font-bold border transition-all ${step === "reset" ? "bg-[#FFBF00] text-white border-[#FFBF00]" : "bg-slate-50 text-slate-400 border-slate-200"}`}>
                2
              </div>
            </div>

            <div className="mb-7 text-center">
              <h2 className="font-['Sora'] font-bold text-slate-900 text-2xl mb-1">
                {step === "request" ? "Forgot access?" : "Reset access"}
              </h2>
              <p className="font-['Inter'] text-slate-500 text-sm leading-relaxed">
                {step === "request"
                  ? "Enter your registered email. We'll send OTP to your email."
                  : "Enter the OTP and choose a new password"}
              </p>
            </div>

            {/* ── STEP 1: Request OTP ── */}
            {step === "request" ? (
              <form onSubmit={requestForm.handleSubmit(handleRequest)} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="font-['Inter'] text-xs font-medium text-slate-500">
                    Work Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    {...requestForm.register("email")}
                    className={`${lightInput} ${requestForm.formState.errors.email ? "border-red-500/60" : ""}`}
                  />
                  {requestForm.formState.errors.email && (
                    <p className="text-xs text-red-500 flex items-center gap-1.5 mt-1.5">
                      <span className="w-1 h-1 bg-red-500 rounded-full" />
                      {requestForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-xl bg-[#FFBF00] text-white font-['Inter'] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#E6AC00] transition-all shadow-lg shadow-[#FFBF00]/20"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>Send Recovery Code <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

            ) : (
              /* ── STEP 2: Reset Password ── */
              <form onSubmit={resetForm.handleSubmit(handleReset)} className="space-y-4">

                {/* Delivery pill */}
                <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 mb-1">
                  <Mail className="w-4 h-4 text-[#FFBF00] flex-shrink-0" />
                  <div>
                    <p className="font-['IBM_Plex_Mono'] text-[10px] text-slate-400 uppercase tracking-widest">OTP sent to email</p>
                    <p className="font-['Inter'] text-slate-900 text-sm font-semibold">{deliveryHint}</p>
                  </div>
                </div>

                {/* OTP */}
                <div className="space-y-1.5">
                  <Label htmlFor="otp" className="font-['Inter'] text-xs font-medium text-slate-500">
                    6-Digit OTP
                  </Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    placeholder="• • • • • •"
                    {...resetForm.register("otp")}
                    maxLength={6}
                    autoComplete="one-time-code"
                    className={`h-12 text-center text-xl tracking-[0.5em] font-['IBM_Plex_Mono'] bg-white border-slate-200 text-slate-900 placeholder:text-slate-200 placeholder:tracking-widest focus:border-[#FFBF00] focus:ring-[#FFBF00]/20 transition-all rounded-xl ${resetForm.formState.errors.otp ? "border-red-500/60" : ""}`}
                  />
                  {resetForm.formState.errors.otp && (
                    <p className="text-xs text-red-500 flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-red-500 rounded-full" />
                      {resetForm.formState.errors.otp.message}
                    </p>
                  )}
                </div>

                {/* New Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="font-['Inter'] text-xs font-medium text-slate-500">
                    New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      {...resetForm.register("newPassword")}
                      className={`${lightInput} pr-10 ${resetForm.formState.errors.newPassword ? "border-red-500/60" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-3 inset-y-0 my-auto h-8 w-8 flex items-center justify-center text-slate-400 hover:text-[#FFBF00] transition-colors"
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {resetForm.formState.errors.newPassword && (
                    <p className="text-xs text-red-500 flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-red-500 rounded-full" />
                      {resetForm.formState.errors.newPassword.message}
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="font-['Inter'] text-xs font-medium text-slate-500">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter new password"
                      {...resetForm.register("confirmPassword")}
                      className={`${lightInput} pr-10 ${resetForm.formState.errors.confirmPassword ? "border-red-500/60" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 inset-y-0 my-auto h-8 w-8 flex items-center justify-center text-slate-400 hover:text-[#FFBF00] transition-colors"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {resetForm.formState.errors.confirmPassword && (
                    <p className="text-xs text-red-500 flex items-center gap-1.5">
                      <span className="w-1 h-1 bg-red-500 rounded-full" />
                      {resetForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!resetForm.formState.isValid || isLoading}
                  className="w-full h-12 rounded-xl bg-[#FFBF00] text-white font-['Inter'] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#E6AC00] transition-all shadow-lg shadow-[#FFBF00]/20 mt-1"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>Reset Password <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>

                {/* Resend */}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-1.5 font-['Inter'] text-xs text-slate-400 hover:text-[#FFBF00] transition-colors disabled:opacity-40 disabled:cursor-not-allowed py-1"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                  Resend OTP
                </button>
              </form>
            )}

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="font-['IBM_Plex_Mono'] text-[10px] text-slate-400">SECURE</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <p className="font-['Inter'] text-sm text-slate-500 text-center">
              Remembered it?{" "}
              <Link
                to="/login"
                className="font-['Inter'] text-sm text-[#FFBF00] hover:text-[#E6AC00] font-medium transition-colors"
              >
                Back to sign in →
              </Link>
            </p>
          </div>

          <p className="text-center font-['IBM_Plex_Mono'] text-[10px] text-slate-400 mt-5">
            © {new Date().getFullYear()} Gupio Analyzer
          </p>
        </div>
      </div>
    </div >
  );
}
