// frontend/src/components/student-sidebar.jsx
"use client"

import React, { useCallback, useState, useEffect } from "react"
import { 
  Home, 
  BookOpen, 
  Award, 
  Sparkles, 
  Star, 
  Brain,
  History,
  LogOut,
  StarIcon
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { authClient } from "@/lib/auth-client"
import { ModeToggle } from "@/components/ui/theme-toggle"
import { Button } from "../ui/button"

// Fun gradients for kids UI (from UIGradients)
const kidGradients = {
  purple: "from-violet-500 via-purple-500 to-indigo-500",
  orange: "from-amber-400 via-orange-500 to-pink-500",
  blue: "from-blue-400 via-cyan-500 to-sky-500",
  green: "from-emerald-400 via-green-500 to-teal-500",
  pink: "from-pink-400 via-rose-500 to-fuchsia-500",
}

// Navigation items for student area
const navigationItems = [
  {
    title: "Dashboard",
    url: "/student/dashboard",
    icon: Home,
    badge: null,
    gradient: kidGradients.purple,
  },
  {
    title: "Learning Library",
    url: "/student/learning-library",
    icon: BookOpen,
    badge: null,
    gradient: kidGradients.blue,
  },
  {
    title: "My Learning",
    url: "/student/my-learning",
    icon: Brain,
    badge: null,
    gradient: kidGradients.green,
  },
  
  {
    title: "Achievements",
    url: "/student/achievements",
    icon: Award,
    badge: "NEW",
    badgeVariant: "secondary",
    gradient: kidGradients.pink,
  },
  {
    title: "AI Tutor",
    url: "/student/ai-tutor",
    icon: Brain,
    badge: null,
    gradient: kidGradients.orange,
  },
  {
    title: "History",
    url: "/student/history",
    icon: History,
    badge: null,
    gradient: kidGradients.orange,
  },
]

export function StudentSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)

  const isActivePath = useCallback((url) => {
    return pathname === url
  }, [pathname])

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    const getUser = async () => {
      try {
        const { data } = await authClient.getSession()
        setUser(data?.user || null)
      } catch (error) {
        console.error("Error fetching user:", error)
      } finally {
        setIsLoading(false)
      }
    }

    getUser()
  }, [isClient])

  const handleLogout = async () => {
    try {
      await authClient.signOut()
      router.push("/sign-in")
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  return (
    <Sidebar className="border-r border-border/40" suppressHydrationWarning>
      {/* Header with logo and title */}
      <SidebarHeader className="border-b border-border/40 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-foreground">LearnFun</h1>
            <p className="text-xs text-muted-foreground">Student Portal</p>
          </div>
        </div>
      </SidebarHeader>

      {/* Navigation menu */}
      <SidebarContent className="p-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {navigationItems.map((item) => ( 
                <SidebarMenuItem key={item.title}>
                  {item.isHeader ? (
                    <SidebarGroupLabel className="text-xs font-bold text-muted-foreground mb-2 px-1 mt-4">
                      {item.title}
                    </SidebarGroupLabel>
                  ) : (
                    <SidebarMenuButton 
                      asChild
                      className={`group relative h-12 rounded-xl transition-all duration-200 hover:bg-accent/60 ${
                        isActivePath(item.url) 
                          ? 'bg-accent border-l-4 border-l-violet-500 shadow-sm' 
                          : 'hover:translate-x-1'
                      }`}
                    >
                      <Link href={item.url} className="flex items-center gap-3 px-4">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${item.gradient} text-white shadow-sm`}>
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className={`font-medium transition-colors truncate ${
                            isActivePath(item.url) 
                              ? 'text-foreground font-semibold' 
                              : 'text-muted-foreground group-hover:text-foreground'
                          }`}>
                            {item.title}
                          </span>
                          {item.subtitle && (
                            <span className="text-xs text-muted-foreground truncate">
                              {item.subtitle}
                            </span>
                          )}
                        </div>
                        {item.badge && (
                          <Badge 
                            variant={item.badgeVariant || "default"} 
                            className="ml-auto text-xs px-2 py-0.5 flex-shrink-0"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with user profile and theme toggle */}
      <SidebarFooter className="border-t border-border/40 p-4">
        {/* User Actions - Always visible */}
        <div className="flex items-center gap-2 p-2 mb-2 rounded-xl bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 backdrop-blur-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="flex-1 h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            title="Logout"
            suppressHydrationWarning
          >
            <LogOut className="h-4 w-4" />
            <span className="ml-2 text-xs">
              Logout
            </span>
          </Button>
          
          {/* Theme Toggle next to Logout */}
          <div suppressHydrationWarning>
            <ModeToggle />
          </div>
        </div>

        {/* User Profile Container - No longer clickable */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 backdrop-blur-sm w-full">
          {isLoading ? (
            <div className="flex items-center gap-3 w-full">
              <div className="h-9 w-9 rounded-lg bg-gray-200 animate-pulse" />
              <div className="flex flex-col flex-1">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-1" />
                <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9 rounded-lg">
                <AvatarImage src={user?.profilePicture} alt={user?.name} />
                <AvatarFallback>
                  {user?.name?.charAt(0)?.toUpperCase() || 'S'}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <p className="text-sm font-medium">{user?.name || 'Student'}</p>
              </div>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

export default StudentSidebar
