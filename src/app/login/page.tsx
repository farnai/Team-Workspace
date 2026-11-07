"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader2 } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("გთხოვთ შეიყვანოთ ელ.ფოსტა");
      return;
    }
    if (!password) {
      setError("გთხოვთ შეიყვანოთ პაროლი");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "ავტორიზაცია ვერ მოხერხდა");
        setIsLoading(false);
        return;
      }

      // Successful login -> redirect to workspace root
      router.push("/");
      router.refresh();
    } catch {
      setError("სერვერთან კავშირი შეწყდა. სცადეთ მოგვიანებით.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8F7F4] px-4 py-12">
      <div className="w-full max-w-md bg-white border border-stone-200/90 rounded-3xl p-8 shadow-sm">
        {/* Workspace Brand Badge */}
        <div className="flex flex-col items-center text-center mb-8">
          <Logo size={56} variant="app" priority className="mb-3" />
          <h1 className="text-xl font-bold tracking-tight text-stone-900">
            Team Workspace
          </h1>
          <p className="text-xs text-stone-500 mt-1 font-medium">
            შიდა გუნდური სამუშაო სივრცე
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
            <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              ელ.ფოსტა
            </label>
            <div className="relative flex items-center">
              <Mail
                size={16}
                className="absolute left-3.5 text-stone-400 pointer-events-none"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@team.local"
                disabled={isLoading}
                autoComplete="email"
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50/80 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              პაროლი
            </label>
            <div className="relative flex items-center">
              <Lock
                size={16}
                className="absolute left-3.5 text-stone-400 pointer-events-none"
              />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                autoComplete="current-password"
                className="w-full pl-10 pr-11 py-2.5 bg-stone-50/80 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-stone-400 hover:text-stone-600 transition-colors p-1"
                title={showPassword ? "პაროლის დამალვა" : "პაროლის ჩვენება"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>შესვლა...</span>
              </>
            ) : (
              <span>სისტემაში შესვლა</span>
            )}
          </button>
        </form>

        {/* Admin Policy Disclaimer */}
        <div className="mt-8 pt-6 border-t border-stone-100 text-center text-[11px] text-stone-400 leading-relaxed">
          <p>
            რეგისტრაცია დახურულია. ანგარიშების შექმნა და პაროლების განახლება
            ხორციელდება მხოლოდ ადმინისტრატორის მიერ.
          </p>
        </div>
      </div>
    </div>
  );
}

