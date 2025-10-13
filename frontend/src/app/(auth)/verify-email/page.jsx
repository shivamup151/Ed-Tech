
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import { getServerSession } from "@/lib/get-session";
import { redirect, unauthorized } from "next/navigation";

export default async function VerifyEmailPage() {

    const session = await getServerSession();
    const user = session?.user;
    if(!user) unauthorized();
    
    if(user.emailVerified) {
      // Redirect to appropriate dashboard based on user role
      switch (user.role) {
        case "admin":
          redirect("/admin/dashboard");
        case "teacher":
          redirect("/teacher/dashboard");
        default:
          redirect("/student/dashboard");
      }
    }
 


  if (!user.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
              <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
            </div>
            <CardTitle className="text-2xl font-bold">Checking Email...</CardTitle>
            <CardDescription>
              Please wait while we check your email address.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (verificationStatus === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-600">Email Verified!</CardTitle>
            <CardDescription>
              Your email has been successfully verified. Redirecting to dashboard...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (verificationStatus === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-red-600">Verification Failed</CardTitle>
            <CardDescription>
              The verification link is invalid or has expired. Please request a new verification email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={resendVerificationEmail}
              variant="outline" 
              className="w-full"
              disabled={user.emailVerified}
            >
              {user.emailVerified ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Resend Verification Email"
              )}
            </Button>
            <Button 
              onClick={() => router.push("/sign-in")} 
              variant="ghost" 
              className="w-full"
            >
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default state - no token in URL
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
          <CardDescription>
            We've sent you a verification link. Please check your email and click the link to verify your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-gray-600">
            <p>Didn't receive the email? Check your spam folder or</p>
            <Button 
              variant="link" 
              onClick={resendVerificationEmail}
              className="p-0 h-auto"
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : "resend verification email"}
            </Button>
          </div>
          
          <Button 
            onClick={() => router.push("/sign-in")} 
            variant="outline" 
            className="w-full"
          >
            Back to Sign In
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

