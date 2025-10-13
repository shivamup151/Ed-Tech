import { getServerSession } from "@/lib/get-session";
import { redirect } from "next/navigation";

export default function RoleProtection({ 
  children, 
  allowedRoles, 
  redirectTo = "/student/dashboard" 
}) {
  return async function ProtectedLayout() {
    const session = await getServerSession();
    const user = session?.user;
    
    // Check if user is authenticated
    if (!user) {
      redirect("/sign-in");
    }
    
    // Check if user has the required role
    if (!allowedRoles.includes(user.role)) {
      // Redirect to appropriate dashboard based on user's actual role
      switch (user.role) {
        case "admin":
          redirect("/admin/dashboard");
        case "teacher":
          redirect("/teacher/dashboard");
        case "student":
          redirect("/student/dashboard");
        default:
          redirect("/sign-in");
      }
    }
    
    return <>{children}</>;
  };
}
