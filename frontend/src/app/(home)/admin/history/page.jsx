import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  MessageSquare, 
  Mic, 
  Clock, 
  Calendar, 
  Search, 
  MoreVertical, 
  Eye,
  Filter,
  Users,
  GraduationCap,
  Bot,
  User,
  FileText,
  BarChart3,
  X
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  getAllConversations,
  getConversationsByType,
  getAdminConversationStats,
  getConversationDetails
} from "./action";
import HistoryClient from "./history-client";

// Server Component - fetches data on the server
export default async function AdminHistoryPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const tab = resolvedSearchParams?.tab || "all";
  
  // Fetch initial data on the server
  const formData = new FormData();
  formData.append("type", tab);
  
  const [conversationsResult, statsResult] = await Promise.all([
    getConversationsByType(formData),
    getAdminConversationStats()
  ]);

  const initialConversations = conversationsResult.success ? conversationsResult.data : [];
  const initialStats = statsResult.success ? statsResult.data : null;
  const initialPagination = conversationsResult.success ? conversationsResult.pagination : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900">
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Admin History</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              View and monitor all conversations across the platform
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {initialStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Messages</p>
                    <p className="text-2xl font-bold">{initialStats.total.messages}</p>
                  </div>
                  <MessageSquare className="size-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Teacher Conversations</p>
                    <p className="text-2xl font-bold">{initialStats.teacher.totalTeacherConversations}</p>
                  </div>
                  <Users className="size-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Client Component for interactive features */}
        <Suspense fallback={
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full size-8 border-b-2 border-primary"></div>
          </div>
        }>
        <HistoryClient 
          initialConversations={initialConversations}
          initialStats={initialStats}
          initialTab={tab}
          initialPagination={initialPagination}
        />
        </Suspense>
      </div>
    </div>
  );
}