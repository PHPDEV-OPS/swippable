import { SignIn } from "@clerk/nextjs";
import { AuthLayout } from "@/components/Auth/AuthLayout";
import { authClerkAppearance } from "@/components/Auth/clerkAppearance";

export default function SignInPage() {
  return (
    <AuthLayout mode="sign-in">
      <SignIn
        forceRedirectUrl="/dashboard"
        appearance={authClerkAppearance}
      />
    </AuthLayout>
  );
}
