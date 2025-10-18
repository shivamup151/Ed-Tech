"use client"
import { Home, Settings2Icon, BookOpen, LogOut, BarChart3, History, Users } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth-client";
import { ModeToggle } from "@/components/ui/theme-toggle";

const MENU_ITEMS = [
  { title: "Dashboard", url: "/admin/dashboard", icon: Home, },
  { title: "Users", url: "/admin/user-management", icon: Users, },
  { title: "Curriculums", url: "/admin/curriculum-management", icon: BookOpen, },
  { title: "History", url: "/admin/history", icon: History, },
  { title: "Settings", url: "/admin/settings", icon: Settings2Icon, },

];

export function AdminSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  const isActivePath = useCallback((url) => {
    return pathname === url;
  }, [pathname]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    const getUser = async () => {
      try {
        const { data } = await authClient.getSession();
        setUser(data?.user || null);
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setIsLoading(false);
      }
    };

    getUser();
  }, [isClient]);

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      router.push("/sign-in");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <Sidebar collapsible="icon" suppressHydrationWarning>

      <SidebarHeader className="border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold group-data-[collapsible=icon]:hidden">Admin Panel</span>
            <span className="text-xl font-bold hidden group-data-[collapsible=icon]:block">A</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-2 mt-6">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {MENU_ITEMS.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <Link href={item.url} className={`flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent ${isActivePath(item.url)
                        ? "bg-accent border-l-4 border-l-violet-500 shadow-sm"
                        : ""
                      }`}>
                      <item.icon className="h-5 w-5 min-w-5" />
                      <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">
                        {item.title}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border mt-auto">
        <div className="hidden group-data-[collapsible=icon]:block border-b border-border">
          <div className="flex justify-center p-2">
            <SidebarTrigger className="h-6 w-6" />
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="flex-1 h-8 px-2 group-data-[collapsible=icon]:px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            title="Logout"
            suppressHydrationWarning
          >
            <LogOut className="h-4 w-4" />
            <span className="ml-2 text-xs group-data-[collapsible=icon]:hidden">
              Logout
            </span>
          </Button>
          
          {/* Theme Toggle next to Logout */}
          <div className="group-data-[collapsible=icon]:hidden" suppressHydrationWarning>
            <ModeToggle />
          </div>
        </div>


        <div className="flex items-center justify-between gap-3 p-4">
          {isLoading ? (
            <div className="flex items-center gap-3 w-full">
              <div className="h-8 w-8 rounded-full bg-gray-200 animate-pulse" />
              <div className="group-data-[collapsible=icon]:hidden min-w-0 flex-1">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-1" />
                <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ) : (
            <>
              <Avatar className="flex-shrink-0 h-8 w-8">
                <AvatarImage src={user?.profilePicture} alt={user?.name} />
                <AvatarFallback className="text-xs">
                  {user?.name?.charAt(0) || "T"}
                </AvatarFallback>
              </Avatar>
              <div className="group-data-[collapsible=icon]:hidden min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {user?.name || "Admin"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email || "admin@example.com"}
                </p>
              </div>
            </>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}