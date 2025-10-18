"use client";

import { useState, useEffect } from "react";
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
import { toast } from "sonner";
import { 
  getConversationsByType,
  getConversationDetails
} from "./action";

export default function HistoryClient({ initialConversations, initialStats, initialTab, initialPagination }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState(initialTab);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [stats, setStats] = useState(initialStats);
  const [pagination, setPagination] = useState(initialPagination || { page: 1, limit: 10, total: 0, totalPages: 0 });
  const [isClient, setIsClient] = useState(false);

  // Fix hydration mismatch by ensuring client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load conversations based on selected tab and page
  const loadConversations = async (tab = selectedTab, page = pagination.page) => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("type", tab);
      formData.append("page", page.toString());
      formData.append("limit", pagination.limit.toString());

      const result = await getConversationsByType(formData);
      
      if (result.success) {
        setConversations(result.data);
        if (result.pagination) {
          setPagination(result.pagination);
        }
      } else {
        toast.error(result.error || "Failed to load conversations");
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  };

  // Load conversation details
  const loadConversationDetails = async (conversation) => {
    try {
      const formData = new FormData();
      formData.append("conversationId", conversation._id);
      formData.append("type", conversation.type);

      const result = await getConversationDetails(formData);
      
      if (result.success) {
        setSelectedConversation(result.data);
      } else {
        toast.error(result.error || "Failed to load conversation");
      }
    } catch (error) {
      console.error("Error loading conversation details:", error);
      toast.error("Failed to load conversation details");
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.sessionId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get session type icon
  const getSessionTypeIcon = (sessionType) => {
    switch (sessionType) {
      case "voice":
        return <Mic className="size-4" />;
      case "text":
        return <MessageSquare className="size-4" />;
      default:
        return <MessageSquare className="size-4" />;
    }
  };

  // Get session type badge variant
  const getSessionTypeBadge = (sessionType) => {
    switch (sessionType) {
      case "voice":
        return "default";
      case "text":
        return "secondary";
      default:
        return "outline";
    }
  };

  // Get user type icon and color
  const getUserTypeInfo = (type) => {
    if (type === 'student') {
      return {
        icon: <GraduationCap className="size-4" />,
        badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      };
    } else {
      return {
        icon: <Users className="size-4" />,
        badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      };
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "Unknown date";
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format duration
  const formatDuration = (minutes) => {
    if (!minutes || minutes < 1) return "0m";
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  // Close conversation preview
  const closePreview = () => {
    setSelectedConversation(null);
  };

  // Pagination handlers
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadConversations(selectedTab, newPage);
    }
  };

  const handlePreviousPage = () => {
    if (pagination.page > 1) {
      handlePageChange(pagination.page - 1);
    }
  };

  const handleNextPage = () => {
    if (pagination.page < pagination.totalPages) {
      handlePageChange(pagination.page + 1);
    }
  };

  useEffect(() => {
    if (selectedTab !== initialTab) {
      loadConversations(selectedTab, 1); // Reset to page 1 when changing tabs
    }
  }, [selectedTab]);

  return (
    <>
      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
              {isClient ? (
                <Input
                  placeholder="Search conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              ) : (
                <input
                  type="text"
                  placeholder="Search conversations..."
                  defaultValue=""
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pl-10"
                />
              )}
            </div>
            {isClient ? (
              <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="student">Student</TabsTrigger>
                  <TabsTrigger value="teacher">Teacher</TabsTrigger>
                </TabsList>
              </Tabs>
            ) : (
              <div className="flex rounded-md bg-muted p-1 text-muted-foreground w-full sm:w-auto">
                <div className="flex rounded-sm bg-background px-3 py-1.5 text-sm font-medium ring-1 ring-inset ring-ring">
                  {selectedTab === 'all' ? 'All' : selectedTab === 'student' ? 'Student' : 'Teacher'}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Conversations List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full size-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="size-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No conversations found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "No conversations match your search." : "No conversations found for the selected filter."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredConversations.map((conversation) => {
            const userTypeInfo = getUserTypeInfo(conversation.type);
            return (
              <Card key={conversation._id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {userTypeInfo.icon}
                        <Badge variant="outline" className={`${userTypeInfo.badge} shrink-0`}>
                          {conversation.type}
                        </Badge>
                        {getSessionTypeIcon(conversation.sessionType)}
                        <Badge variant={getSessionTypeBadge(conversation.sessionType)} className="shrink-0">
                          {conversation.sessionType}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadConversationDetails(conversation)}
                          className="flex items-center gap-2"
                        >
                          <Eye className="size-4" />
                          <span className="hidden sm:inline">View</span>
                        </Button>
                      </div>
                    </div>

                    {/* Message Preview */}
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground line-clamp-2 break-words">
                        {conversation.lastMessage}
                      </p>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 min-w-0">
                        <User className="size-3 shrink-0" />
                        <span className="truncate">{conversation.userName || 'Unknown User'}</span>
                      </div>
                      <div className="flex items-center gap-1 min-w-0">
                        <MessageSquare className="size-3 shrink-0" />
                        <span className="truncate">{conversation.messageCount} messages</span>
                      </div>
                      <div className="flex items-center gap-1 min-w-0">
                        <Clock className="size-3 shrink-0" />
                        <span className="truncate">{formatDuration(conversation.conversationStats?.totalDuration || 0)}</span>
                      </div>
                      <div className="flex items-center gap-1 min-w-0">
                        <Calendar className="size-3 shrink-0" />
                        <span className="truncate">
                          {new Date(conversation.lastMessageAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} conversations
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={pagination.page <= 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === pagination.page ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversation Preview Modal */}
      {selectedConversation && (
        <Dialog open={!!selectedConversation} onOpenChange={() => setSelectedConversation(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getUserTypeInfo(selectedConversation.type).icon}
                {selectedConversation.title}
              </DialogTitle>
              <DialogDescription>
                Conversation details and metadata
              </DialogDescription>
            </DialogHeader>
            
            {/* Metadata Section */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-b pb-4">
              <div className="flex items-center gap-1">
                <Calendar className="size-4" />
                {formatDate(selectedConversation.lastMessageAt)}
              </div>
              <Badge 
                variant="secondary" 
                className={getUserTypeInfo(selectedConversation.type).badge}
              >
                {getUserTypeInfo(selectedConversation.type).icon}
                <span className="ml-1 capitalize">{selectedConversation.type}</span>
              </Badge>
              <div className="flex items-center gap-1">
                <MessageSquare className="size-4" />
                {selectedConversation.messageCount} messages
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 mt-4">
              {selectedConversation.messages?.map((message, index) => (
                <div
                  key={message.id || index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {message.role === 'user' ? (
                        <User className="size-4 text-muted-foreground" />
                      ) : (
                        <Bot className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className={`rounded-lg px-4 py-3 min-w-0 ${message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                    }`}>
                      <div className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </div>
                      <div className={`text-xs mt-2 ${message.role === 'user' 
                        ? 'text-primary-foreground/70' 
                        : 'text-muted-foreground'
                      }`}>
                        {formatDate(message.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              )) || <p className="text-muted-foreground">No messages found</p>}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
