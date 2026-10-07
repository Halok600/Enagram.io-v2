import { auth, signIn } from "@/auth";
import { Workspace } from "./chat/Workspace";

export default async function Home() {
  const session = await auth();

  if (!session) {
    return <LoginScreen />;
  }

  return <Workspace email={session.user?.email ?? "unknown"} name={session.user?.name ?? undefined} />;
}

function LoginScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[var(--bg)]">
      <main
        className="flex w-full max-w-lg flex-col items-center gap-8 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-panel)] p-14 text-center"
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--text-primary)]">
          Enagram.io
        </h1>
        <p className="text-lg text-[var(--text-secondary)]">
          Connect your Google account to let the brain read your Gmail and Drive,
          and read, create, and manage your Calendar.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
        >
          <button
            type="submit"
            className="rounded-[var(--radius-md)] bg-[var(--accent-strong)] px-8 py-4 text-base font-semibold text-white transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] active:translate-y-0 active:scale-[0.98]"
          >
            Connect Google Account
          </button>
        </form>
      </main>
    </div>
  );
}
