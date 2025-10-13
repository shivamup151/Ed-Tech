"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { redirect, useRouter } from "next/navigation";
import Link from "next/link";

const signUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export default function SignUpForm() {
  const router = useRouter();
  const [error, setError] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(signUpSchema),
  });

  const getRedirectUrl = (userRole) => {
    switch (userRole) {
      case "admin":
        return "/admin/dashboard";
      case "teacher":
        return "/teacher/dashboard";
      default:
        return "/student/dashboard";
    }
  };

  async function onSubmit({ name, email, password }) {
    setError(null);

    try {
      const { error } = await authClient.signUp.email({
        email,
        password,
        name,
        callbackURL: "/verify-email",
      });

      if (error) {
        setError(error.message || "Something went wrong");
        toast.error(error.message || "Sign up failed");
      } else {
        toast.success("Account created successfully");
        // Default to student role for new signups
        const redirectUrl = getRedirectUrl("student");
        router.push(redirectUrl);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      toast.error("Sign up failed");
    }
  }


  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold text-primary">Create Account</CardTitle>
          <CardDescription className="text-muted-foreground">
            Join us today and get started with your journey
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-muted-foreground">
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                {...register("name")}
                className={`h-11 ${errors.name ? "border-border focus:border-border/50" : "focus:border-primary"}`}
                disabled={isSubmitting}
              />
              {errors.name && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <span className="text-destructive">•</span>
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                {...register("email")}
                className={`h-11 ${errors.email ? "border-border focus:border-border/50" : "focus:border-primary"}`}
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <span className="text-destructive">•</span>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a strong password"
                {...register("password")}
                className={`h-11 ${errors.password ? "border-border focus:border-border/50" : "focus:border-primary"}`}
                disabled={isSubmitting}
              />
              {errors.password && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <span className="text-destructive">•</span>
                  {errors.password.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Password must be at least 8 characters long
              </p>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white dark:text-black font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white dark:text-black border-t-transparent rounded-full animate-spin" />
                  Creating Account...
                </div>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border dark:border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link 
                href="/sign-in" 
                className="font-medium text-primary hover:text-primary/90 hover:underline"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}