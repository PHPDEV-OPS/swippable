import { SignUp } from "@clerk/nextjs";
import { AuthLayout } from "@/components/Auth/AuthLayout";
import { authClerkAppearance } from "@/components/Auth/clerkAppearance";

export default function SignUpPage() {
  return (
    <AuthLayout mode="sign-up">
      <SignUp
        forceRedirectUrl="/dashboard"
        appearance={authClerkAppearance}
      />
    </AuthLayout>
  );
}
