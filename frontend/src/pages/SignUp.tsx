import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthLayout } from "../components/auth/AuthLayout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../context/AuthContext";

export function SignUp() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const [merchantName, setMerchantName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      setError(null);
      setSubmitting(true);

      await signup({
        merchantName: merchantName.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
      });

      navigate("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create your workspace. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      description=""
      footer={
        <>
          Already have a workspace?{" "}
          <Link
            to="/login"
            className="font-medium text-primary underline-offset-4 transition-colors hover:underline">
            Sign in
          </Link>
        </>
      }>
      <form
        className="w-full space-y-5"
        onSubmit={handleSubmit}
        noValidate={false}>
        <div className="space-y-2">
          <Label htmlFor="merchantName">Business name</Label>
          <Input
            id="merchantName"
            name="merchantName"
            type="text"
            autoComplete="organization"
            placeholder="e.g. Acme Payments"
            required
            value={merchantName}
            onChange={(event) => {
              setMerchantName(event.target.value);
              if (error) setError(null);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="e.g. Nitin Singh"
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="name@company.com"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError(null);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>

          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              minLength={8}
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) setError(null);
              }}
              className="pr-11"
            />

            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1">
              {showPassword ? (
                <EyeOff size={18} strokeWidth={1.8} />
              ) : (
                <Eye size={18} strokeWidth={1.8} />
              )}
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Use at least 8 characters.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/25 bg-destructive/10 px-3.5 py-3 text-sm leading-5 text-destructive">
            {error}
          </div>
        )}

        <div className="pt-1">
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                Creating workspace...
              </>
            ) : (
              <>
                Create workspace
                <ArrowRight size={17} />
              </>
            )}
          </Button>
        </div>

        <p className="px-2 text-center text-xs leading-5 text-muted-foreground">
          By creating a workspace, you agree to Vidur AI&apos;s terms and
          privacy policy.
        </p>
      </form>
    </AuthLayout>
  );
}
