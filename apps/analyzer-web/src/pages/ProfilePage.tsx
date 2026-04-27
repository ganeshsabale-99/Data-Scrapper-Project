import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { getUser, getUserRole } from "@/lib/token";
import { axiosInstance } from "@/config/axios";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    User, Mail, Phone, Shield, MapPin,
    ArrowLeft, Pencil, X, Save, Lock, Eye, EyeOff,
    CheckCircle2, AlertCircle, Loader2, BadgeCheck, Camera, Trash2
} from "lucide-react";
import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Toast = { type: "success" | "error"; msg: string };
type StoredUser = {
    id?: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
    city?: string;
    state?: string;
    avatarUrl?: string | null;
    role?: string;
    permissions?: string[];
    accessFlags?: Record<string, boolean>;
};

const getApiErrorMessage = (error: unknown, fallback: string): string => {
    if (typeof error === "object" && error !== null && "response" in error) {
        const response = (error as { response?: unknown }).response;
        if (typeof response === "object" && response !== null && "data" in response) {
            const data = (response as { data?: unknown }).data;
            if (typeof data === "object" && data !== null) {
                const message =
                    ("message" in data && typeof (data as { message?: unknown }).message === "string"
                        ? (data as { message: string }).message
                        : "") ||
                    ("error" in data && typeof (data as { error?: unknown }).error === "string"
                        ? (data as { error: string }).error
                        : "");
                if (message) return message;
            }
        }
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
};

function useToast() {
    const [toast, setToast] = useState<Toast | null>(null);
    const show = useCallback((type: "success" | "error", msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    }, []);
    return { toast, show };
}

// ── Floating Toast ─────────────────────────────────────────────────────────
function ToastBanner({ toast }: { toast: Toast | null }) {
    return (
        <AnimatePresence>
            {toast && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-white text-sm font-medium ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"}`}
                >
                    {toast.type === "success"
                        ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                        : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
                    {toast.msg}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ── Info Row (view mode) ───────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value, accent = false }: {
    icon: React.ElementType; label: string; value?: string | null; accent?: boolean;
}) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-4 py-4 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </div>
            <div className="flex flex-col min-w-0">
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">{label}</span>
                <span className={`text-sm font-medium mt-0.5 ${accent ? "text-blue-600 dark:text-blue-400 capitalize" : "text-slate-800 dark:text-slate-100"}`}>
                    {value}
                </span>
            </div>
        </div>
    );
}

// ── Change Password Section ────────────────────────────────────────────────
function ChangePasswordSection({ onSuccess }: { onSuccess: () => void }) {
    const { toast, show } = useToast();
    const [form, setForm] = useState({ current: "", next: "", confirm: "" });
    const [show1, setShow1] = useState(false);
    const [show2, setShow2] = useState(false);
    const [show3, setShow3] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (form.next !== form.confirm) {
            show("error", "New passwords do not match");
            return;
        }
        if (form.next.length < 8) {
            show("error", "New password must be at least 8 characters");
            return;
        }
        setLoading(true);
        try {
            const response = await axiosInstance.post("/auth/change-password", {
                currentPassword: form.current,
                newPassword: form.next,
            });
            const data = response.data as { success?: boolean; message?: string };
            if (data.success) {
                show("success", "Password changed successfully!");
                setForm({ current: "", next: "", confirm: "" });
                onSuccess();
            } else {
                show("error", data.message || "Failed to change password");
            }
        } catch (error: unknown) {
            show("error", getApiErrorMessage(error, "Network error. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <ToastBanner toast={toast} />
            <form onSubmit={handleSubmit} className="space-y-4">
                {[
                    { id: "current", label: "Current Password", val: form.current, show: show1, toggle: () => setShow1(p => !p), onChange: (v: string) => setForm(p => ({ ...p, current: v })) },
                    { id: "next", label: "New Password", val: form.next, show: show2, toggle: () => setShow2(p => !p), onChange: (v: string) => setForm(p => ({ ...p, next: v })) },
                    { id: "confirm", label: "Confirm New Password", val: form.confirm, show: show3, toggle: () => setShow3(p => !p), onChange: (v: string) => setForm(p => ({ ...p, confirm: v })) },
                ].map(f => (
                    <div key={f.id}>
                        <Label htmlFor={f.id} className="text-sm font-medium text-slate-700 dark:text-slate-300">{f.label}</Label>
                        <div className="relative mt-1">
                            <Input
                                id={f.id}
                                type={f.show ? "text" : "password"}
                                value={f.val}
                                onChange={e => f.onChange(e.target.value)}
                                className="pr-10"
                                required
                            />
                            <button type="button" onClick={f.toggle}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {f.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                ))}
                <Button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                    Update Password
                </Button>
            </form>
        </>
    );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ProfilePage() {
    const navigate = useNavigate();
    const { toast, show } = useToast();

    const [storedUser, setStoredUser] = useState<StoredUser | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<"info" | "password">("info");
    const [form, setForm] = useState({ name: "", email: "", city: "", state: "" });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const reload = useCallback(() => {
        const user = getUser();
        setStoredUser(user);
        setUserRole(getUserRole());
        setForm({
            name: user?.name || "",
            email: user?.email || "",
            city: user?.city || "",
            state: user?.state || "",
        });
    }, []);

    useEffect(() => { reload(); }, [reload]);

    const displayName = storedUser?.name || "User";
    const displayEmail = storedUser?.email || null;
    const rawPhone = (storedUser?.phoneNumber || "").trim();
    const displayPhone = rawPhone && !rawPhone.toLowerCase().startsWith("mail:") ? rawPhone : null;
    const roleLabel = userRole?.replace(/_/g, " ") || null;
    const initials = displayName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
    const avatarUrl: string | null = storedUser?.avatarUrl || null;

    const updateStoredUser = (patch: Partial<StoredUser>) => {
        const current = getUser();
        const updated = { ...current, ...patch };
        const key = "gupio_user";
        if (sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify(updated));
        if (localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(updated));
        reload();
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file size (5MB maximum)
        if (file.size > 5 * 1024 * 1024) {
            show("error", "Image must be under 5MB");
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        setAvatarLoading(true);
        try {
            const fd = new FormData();
            fd.append("avatar", file);
            const response = await axiosInstance.post("/auth/avatar", fd);
            const data = response.data as {
                success?: boolean;
                message?: string;
                avatarUrl?: string | null;
            };

            if (data.success) {
                updateStoredUser({ avatarUrl: data.avatarUrl });
                show("success", "Profile photo updated!");
            } else {
                show("error", data.message || "Upload failed");
            }
        } catch (err: unknown) {
            const message = getApiErrorMessage(err, "Network error during upload");
            show("error", message);
        } finally {
            setAvatarLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleAvatarRemove = async () => {
        setAvatarLoading(true);
        try {
            const response = await axiosInstance.delete("/auth/avatar");
            const data = response.data as { success?: boolean; message?: string };
            if (data.success) {
                updateStoredUser({ avatarUrl: null });
                show("success", "Profile photo removed");
            } else {
                show("error", data.message || "Remove failed");
            }
        } catch (error: unknown) {
            show("error", getApiErrorMessage(error, "Network error"));
        } finally {
            setAvatarLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.put("/auth/profile", form);
            const data = response.data as {
                success?: boolean;
                message?: string;
                user?: Partial<StoredUser>;
            };

            if (data.success) {
                // Update stored user data in sessionStorage/localStorage
                const current = getUser();
                const updated = { ...current, ...data.user };
                const key = "gupio_user";
                if (sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify(updated));
                if (localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(updated));
                reload();
                setEditing(false);
                show("success", "Profile updated successfully!");
            } else {
                show("error", data.message || "Failed to update profile");
            }
        } catch (err: unknown) {
            const message = getApiErrorMessage(err, "Network error. Please try again.");
            show("error", message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 p-6">
            <ToastBanner toast={toast} />

            <div className="max-w-2xl mx-auto">
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)}
                    className="mb-6 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 -ml-2">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>

                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">

                    {/* Banner */}
                    <div className="h-28 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 relative">
                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
                    </div>

                    {/* Avatar + Name */}
                    <div className="px-8 pb-4">
                        <div className="flex items-end justify-between -mt-12 mb-4">
                            {/* Avatar with edit overlay */}
                            <div className="relative group">
                                <Avatar className="h-20 w-20 ring-4 ring-white dark:ring-slate-900 shadow-xl">
                                    <AvatarImage src={avatarUrl || "/avatars/01.png"} alt="User" />
                                    <AvatarFallback className="text-xl font-bold bg-gradient-to-br from-blue-400 to-indigo-600 text-white">{initials}</AvatarFallback>
                                </Avatar>
                                {editing && (
                                    <div className="absolute inset-0 rounded-full flex items-center justify-center gap-1 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                        onClick={() => fileInputRef.current?.click()}>
                                        {avatarLoading
                                            ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                                            : <Camera className="h-5 w-5 text-white" />}
                                    </div>
                                )}
                                {editing && avatarUrl && !avatarLoading && (
                                    <button
                                        onClick={handleAvatarRemove}
                                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow"
                                        title="Remove photo"
                                    >
                                        <Trash2 className="h-3 w-3 text-white" />
                                    </button>
                                )}
                            </div>
                            {editing && (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                    disabled={avatarLoading}
                                >
                                    <Camera className="h-3.5 w-3.5" /> Change photo (Max 5MB)
                                </button>
                            )}
                            {!editing && roleLabel && (
                                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-full border border-blue-100 dark:border-blue-800">
                                    <BadgeCheck className="h-3.5 w-3.5" />{roleLabel}
                                </span>
                            )}
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{displayName}</h1>
                        {displayEmail && <p className="text-slate-500 text-sm mt-0.5">{displayEmail}</p>}
                    </div>

                    {/* Tabs */}
                    <div className="px-8 pb-2">
                        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
                            {(["info", "password"] as const).map(tab => (
                                <button key={tab} onClick={() => { setActiveTab(tab); setEditing(false); }}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"}`}>
                                    {tab === "info" ? "Profile Info" : "Change Password"}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="px-8 pb-8 pt-4">
                        {/* ── Profile Info Tab ── */}
                        {activeTab === "info" && (
                            <>
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Account Details</h2>
                                    {!editing ? (
                                        <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1">
                                            <Pencil className="h-3.5 w-3.5" /> Edit
                                        </Button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => { setEditing(false); reload(); }} className="gap-1 text-slate-500">
                                                <X className="h-3.5 w-3.5" /> Cancel
                                            </Button>
                                            <Button size="sm" onClick={handleSave} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white gap-1">
                                                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {editing ? (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 space-y-4">
                                        {[
                                            { id: "name", label: "Full Name", icon: User, val: form.name, key: "name" as const },
                                            { id: "email", label: "Email Address", icon: Mail, val: form.email, key: "email" as const },
                                            { id: "city", label: "City", icon: MapPin, val: form.city, key: "city" as const },
                                            { id: "state", label: "State", icon: MapPin, val: form.state, key: "state" as const },
                                        ].map(f => (
                                            <div key={f.id}>
                                                <Label htmlFor={f.id} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                                                    <f.icon className="h-3.5 w-3.5" />{f.label}
                                                </Label>
                                                <Input id={f.id} value={f.val}
                                                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                                                    placeholder={f.label}
                                                />
                                            </div>
                                        ))}
                                        {/* Phone read-only */}
                                        {displayPhone && (
                                            <div>
                                                <Label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                                                    <Phone className="h-3.5 w-3.5" />Phone Number
                                                </Label>
                                                <Input value={displayPhone} disabled className="opacity-60" />
                                                <p className="text-xs text-slate-400 mt-1">Phone number cannot be changed.</p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-4">
                                        <InfoRow icon={User} label="Full Name" value={displayName} />
                                        <InfoRow icon={Mail} label="Email Address" value={displayEmail} />
                                        <InfoRow icon={Phone} label="Phone Number" value={displayPhone} />
                                        <InfoRow icon={Shield} label="Role" value={roleLabel} accent />
                                        <InfoRow icon={MapPin} label="City" value={storedUser?.city} />
                                        <InfoRow icon={MapPin} label="State" value={storedUser?.state} />
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── Change Password Tab ── */}
                        {activeTab === "password" && (
                            <>
                                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Change Password</h2>
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5">
                                    <ChangePasswordSection onSuccess={() => setActiveTab("info")} />
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
