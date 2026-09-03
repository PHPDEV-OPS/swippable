import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-start justify-center px-4 pt-24 pb-12 md:pt-32">
      <SignIn forceRedirectUrl="/dashboard" />
    </div>
  );
}
