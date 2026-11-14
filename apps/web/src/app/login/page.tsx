import { redirect } from "next/navigation";
import { isOwner, passwordConfigured } from "@/lib/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await isOwner()) redirect("/");
  const configured = passwordConfigured();
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="rise w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-amber to-coral font-display text-lg font-extrabold text-ink-950 shadow-lg shadow-amber/20">
            B
          </div>
          <div>
            <div className="font-display text-lg font-bold">Boma Creative Studio</div>
            <div className="text-xs text-mist-400">Part of Boma AI Workforce</div>
          </div>
        </div>
        <div className="panel rounded-3xl p-7">
          <h1 className="font-display text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-mist-400">This studio is private to its owner.</p>
          {configured ? (
            <LoginForm />
          ) : (
            <div className="mt-6 rounded-xl border border-amber/30 bg-amber/10 p-4 text-sm text-amber">
              Set <code className="font-mono">OWNER_PASSWORD</code> (12+ characters) in your{" "}
              <code className="font-mono">.env</code>, then restart the web app.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
