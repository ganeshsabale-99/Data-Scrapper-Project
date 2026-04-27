import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useLocation, Link } from "react-router";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { otpSchema, type OTPFormData } from "@/lib/validation";
import { verifyOTP, resendMfaOtp, setAuthToken, verifySignupOtp, resendSignupOtp } from "@/lib/auth";
import { getCityBasedLandingPage } from "@/lib/token";
import {
  ArrowRight, ShieldCheck, Clock, RotateCcw,
  Building2, Globe2, PhoneCall, TrendingUp, Mail,
} from "lucide-react";
import gupioLogo from "@/assets/images/gupioLogo.png";
import { GupioOverlayLoader } from "@/components/ui/gupio-loader";

interface LocationState {
  email?: string;
  phoneNumber?: string;
  deliveryAddress?: string;
  verificationData: {
    hash: string;
    timestamp: number;
    counter: number;
    expiresAt: number;
  };
  otp?: string;
  mfaToken?: string;
  flow?: "mfa" | "signup" | "reset";
}

const highlights = [
  { icon: Building2, text: "2,400+ Tech Parks across India" },
  { icon: Globe2, text: "National · State · City geo-scope" },
  { icon: PhoneCall, text: "Full contact & visit log pipeline" },
  { icon: TrendingUp, text: "Funding news → instant lead signals" },
];

const lightInput =
  "h-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#FFBF00] focus:ring-[#FFBF00]/20 transition-all font-['Inter'] text-sm rounded-xl";

export function VerifyOTP() {
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const [verificationData, setVerificationData] = useState(state?.verificationData);
  const [deliveryAddress, setDeliveryAddress] = useState(state?.deliveryAddress || "");
  const otpIdentifier = (state?.email || state?.phoneNumber || "").trim();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<OTPFormData>({
    resolver: zodResolver(otpSchema),
    mode: "onChange",
  });

  const otpValue = watch("otp");

  useEffect(() => {
    if (!otpIdentifier || !state?.verificationData) {
      toast.error("Invalid verification session");
      navigate("/login");
      return;
    }
    if (state.flow !== "signup" && !state?.mfaToken) {
      toast.error("Invalid verification session");
      navigate("/login");
    }
  }, [state, otpIdentifier, navigate]);

  useEffect(() => {
    if (verificationData?.expiresAt) {
      const secondsLeft = Math.max(0, Math.floor((verificationData.expiresAt - Date.now()) / 1000));
      setTimeLeft(secondsLeft);
    }
  }, [verificationData]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleResendOTP = async () => {
    setIsResending(true);
    try {
      if (!otpIdentifier) { toast.error("Invalid verification session"); return; }
      const response = state.flow === "signup"
        ? await resendSignupOtp(otpIdentifier)
        : await resendMfaOtp(otpIdentifier, state.mfaToken as string);
      if (response.success && response.verificationData) {
        setVerificationData(response.verificationData);
        if (response.deliveryAddress) {
          setDeliveryAddress(response.deliveryAddress);
        }
        const secondsLeft = Math.max(0, Math.floor((response.verificationData.expiresAt - Date.now()) / 1000));
        setTimeLeft(secondsLeft);
        toast.success("OTP resent successfully!");
      } else {
        toast.error(response.message || "Failed to resend OTP");
      }
    } catch {
      toast.error("Failed to resend OTP");
    } finally {
      setIsResending(false);
    }
  };

  const onSubmit = async (data: OTPFormData) => {
    if (!otpIdentifier || !verificationData) {
      toast.error("Invalid verification session");
      navigate("/login");
      return;
    }
    setIsLoading(true);
    try {
      const response = state.flow === "signup"
        ? await verifySignupOtp(otpIdentifier, data.otp, verificationData)
        : await verifyOTP(otpIdentifier, data.otp, verificationData, state.mfaToken);
      if (response.success) {
        if (state.flow === "signup") {
          toast.success("OTP verified. Await admin approval.");
          navigate("/login");
          return;
        }
        if (response.sessionToken) {
          setAuthToken(response.sessionToken);
          toast.success("Login successful!");
          navigate(getCityBasedLandingPage());
          return;
        }
      }
      toast.error(response.message || "Invalid OTP");
    } catch {
      toast.error("Failed to verify OTP");
    } finally {
      setIsLoading(false);
    }
  };

  if (!otpIdentifier || !verificationData || (state.flow !== "signup" && !state?.mfaToken)) {
    return <GupioOverlayLoader text="Loading verification..." />;
  }

  const deliveryHint = deliveryAddress || "your registered email";

  const isOtpFilled = otpValue?.length === 6;

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
        {/* Blue glow */}
        <div className="absolute bottom-[-60px] left-[-60px] w-[500px] h-[500px] rounded-full bg-[#FF7B00]/5 blur-[120px] pointer-events-none" />
        {/* Top-right glow */}
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
            Security Verification
          </p>
          <h2 className="font-['Sora'] font-bold text-4xl xl:text-5xl text-slate-900 leading-[1.1] mb-5">
            Verify Your<br />
            <span className="text-[#FFBF00]">Identity</span>
          </h2>
          <p className="font-['Inter'] text-slate-500 text-base leading-relaxed max-w-sm mb-10">
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

            {/* Shield icon */}
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#FFBF00]/10 border border-[#FFBF00]/20 flex items-center justify-center shadow-lg shadow-blue-50">
                <ShieldCheck className="w-7 h-7 text-[#FFBF00]" />
              </div>
            </div>

            <div className="mb-7 text-center">
              <h2 className="font-['Sora'] font-bold text-slate-900 text-2xl mb-1">
                Verify your identity
              </h2>
              <p className="font-['Inter'] text-slate-500 text-sm leading-relaxed">
                {state.flow === "signup"
                  ? "Enter the OTP to complete your registration"
                  : "Enter the OTP to complete your sign-in"}
              </p>
            </div>

            {/* Delivery pill */}
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 mb-6">
              <Mail className="w-4 h-4 text-[#FFBF00] flex-shrink-0" />
              <div>
                <p className="font-['IBM_Plex_Mono'] text-[10px] text-slate-400 uppercase tracking-widest">
                  OTP sent to email
                </p>
                <p className="font-['Inter'] text-slate-900 text-sm font-semibold">
                  {deliveryHint}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* OTP Input */}
              <div className="space-y-1.5">
                <Label htmlFor="otp" className="font-['Inter'] text-xs font-medium text-slate-500">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter 6-digit code"
                  {...register("otp")}
                  maxLength={6}
                  autoComplete="one-time-code"
                  className={`${lightInput} text-center text-lg tracking-[0.2em] font-bold ${errors.otp ? "border-red-500/60" : ""}`}
                />
                {errors.otp && (
                  <p className="text-xs text-red-500 flex items-center gap-1.5 mt-1.5">
                    <span className="w-1 h-1 bg-red-500 rounded-full" />
                    {errors.otp.message}
                  </p>
                )}
              </div>

              {/* Timer / Resend */}
              <div className="flex items-center justify-between">
                {timeLeft > 0 ? (
                  <span className="font-['Inter'] text-xs text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#FFBF00]" />
                    Expires in{" "}
                    <span className="text-[#FFBF00] font-semibold font-['IBM_Plex_Mono']">
                      {formatTime(timeLeft)}
                    </span>
                  </span>
                ) : (
                  <span className="font-['Inter'] text-xs text-red-500">OTP expired</span>
                )}

                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={isResending || timeLeft > 0}
                  className="flex items-center gap-1.5 font-['Inter'] text-xs text-[#FFBF00] hover:text-[#E6AC00] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
                  {isResending ? "Resending..." : "Resend OTP"}
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!isValid || !isOtpFilled || isLoading}
                className="w-full h-12 rounded-xl bg-[#FFBF00] text-white font-['Inter'] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#E6AC00] transition-all shadow-lg shadow-[#FFBF00]/20"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify & Continue <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="font-['IBM_Plex_Mono'] text-[10px] text-slate-400">SECURE</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <p className="font-['Inter'] text-sm text-slate-500 text-center">
              Wrong email?{" "}
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
