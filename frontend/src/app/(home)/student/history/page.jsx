"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    History,
    MessageCircle,
    Calendar,
    Clock,
    Search,
    Trash2,
    Edit3,
    Eye,
    Filter,
    MoreHorizontal,
    Bot,
    User,
    FileText,
    Mic,
    MicOff,
    X // Add this import
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { MarkdownStyles } from '@/components/Markdown';
import { 
    getStudentConversations, 
    getConversationById, 
    deleteConversation, 
    updateConversationTitle,
    getConversationStats
} from './action';

const StudentHistory = () => {
    const [conversations, setConversations] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [editingTitle, setEditingTitle] = useState(null);
    const [newTitle, setNewTitle] = useState('');

    // Fetch conversations and stats
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [conversationsResult, statsResult] = await Promise.all([
                    getStudentConversations(),
                    getConversationStats()
                ]);

                if (conversationsResult.success) {
                    setConversations(conversationsResult.data);
                } else {
                    toast.error('Failed to load conversations');
                }

                if (statsResult.success) {
                    setStats(statsResult.data);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
                toast.error('Failed to load conversation history');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Filter conversations based on search and filter
    const filteredConversations = conversations.filter(conversation => {
        const matchesSearch = conversation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            conversation.messages.some(msg => 
                                msg.content.toLowerCase().includes(searchTerm.toLowerCase())
                            );
        
        const matchesFilter = filterType === 'all' || 
                            (filterType === 'text' && conversation.sessionType === 'text') ||
                            (filterType === 'voice' && conversation.sessionType === 'voice') ||
                            (filterType === 'mixed' && conversation.sessionType === 'mixed');

        return matchesSearch && matchesFilter;
    });

    // Handle conversation deletion
    const handleDeleteConversation = async (conversationId) => {
        if (!confirm('Are you sure you want to delete this conversation?')) {
            return;
        }

        try {
            const formData = new FormData();
            formData.append('conversationId', conversationId);
            
            const result = await deleteConversation(formData);
            
            if (result.success) {
                setConversations(prev => prev.filter(conv => conv._id !== conversationId));
                toast.success('Conversation deleted successfully');
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
            toast.error('Failed to delete conversation');
        }
    };

    // Handle title editing
    const handleEditTitle = (conversation) => {
        setEditingTitle(conversation._id);
        setNewTitle(conversation.title);
    };

    const handleSaveTitle = async (conversationId) => {
        try {
            const formData = new FormData();
            formData.append('conversationId', conversationId);
            formData.append('title', newTitle);
            
            const result = await updateConversationTitle(formData);
            
            if (result.success) {
                setConversations(prev => prev.map(conv => 
                    conv._id === conversationId 
                        ? { ...conv, title: newTitle }
                        : conv
                ));
                setEditingTitle(null);
                toast.success('Title updated successfully');
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            console.error('Error updating title:', error);
            toast.error('Failed to update title');
        }
    };

    // Format date
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Get session type icon
    const getSessionTypeIcon = (sessionType) => {
        switch (sessionType) {
            case 'voice':
                return <Mic className="w-4 h-4" />;
            case 'mixed':
                return <MicOff className="w-4 h-4" />;
            default:
                return <MessageCircle className="w-4 h-4" />;
        }
    };

    // Get session type color
    const getSessionTypeColor = (sessionType) => {
        switch (sessionType) {
            case 'voice':
                return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'mixed':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            default:
                return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
        }
    };

    // Add this function to close the preview modal
    const closePreview = () => {
        setSelectedConversation(null);
    };

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
                                    Conversation History
                                </h1>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Your AI Tutor chat history
                                </p>
                            </div>
                        </div>
                        {stats && (
                            <div className="flex items-center space-x-4">
                                <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                    {stats.totalConversations} Conversations
                                </Badge>
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                    {stats.totalMessages} Messages
                                </Badge>
                            </div>
                        )}
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
                                            {searchTerm || filterType !== 'all' 
                                                ? 'Try adjusting your search or filter criteria.'
                                                : 'Start a conversation with your AI Tutor to see it here.'
                                            }
                                        </p>
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
                                                                {formatDate(conversation.metadata.lastMessageAt)}
                                                            </div>
                                                        </div>
                                                        
                                                        {editingTitle === conversation._id ? (
                                                            <div className="flex items-center space-x-2 mb-2">
                                                                <Input
                                                                    value={newTitle}
                                                                    onChange={(e) => setNewTitle(e.target.value)}
                                                                    className="flex-1"
                                                                />
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handleSaveTitle(conversation._id)}
                                                                >
                                                                    Save
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => setEditingTitle(null)}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                                                {conversation.title}
                                                            </h3>
                                                        )}
                                                        
                                                        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                                                            <div className="flex items-center">
                                                                <MessageCircle className="w-4 h-4 mr-1" />
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
                                                            {conversation.messages.slice(-3).map((message, msgIndex) => (
                                                                <div key={msgIndex} className="flex items-start space-x-2 text-sm">
                                                                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                                                        {message.role === 'user' ? (
                                                                            <User className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                                                                        ) : (
                                                                            <Bot className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                                                                        )}
                                                                    </div>
                                                                    <div 
                                                                        className="text-gray-600 dark:text-gray-400 truncate"
                                                                        dir={/[\u0600-\u06FF\u0750-\u077F]/.test(message.content) ? 'rtl' : 'ltr'}
                                                                        style={/[\u0600-\u06FF\u0750-\u077F]/.test(message.content) ? { direction: 'rtl', textAlign: 'right', unicodeBidi: 'embed' } : {}}
                                                                    >
                                                                        {message.role === 'user' ? (
                                                                            <p>
                                                                                {message.content.length > 100 
                                                                                    ? message.content.substring(0, 100) + '...'
                                                                                    : message.content
                                                                                }
                                                                            </p>
                                                                        ) : (
                                                                            <div className="prose prose-xs max-w-none dark:prose-invert">
                                                                                <ReactMarkdown
                                                                                    remarkPlugins={[remarkGfm, remarkMath]}
                                                                                    rehypePlugins={[rehypeKatex, rehypeRaw]}
                                                                                    components={MarkdownStyles}
                                                                                >
                                                                                    {message.content.length > 100 
                                                                                        ? message.content.substring(0, 100) + '...'
                                                                                        : message.content
                                                                                    }
                                                                                </ReactMarkdown>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center space-x-2 ml-4">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setSelectedConversation(conversation)}
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleEditTitle(conversation)}
                                                        >
                                                            <Edit3 className="w-4 h-4" />
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
                                        <MessageCircle className="w-4 h-4 mr-1" />
                                        {selectedConversation.conversationStats.totalMessages} messages
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={closePreview}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-4">
                                {selectedConversation.messages.map((message, index) => (
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
                                                <div 
                                                    className="text-sm"
                                                    dir={/[\u0600-\u06FF\u0750-\u077F]/.test(message.content) ? 'rtl' : 'ltr'}
                                                    style={/[\u0600-\u06FF\u0750-\u077F]/.test(message.content) ? { direction: 'rtl', textAlign: 'right', unicodeBidi: 'embed' } : {}}
                                                >
                                                    {message.role === 'user' ? (
                                                        <div className="whitespace-pre-wrap">{message.content}</div>
                                                    ) : (
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm, remarkMath]}
                                                            rehypePlugins={[rehypeKatex, rehypeRaw]}
                                                            components={MarkdownStyles}
                                                        >
                                                            {message.content}
                                                        </ReactMarkdown>
                                                    )}
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
        </div>
    );
};

export default StudentHistory;

