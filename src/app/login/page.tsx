"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Shield, Eye, EyeOff, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<{ email?: string; password?: string }>({});

  const validateForm = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "Please enter a valid email address";
    }

    if (!password) {
      errors.password = "Password is required";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed. Please check your credentials.");
        setLoading(false);
        return;
      }

      // Navigate based on returned role
      if (data.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/projects");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg-app p-4 select-none">
      <Card className="w-full max-w-md bg-bg-surface border-border p-8 shadow-md">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-medium text-text-primary tracking-tight">
            CCP Studio Portal
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Sign in to access your confidential communications
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2.5 p-3 mb-5 rounded bg-danger/10 border border-danger/30 text-danger text-xs leading-normal"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email field */}
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="block text-xs font-medium text-text-secondary"
            >
              Email address
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: undefined });
              }}
              error={Boolean(fieldErrors.email)}
              placeholder="name@example.com"
              disabled={loading}
              className="bg-bg-field text-text-primary"
            />
            {fieldErrors.email && (
              <p className="text-[11px] text-danger mt-1">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password field */}
          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-text-secondary"
            >
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: undefined });
                }}
                error={Boolean(fieldErrors.password)}
                placeholder="••••••••••••"
                disabled={loading}
                className="bg-bg-field text-text-primary pr-10"
              />
              <button
                type="button"
                tabIndex={0}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary p-1 focus:outline-none focus:text-text-primary"
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="text-[11px] text-danger mt-1">{fieldErrors.password}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full h-10 font-medium"
            >
              {loading ? "Authenticating..." : "Sign in"}
            </Button>
          </div>
        </form>

        {/* Required Compliance Notice */}
        <div className="mt-6 pt-5 border-t border-border flex items-start gap-2.5 text-text-secondary/70">
          <Lock className="w-4 h-4 shrink-0 mt-0.5 text-text-secondary/50" />
          <p className="text-[11px] leading-relaxed">
            Your identity is hidden from other participants. CCP Studio administrators
            may review conversations for project management and policy compliance.
          </p>
        </div>
      </Card>
    </div>
  );
}
