"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
  MessageSquare, 
  Mic, 
  Clock, 
  Calendar, 
  Search, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Eye,
  Bug,
  Bot,
  User,
  RefreshCw,
  History,
  FileText,
  X
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { MarkdownStyles } from '@/components/Markdown';

export default function TeacherHistoryPage() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSessionType, setSelectedSessionType] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);

  // Load conversations from API
  const loadConversations = async (page = 1, sessionType = "all") => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        sessionType: sessionType
      });

      const response = await fetch(`/api/teacher/conversations?${params}`);
      const result = await response.json();

      if (result.success) {
        setConversations(result.data.conversations);
        setTotalPages(result.data.pagination.totalPages);
        setCurrentPage(page);
        console.log('Loaded conversations:', result.data.conversations.length);
      } else {
        setError(result.error || "Failed to load conversations");
        toast.error(result.error || "Failed to load conversations");
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
      setError("Failed to load conversations");
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  };

  // Load conversation details with full messages
  const loadConversationDetails = async (conversationId) => {
    try {
      const response = await fetch('/api/teacher/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversationId })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSelectedConversation(result.data);
        setEditingTitle(result.data.title);
        console.log('Loaded conversation details:', result.data);
      } else {
        toast.error(result.error || "Failed to load conversation details");
      }
    } catch (error) {
      console.error("Error loading conversation details:", error);
      toast.error("Failed to load conversation details");
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (conversationId) => {
    try {
      const params = new URLSearchParams({
        conversationId: conversationId
      });

      const response = await fetch(`/api/teacher/conversations?${params}`, {
        method: 'DELETE'
      });
      const result = await response.json();

      if (result.success) {
        toast.success("Conversation deleted successfully");
        loadConversations(currentPage, selectedSessionType);
        setSelectedConversation(null);
      } else {
        toast.error(result.error || "Failed to delete conversation");
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error("Failed to delete conversation");
    }
  };

  // Update conversation title (simplified for now)
  const handleUpdateTitle = async (conversationId) => {
    try {
      // For now, just update locally
      setConversations(prev => prev.map(conv => 
        conv._id === conversationId 
          ? { ...conv, title: editingTitle }
          : conv
      ));
      
      if (selectedConversation) {
        setSelectedConversation(prev => ({ ...prev, title: editingTitle }));
      }
      
      toast.success("Title updated successfully");
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating title:", error);
      toast.error("Failed to update title");
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
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

  // Get session type color
  const getSessionTypeColor = (sessionType) => {
    switch (sessionType) {
      case "voice":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "text":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
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

  // Debug function
  const handleDebug = async () => {
    try {
      const response = await fetch('/api/teacher/conversations?page=1&limit=100');
      const result = await response.json();
      
      if (result.success) {
        const debugInfo = `
Total conversations in DB: ${result.data.pagination.total}
Current page conversations: ${result.data.conversations.length}
        `;
        alert(debugInfo);
        console.log('Debug info:', result);
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Debug error:', error);
      toast.error('Debug failed');
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 dark:text-gray-400">Loading conversation history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/90 backdrop-blur-md"
      >
        <div className="w-full px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                <History className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Voice Coach History
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  View and manage your Voice Coach conversation history
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDebug}>
                <Bug className="size-4 mr-2" />
                Debug
              </Button>
              <Button variant="outline" size="sm" onClick={() => loadConversations(currentPage, selectedSessionType)}>
                <RefreshCw className="size-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="w-full px-4 py-6">
        <div className="max-w-6xl mx-auto">
          {/* Search and Filter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search conversations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Error Display */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <p className="text-red-600">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Conversations List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <AnimatePresence>
              {filteredConversations.length === 0 ? (
                <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardContent className="p-8 text-center">
                    <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
                      No conversations found
                    </h3>
                    <p className="text-gray-500 dark:text-gray-500">
                      {searchTerm ? "No conversations match your search." : "Start a conversation with Voice Coach to see your history here."}
                    </p>
                    <Button variant="outline" size="sm" onClick={handleDebug} className="mt-4">
                      <Bug className="size-4 mr-2" />
                      Debug Issue
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                filteredConversations.map((conversation, index) => (
                  <motion.div
                    key={conversation._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <Badge 
                                variant="secondary" 
                                className={getSessionTypeColor(conversation.sessionType)}
                              >
                                {getSessionTypeIcon(conversation.sessionType)}
                                <span className="ml-1 capitalize">{conversation.sessionType}</span>
                              </Badge>
                              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                                <Calendar className="w-4 h-4 mr-1" />
                                {formatDate(conversation.lastMessageAt)}
                              </div>
                            </div>
                            
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                              {conversation.title}
                            </h3>
                            
                            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                              <div className="flex items-center">
                                <MessageSquare className="w-4 h-4 mr-1" />
                                {conversation.conversationStats.totalMessages} messages
                              </div>
                              <div className="flex items-center">
                                <User className="w-4 h-4 mr-1" />
                                {conversation.conversationStats.userMessages} from you
                              </div>
                              <div className="flex items-center">
                                <Bot className="w-4 h-4 mr-1" />
                                {conversation.conversationStats.aiMessages} from AI
                              </div>
                              {conversation.uploadedFiles.length > 0 && (
                                <div className="flex items-center">
                                  <FileText className="w-4 h-4 mr-1" />
                                  {conversation.uploadedFiles.length} files
                                </div>
                              )}
                            </div>
                            
                            {/* Preview of last few messages */}
                            <div className="space-y-1">
                              {conversation.messages && conversation.messages.slice(-3).map((message, msgIndex) => (
                                <div key={msgIndex} className="flex items-start space-x-2 text-sm">
                                  <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                    {message.role === 'user' ? (
                                      <User className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                                    ) : (
                                      <Bot className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                                    )}
                                  </div>
                                  <p className="text-gray-600 dark:text-gray-400 truncate">
                                    {message.content.length > 100 
                                      ? message.content.substring(0, 100) + '...'
                                      : message.content
                                    }
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2 ml-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => loadConversationDetails(conversation._id)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingTitle(conversation.title);
                                setIsEditing(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteConversation(conversation._id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </motion.div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadConversations(currentPage - 1, selectedSessionType)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadConversations(currentPage + 1, selectedSessionType)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Conversation Preview Modal */}
      {selectedConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {selectedConversation.title}
                </h2>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {formatDate(selectedConversation.metadata.lastMessageAt)}
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={getSessionTypeColor(selectedConversation.sessionType)}
                  >
                    {getSessionTypeIcon(selectedConversation.sessionType)}
                    <span className="ml-1 capitalize">{selectedConversation.sessionType}</span>
                  </Badge>
                  <div className="flex items-center">
                    <MessageSquare className="w-4 h-4 mr-1" />
                    {selectedConversation.conversationStats.totalMessages} messages
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedConversation(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {selectedConversation.messages && selectedConversation.messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex items-start space-x-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row space-x-3'}`}>
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        {message.role === 'user' ? (
                          <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        ) : (
                          <Bot className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        )}
                      </div>
                      <div className={`rounded-2xl px-4 py-3 ${message.role === 'user'
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      }`}>
                        <div className="text-sm">
                          <div 
                            dir={/[\u0600-\u06FF\u0750-\u077F]/.test(message.content) ? 'rtl' : 'ltr'}
                            style={/[\u0600-\u06FF\u0750-\u077F]/.test(message.content) ? { direction: 'rtl', textAlign: 'right', unicodeBidi: 'embed' } : {}}
                          >
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeKatex, rehypeRaw]}
                              components={MarkdownStyles}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                        <div className={`text-xs mt-2 ${message.role === 'user' 
                          ? 'text-purple-100' 
                          : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedConversation.uploadedFiles.length > 0 && (
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-1" />
                      {selectedConversation.uploadedFiles.length} file(s) attached
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Title Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Conversation Title</DialogTitle>
            <DialogDescription>
              Update the title for this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              placeholder="Enter conversation title..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                if (selectedConversation) {
                  handleUpdateTitle(selectedConversation._id);
                }
              }}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

