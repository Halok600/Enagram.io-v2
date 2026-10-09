import { auth, signIn } from "@/auth";
import { Workspace } from "./chat/Workspace";
import { ConnectGoogleButton, LoginCard } from "./ui/LoginCard";

export default async function Home() {
  const session = await auth();

  if (!session) {
    return <LoginScreen />;
  }

  return <Workspace email={session.user?.email ?? "unknown"} name={session.user?.name ?? undefined} />;
}

function LoginScreen() {
  return (
    <LoginCard>
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <ConnectGoogleButton type="submit" />
      </form>
    </LoginCard>
  );
}
