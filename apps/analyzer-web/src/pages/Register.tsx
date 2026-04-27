import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowRight, Eye, EyeOff,
  Users, MapPin, ClipboardCheck, ShieldCheck,
} from "lucide-react";
import gupioLogo from "@/assets/images/gupioLogo.png";
import { fetchRequestedRoleOptions, signup, type RequestedRoleOption } from "@/lib/auth";
import { useCityCatalogOptions } from "@/hooks/use-city-catalog-options";

const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    requestedRole: z.string().min(1, "Please select the position you are applying for"),
    state: z.string().min(1, "Please select a state"),
    city: z.string().min(1, "Please select a city"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

const lightInput =
  "h-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#FFBF00] focus:ring-[#FFBF00]/20 transition-all font-['Inter'] text-sm rounded-xl";
const lightSelectItem =
  "text-slate-700 focus:bg-slate-50 focus:text-slate-900 data-[highlighted]:bg-slate-50 data-[highlighted]:text-slate-900 data-[state=checked]:bg-slate-100 data-[state=checked]:text-slate-900";

const steps = [
  { icon: Users, title: "Request Access", desc: "Fill in your details and pick your role" },
  { icon: ClipboardCheck, title: "Admin Approval", desc: "Your account is reviewed by an admin" },
  { icon: MapPin, title: "Geo Scope Assigned", desc: "You're given access to your city or state" },
  { icon: ShieldCheck, title: "Start Working", desc: "Log in and start tracking tech parks" },
];

const extractApiErrorMessage = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return null;
  }
  const response = (error as { response?: unknown }).response;
  if (typeof response !== "object" || response === null || !("data" in response)) {
    return null;
  }
  const data = (response as { data?: unknown }).data;
  if (typeof data !== "object" || data === null || !("message" in data)) {
    return null;
  }
  const message = (data as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
};


export function Register() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [requestedRoleOptions, setRequestedRoleOptions] = useState<RequestedRoleOption[]>([]);
  const [isRoleOptionsLoading, setIsRoleOptionsLoading] = useState(true);
  const [roleOptionsError, setRoleOptionsError] = useState<string | null>(null);
  const navigate = useNavigate();

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, touchedFields, isSubmitted },
    watch,
    setValue,
    getValues,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: "all",
    defaultValues: { requestedRole: "", state: "", city: "" },
  });

  const selectedState = watch("state");
  const selectedCity = watch("city");

  const { catalog, isLoading: isLocationCatalogLoading, isError: isLocationCatalogError } =
    useCityCatalogOptions();
  const cityOptions = useMemo(
    () =>
      selectedState
        ? catalog.citiesByState[selectedState] || []
        : catalog.allCities,
    [catalog.allCities, catalog.citiesByState, selectedState],
  );

  useEffect(() => {
    if (!selectedCity) return;
    if (cityOptions.includes(selectedCity)) return;
    setValue("city", "", { shouldDirty: true, shouldValidate: true });
  }, [cityOptions, selectedCity, setValue]);

  useEffect(() => {
    let active = true;
    setIsRoleOptionsLoading(true);
    setRoleOptionsError(null);
    fetchRequestedRoleOptions()
      .then((options) => {
        if (!active) return;
        const normalizedOptions = options
          .map((option) => {
            const value = (option.value || option.id || "").trim();
            const label = (option.label || value).trim();
            return { ...option, value, label };
          })
          .filter((option) => option.value.length > 0);

        setRequestedRoleOptions(normalizedOptions);

        const currentRequestedRole = (getValues("requestedRole") || "").trim();
        const hasCurrentOption = normalizedOptions.some(
          (option) => option.value === currentRequestedRole,
        );

        if (!hasCurrentOption) {
          setValue("requestedRole", normalizedOptions[0]?.value || "", {
            shouldValidate: normalizedOptions.length > 0,
          });
        }
      })
      .catch((error) => {
        if (!active) return;
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load role options right now. Please try again.";
        setRequestedRoleOptions([]);
        setRoleOptionsError(message);
        setValue("requestedRole", "", { shouldValidate: false });
      })
      .finally(() => { if (!active) return; setIsRoleOptionsLoading(false); });
    return () => { active = false; };
  }, [getValues, setValue]);

  const onSubmit = async (data: RegisterFormData) => {
    if (isRoleOptionsLoading || requestedRoleOptions.length === 0) {
      toast.error(
        roleOptionsError ||
        "Role options are currently unavailable. Please try again in a moment.",
      );
      return;
    }
    setIsLoading(true);
    try {
      const response = await signup({
        name: data.name,
        email: data.email,
        password: data.password,
        state: data.state,
        city: data.city,
        requestedRole: data.requestedRole,
      });
      if (response.success && response.verificationData) {
        toast.success("Registration created. OTP sent to your email.");
        navigate("/verify-otp", {
          state: {
            email: data.email,
            deliveryAddress: response.deliveryAddress || data.email,
            verificationData: response.verificationData,
            otp: response.otp,
            flow: "signup",
          },
        });
      } else {
        toast.error(response.message || "Registration failed");
      }
    } catch (error: unknown) {
      toast.error(
        extractApiErrorMessage(error) || "Registration failed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const FieldError = ({ msg }: { msg?: string }) =>
    msg ? (
      <p className="text-xs text-red-500 flex items-center gap-1.5 mt-1">
        <span className="w-1 h-1 bg-red-500 rounded-full flex-shrink-0" />{msg}
      </p>
    ) : null;

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
        <div className="relative z-10 flex-1 flex flex-col justify-center py-10">
          <p className="font-['IBM_Plex_Mono'] text-[11px] text-[#FFBF00] uppercase tracking-widest mb-4">
            Getting Started
          </p>
          <h2 className="font-['Sora'] font-bold text-4xl xl:text-5xl text-slate-900 leading-[1.1] mb-4">
            Join Your Team on<br />
            <span className="text-[#FFBF00]">Gupio</span> Analyzer
          </h2>
          <p className="font-['Inter'] text-slate-500 text-base leading-relaxed max-w-sm mb-10">
            Request access to start discovering, qualifying, and tracking tech parks and coworking spaces across India.
          </p>

          {/* Steps */}
          <div className="space-y-4 mb-10">
            {steps.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-0">
                  <div className="w-8 h-8 rounded-lg bg-[#FFBF00]/10 border border-[#FFBF00]/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-[#FFBF00]" />
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px h-5 bg-blue-100 mt-1" />
                  )}
                </div>
                <div className="pt-0.5">
                  <div className="font-['Inter'] font-semibold text-slate-900 text-sm">{title}</div>
                  <div className="font-['Inter'] text-slate-500 text-xs mt-0.5">{desc}</div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ─── RIGHT PANEL ─── */}
      <div className="flex-1 flex items-center justify-center p-6 py-10 relative overflow-hidden">
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
            <div className="mb-6">
              <h2 className="font-['Sora'] font-bold text-slate-900 text-2xl mb-1">Request Access</h2>
              <p className="font-['Inter'] text-slate-500 text-sm">Create your account — pending admin approval</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <input type="hidden" {...register("state")} />
              <input type="hidden" {...register("city")} />

              <div className="space-y-1.5">
                <Label htmlFor="name" className="font-['Inter'] text-xs font-medium text-slate-500">Full Name</Label>
                <Input id="name" type="text" placeholder="Your full name" {...register("name")}
                  className={`${lightInput} ${errors.name ? "border-red-500/60" : ""}`} />
                <FieldError msg={errors.name?.message} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="font-['Inter'] text-xs font-medium text-slate-500">Email Address</Label>
                <Input id="email" type="email" placeholder="you@company.com" {...register("email")}
                  className={`${lightInput} ${errors.email ? "border-red-500/60" : ""}`} />
                <FieldError msg={errors.email?.message} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="requestedRole" className="font-['Inter'] text-xs font-medium text-slate-500">Apply For Position</Label>
                <Controller
                  name="requestedRole"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      onValueChange={(value) => {
                        field.onChange(value);
                      }}
                      disabled={isRoleOptionsLoading || requestedRoleOptions.length === 0}
                    >
                      <SelectTrigger id="requestedRole" className={`${lightInput} w-full ${errors.requestedRole ? "border-red-500/60" : ""}`}>
                        <SelectValue
                          placeholder={
                            isRoleOptionsLoading
                              ? "Loading..."
                              : roleOptionsError
                                ? "Unable to load positions"
                                : requestedRoleOptions.length === 0
                                  ? "No positions"
                                  : "Select position"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 text-slate-900">
                        {requestedRoleOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value} className={lightSelectItem}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError
                  msg={
                    roleOptionsError
                      ? roleOptionsError
                      : !isRoleOptionsLoading && requestedRoleOptions.length === 0
                        ? "No positions are currently available. Please contact admin."
                        : undefined
                  }
                />
                <FieldError
                  msg={
                    requestedRoleOptions.length > 0 &&
                      !roleOptionsError &&
                      (touchedFields.requestedRole || isSubmitted)
                      ? errors.requestedRole?.message
                      : undefined
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="state" className="font-['Inter'] text-xs font-medium text-slate-500">State</Label>
                  <Select value={selectedState || undefined}
                    onValueChange={(v) => setValue("state", v, { shouldDirty: true, shouldValidate: true })}
                    disabled={isLocationCatalogLoading}>
                    <SelectTrigger id="state" className={`${lightInput} w-full ${errors.state ? "border-red-500/60" : ""}`}>
                      <SelectValue placeholder={isLocationCatalogLoading ? "Loading..." : "State"} />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900">
                      {catalog.states.map((s) => (
                        <SelectItem key={s} value={s} className={lightSelectItem}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError msg={errors.state?.message} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="city" className="font-['Inter'] text-xs font-medium text-slate-500">City</Label>
                  <Select value={selectedCity || undefined}
                    onValueChange={(v) => setValue("city", v, { shouldDirty: true, shouldValidate: true })}
                    disabled={isLocationCatalogLoading}>
                    <SelectTrigger id="city" className={`${lightInput} w-full ${errors.city ? "border-red-500/60" : ""}`}>
                      <SelectValue placeholder={isLocationCatalogLoading ? "Loading..." : "City"} />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 text-slate-900">
                      {cityOptions.map((c) => (
                        <SelectItem key={c} value={c} className={lightSelectItem}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError msg={errors.city?.message} />
                  {isLocationCatalogError && <p className="text-xs text-red-500 mt-1">Failed to load locations.</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="font-['Inter'] text-xs font-medium text-slate-500">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password" {...register("password")}
                    className={`${lightInput} pr-10 ${errors.password ? "border-red-500/60" : ""}`} />
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 inset-y-0 my-auto h-8 w-8 flex items-center justify-center text-slate-400 hover:text-[#FFBF00] transition-colors"
                    aria-label={showPassword ? "Hide" : "Show"}>
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <FieldError msg={errors.password?.message} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="font-['Inter'] text-xs font-medium text-slate-500">Confirm Password</Label>
                <div className="relative">
                  <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter your password" {...register("confirmPassword")}
                    className={`${lightInput} pr-10 ${errors.confirmPassword ? "border-red-500/60" : ""}`} />
                  <button type="button" onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 inset-y-0 my-auto h-8 w-8 flex items-center justify-center text-slate-400 hover:text-[#FFBF00] transition-colors"
                    aria-label={showConfirmPassword ? "Hide" : "Show"}>
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <FieldError msg={errors.confirmPassword?.message} />
              </div>

              <button
                type="submit"
                disabled={
                  isLoading ||
                  isLocationCatalogLoading ||
                  isRoleOptionsLoading ||
                  requestedRoleOptions.length === 0
                }
                className="w-full h-12 rounded-xl bg-[#FFBF00] text-white font-['Inter'] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#E6AC00] transition-all shadow-lg shadow-[#FFBF00]/20 mt-1"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>Create Account <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="font-['IBM_Plex_Mono'] text-[10px] text-slate-400">OR</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>

            <p className="font-['Inter'] text-sm text-slate-500 text-center">
              Already have an account?{" "}
              <Link to="/login" className="text-[#FFBF00] hover:text-[#E6AC00] font-medium transition-colors">
                Sign in →
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
