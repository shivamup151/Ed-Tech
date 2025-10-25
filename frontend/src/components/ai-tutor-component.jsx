"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Send,
    Bot,
    MessageCircle,
    Settings,
    Brain,
    Sparkle,
    Sparkles,
    User,
    AudioLines,
    File,
    UploadCloud,
    History,
    MessageCircle as MessageCircleIcon,
    Calendar,
    Clock,
    Search,
    Trash2,
    Edit3,
    Eye,
    Filter,
    MoreHorizontal,
    Bot as BotIcon,
    User as UserIcon,
    FileText,
    Mic,
    MicOff,
    MessageSquare, // NEW: Add this icon
    Plus, // NEW: Add this icon
    AlertCircle, // NEW: Add this icon
    Upload, // NEW: Add this icon
    GraduationCap, // ADD: Use same icon as voice-coach
    Volume2, // NEW: Add volume icon for voice selection
    Copy, // NEW: Add copy icon
    Download, // NEW: Add download icon
    BookOpen // Add BookOpen icon for subject
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PythonApi from '@/lib/PythonApi';
import { toast } from 'sonner';
import { MarkdownStyles } from '@/components/Markdown';
import { generateHydrationSafeId, getHydrationSafeTimestamp, useIsClient } from '@/lib/hydration-safe'; // FIXED: Use imported MarkdownStyles
import { 
    uploadDocuments, 
    createAiTutorSession,
    getStudentProgressData,
    getStudentAchievementsData,
    getStudentLearningStats,
    getCurrentUserData
} from '../app/(home)/student/ai-tutor/action';
import { getSubjectsAndGrades } from '../app/(home)/admin/user-management/action';
import { saveStudentConversation } from '../app/(home)/student/history/action';
import { RealtimeOpenAIService } from '@/lib/realtimeOpenAI';

// Import the Video component instead of 3D model
import dynamic from 'next/dynamic';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Import the new Video component
const VoiceCoachVideo = dynamic(() => import('./VoiceCoachVideo'), { 
    ssr: false,
    loading: () => (
        <div className="w-[400px] h-[550px] flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-md">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Loading Video...</p>
            </div>
        </div>
    )
});

const AiTutor = () => {
    const [messages, setMessages] = useState([
        {
            id: 1,
            type: 'ai',
            content: "Hi there! 👋 I'm your AI Tutor Buddy! I'm here to help you learn and understand your homework. What would you like to work on today?",
            timestamp: null, // Will be set on client side
            avatar: <GraduationCap className="w-4 h-4 text-blue-500" /> // CHANGED: Use GraduationCap
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const messagesEndRef = useRef(null);
    const scrollAreaRef = useRef(null);
    
    // Updated voice session state for RealtimeOpenAI - matching voice-coach approach
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [realtimeService, setRealtimeService] = useState(null);
    const [isListening, setIsListening] = useState(false);
    const [transcription, setTranscription] = useState('');
    
    // NEW: Video state instead of lip sync
    const [isSpeaking, setIsSpeaking] = useState(false);
    
    // NEW: Voice gender selection state
    const [selectedVoiceGender, setSelectedVoiceGender] = useState('female');

    // NEW: Add subject selection state
    const [selectedSubject, setSelectedSubject] = useState('');

    // Real student data state
    const [user, setUser] = useState(null);
    const [studentData, setStudentData] = useState({
        lessons: [],
        resources: [],
        progress: [],
        achievements: [],
        learningStats: {},
        userProgress: []
    });
    const [dataLoading, setDataLoading] = useState(true);

    // NEW: Teacher feedback state
    const [teacherFeedback, setTeacherFeedback] = useState([]);
    const [showFeedbackOption, setShowFeedbackOption] = useState(false);
    const [selectedFeedbackId, setSelectedFeedbackId] = useState('');

    // NEW: Add subjects state
    const [availableSubjects, setAvailableSubjects] = useState([]);

    // Fix hydration mismatch by ensuring client-side rendering
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        // Set timestamp for initial message on client side
        setMessages(prev => prev.map((msg, index) => 
            index === 0 ? { ...msg, timestamp: new Date() } : msg
        ));
    }, []);

    // FIXED: Initialize audio context when component mounts
    useEffect(() => {
        const initAudioContext = async () => {
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                console.log('Audio context initialized');
            } catch (error) {
                console.error('Failed to initialize audio context:', error);
            }
        };

        initAudioContext();
    }, []);

    // REMOVED: Auto-scrolling functionality

    // FIXED: Handle transcript updates - prevent duplicate messages
    useEffect(() => {
        if (transcription) {
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                
                // FIXED: Only create new message if there's no existing live AI message
                if (!lastMessage || lastMessage.type !== 'ai' || !lastMessage.isLive) {
                    // Add new live message
                    newMessages.push({ 
                        id: generateHydrationSafeId('ai'),
                        type: 'ai', 
                        content: transcription, 
                        isLive: true,
                        timestamp: getHydrationSafeTimestamp(isClient),
                        avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
                    });
                } else {
                    // Update existing live message
                    newMessages[newMessages.length - 1] = { 
                        ...lastMessage, 
                        content: transcription,
                        id: lastMessage.id // Keep the same ID
                    };
                }
                
                return newMessages;
            });
        }
    }, [transcription]);

    // Fetch real student data
    useEffect(() => {
        const fetchStudentData = async () => {
            setDataLoading(true);
            try {
                // Fetch all student data in parallel using the new action functions
                const [userResult, progressResult, achievementsResult, statsResult] = await Promise.all([
                    getCurrentUserData(),
                    getStudentProgressData(),
                    getStudentAchievementsData(),
                    getStudentLearningStats()
                ]);

                // Set user data from the API response
                if (userResult.success) {
                    setUser({
                        _id: userResult.data._id,
                        email: userResult.data.email,
                        name: userResult.data.name || userResult.data.email,
                        grade: userResult.data.grade || '8'
                        // Remove subjects - will be fetched from curriculum
                    });
                } else {
                    // Fallback user data
                    setUser({
                        _id: 'fallback_user_id',
                        email: 'student@example.com',
                        name: 'Student',
                        grade: '8'
                        // Remove subjects - will be fetched from curriculum
                    });
                }

                // Set student data from API responses
                setStudentData({
                    lessons: progressResult.success ? progressResult.data.filter(item => item.contentType === 'lesson') : [],
                    resources: progressResult.success ? progressResult.data : [],
                    progress: progressResult.success ? progressResult.data : [],
                    achievements: achievementsResult.success ? achievementsResult.data : [],
                    learningStats: statsResult.success ? statsResult.data : {},
                    userProgress: progressResult.success ? progressResult.data : []
                });

                console.log('Student data loaded:', {
                    user: userResult.success ? userResult.data.name : 'fallback',
                    progress: progressResult.success ? progressResult.data.length : 0,
                    achievements: achievementsResult.success ? achievementsResult.data.length : 0,
                    stats: statsResult.success ? statsResult.data : {}
                });

            } catch (error) {
                console.error('Failed to fetch student data:', error);
                toast.error('Failed to load your learning data');
                
                // Set fallback data
                setUser({
                    _id: 'fallback_user_id',
                    email: 'student@example.com',
                    name: 'Student',
                    grade: '8'
                    // Remove subjects - will be fetched from curriculum
                });
            } finally {
                setDataLoading(false);
            }
        };

        fetchStudentData();
    }, []);

    // NEW: Fetch teacher feedback when user data is loaded
    useEffect(() => {
        if (user?._id) {
            const fetchFeedback = async () => {
                try {
                    const response = await fetch(`/api/student/feedback/${user._id}`);
                    const data = await response.json();
                    
                    if (data.success && data.feedback && data.feedback.length > 0) {
                        setTeacherFeedback(data.feedback);
                        setShowFeedbackOption(true);
                    }
                } catch (error) {
                    console.error('Error fetching feedback:', error);
                }
            };
            
            fetchFeedback();
        }
    }, [user?._id]);

    // Server action getSubjectsForGrade is now imported from user-management

    // NEW: Set default subject when user data is loaded
    useEffect(() => {
        if (user?.grade) {
            const fetchSubjects = async () => {
                const result = await getSubjectsAndGrades();
                if (result.success && result.gradeSubjectPairs) {
                    // Filter subjects for the user's grade
                    const subjectsForGrade = result.gradeSubjectPairs
                        .filter(pair => pair.grade === user.grade)
                        .map(pair => pair.subject);
                    
                    console.log('Subjects for grade', user.grade, ':', subjectsForGrade);
                    setAvailableSubjects(subjectsForGrade);
                    if (subjectsForGrade.length > 0 && !selectedSubject) {
                        setSelectedSubject(subjectsForGrade[0]);
                    }
                }
            };
            fetchSubjects();
        }
    }, [user?.grade || '']); // Only re-fetch when grade changes, ensure consistent array size

    // Initialize session when user data is loaded
    useEffect(() => {
        if (user && !dataLoading) {
            const initializeSession = async () => {
                try {
                    // Create session using action
                    const sessionFormData = new FormData();
                    sessionFormData.append('userId', user._id);
                    sessionFormData.append('studentData', JSON.stringify({
                        grade: user.grade,
                        subjects: user.subjects || [],
                        progress: studentData.progress,
                        achievements: studentData.achievements,
                        learningStats: studentData.learningStats
                    }));
                    
                    const sessionResult = await createAiTutorSession(sessionFormData);
                    if (sessionResult.success) {
                        setSessionId(sessionResult.sessionId);
                    }
                } catch (error) {
                    console.error('Failed to create session:', error);
                }
            };

            initializeSession();
        }
    }, [user, dataLoading, studentData]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Clean up RealtimeOpenAI service on unmount
            if (realtimeService) {
                realtimeService.disconnect();
            }
        };
    }, [realtimeService]);

    // FIXED: Save conversation to history with proper state management
    const saveConversationToHistory = async (messagesToSave, sessionType = 'text') => {
        try {
            const conversationData = {
                sessionId: sessionId,
                title: `AI Tutor Chat - ${new Date().toLocaleDateString()}`,
                sessionType: sessionType,
                messages: messagesToSave.map(msg => ({
                    id: msg.id.toString(),
                    role: msg.type === 'user' ? 'user' : 'assistant',
                    content: msg.content,
                    timestamp: msg.timestamp,
                    isImageResponse: msg.isImageResponse || false,
                    metadata: {
                        messageType: msg.isImageResponse ? 'image' : 'text',
                        fileAttachments: [],
                        processingTime: 0
                    }
                })),
                uploadedFiles: uploadedFiles.map(file => ({
                    filename: file.name,
                    originalName: file.name,
                    fileType: file.type,
                    uploadTime: new Date()
                })),
                studentData: {
                    grade: user?.grade || '8',
                    subjects: user?.subjects || [],
                    progress: studentData.progress,
                    achievements: studentData.achievements,
                    learningStats: studentData.learningStats
                },
                conversationStats: {
                    totalMessages: messagesToSave.length,
                    userMessages: messagesToSave.filter(m => m.type === 'user').length,
                    aiMessages: messagesToSave.filter(m => m.type === 'ai').length,
                    totalDuration: 0,
                    topicsDiscussed: [],
                    difficultyLevel: 'medium',
                    learningOutcomes: []
                },
                metadata: {
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    lastMessageAt: new Date(),
                    isActive: true,
                    tags: []
                }
            };

            const formData = new FormData();
            formData.append('conversationData', JSON.stringify(conversationData));
            
            const result = await saveStudentConversation(formData);
            
            if (result.success) {
                console.log('Conversation saved to history successfully');
            } else {
                console.error('Failed to save conversation:', result.error);
            }
        } catch (error) {
            console.error('Error saving conversation to history:', error);
        }
    };

    // Send message handler - FIXED to properly handle uploaded files AND images
    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const currentQuery = inputValue.trim();
        setInputValue('');
        
        // Declare streamingMessage at function level so it's accessible in catch block
        let streamingMessage = null;

        try {
            setIsLoading(true);

            // Add user message to chat - FIXED: Use unique key generation
            const userMessage = {
                id: generateHydrationSafeId('user'),
                type: 'user',
                content: currentQuery,
                timestamp: getHydrationSafeTimestamp(isClient),
                avatar: <User className="w-4 h-4 text-blue-500" />
            };

            setMessages(prev => [...prev, userMessage]);

            // Prepare student data for AI tutor - match Python backend schema
            const enhancedStudentData = {
                id: user._id || 'fallback_user_id',
                email: user.email || 'student@example.com',
                name: user.name || 'Student',
                grade: user.grade || '8',
                subject: selectedSubject || 'English', // NEW: Add selected subject
                progress: {
                    totalResources: studentData.progress?.length || 0,
                    completedResources: studentData.progress?.filter(p => p.status === 'completed').length || 0,
                    averageProgress: studentData.progress?.length > 0 ? 
                        (studentData.progress.filter(p => p.status === 'completed').length / studentData.progress.length) * 100 : 0,
                    totalStudyTime: studentData.progress?.reduce((sum, p) => sum + (p.progress?.timeSpent || 0), 0) || 0
                },
                achievements: studentData.achievements || [],
                learning_stats: studentData.learningStats || {},
                assessments: studentData.assessments || [],
                lessons: studentData.lessons || [],
                resources: studentData.resources || [],
                analytics: studentData.analytics || [],
                // NEW: Include selected teacher feedback (wrapped in array as expected by backend)
                teacher_feedback: selectedFeedbackId && selectedFeedbackId !== 'none' ? [teacherFeedback.find(f => f.id === selectedFeedbackId)] : []
            };

            // Make direct fetch request to Python backend for streaming
            const payload = {
                session_id: sessionId,
                query: currentQuery,
                history: [...messages, userMessage].slice(1).map(msg => ({
                    role: msg.type === 'user' ? 'user' : 'assistant',
                    content: msg.content
                })),
                web_search_enabled: true,
                student_data: enhancedStudentData,
                uploaded_files: uploadedFiles.map(f => f.name), // Just file names, not objects
                use_feedback: selectedFeedbackId && selectedFeedbackId !== 'none',
            };

            console.log('Sending payload to Python backend:', payload);

            const response = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_API_URL}/chatbot_endpoint`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Backend error: ${response.status} - ${errorText}`);
            }

            // Create AI message for streaming - FIXED: Use unique key generation
            streamingMessage = {
                id: generateHydrationSafeId('ai'),
                type: 'ai',
                content: '',
                timestamp: getHydrationSafeTimestamp(isClient),
                avatar: <GraduationCap className="w-4 h-4 text-blue-500" />,
                isStreaming: true,
                isImageResponse: false
            };

            setMessages(prev => [...prev, streamingMessage]);

            // Handle streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                buffer += chunk;
                
                // Split by lines and process each complete line
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.slice(6);
                            
                            // FIXED: Check if this is an image response - EXACTLY like voice-coach action
                            if (jsonStr.includes('__IMAGE_RESPONSE__')) {
                                const imageContent = jsonStr.replace('__IMAGE_RESPONSE__', '');
                                
                                try {
                                    const data = JSON.parse(imageContent);
                                    if (data.content) {
                                        // Update the streaming message with image content
                                        setMessages(prev => prev.map(msg => 
                                            msg.id === streamingMessage.id 
                                                ? { 
                                                    ...msg, 
                                                    content: data.content,
                                                    isImageResponse: true,
                                                    isStreaming: false
                                                }
                                                : msg
                                        ));
                                    } else {
                                        // Update with raw image content
                                        setMessages(prev => prev.map(msg => 
                                            msg.id === streamingMessage.id 
                                                ? { 
                                                    ...msg, 
                                                    content: imageContent,
                                                    isImageResponse: true,
                                                    isStreaming: false
                                                }
                                                : msg
                                        ));
                                    }
                                } catch (parseError) {
                                    // Update with raw image content if parsing fails
                                    setMessages(prev => prev.map(msg => 
                                        msg.id === streamingMessage.id 
                                            ? { 
                                                ...msg, 
                                                content: imageContent,
                                                isImageResponse: true,
                                                isStreaming: false
                                            }
                                            : msg
                                    ));
                                }
                                continue;
                            }
                            
                            // Handle regular text chunks
                            const data = JSON.parse(jsonStr);
                            
                            if (data.type === 'text_chunk' && data.content) {
                                setMessages(prev => prev.map(msg => 
                                    msg.id === streamingMessage.id 
                                        ? { 
                                            ...msg, 
                                            content: msg.content + data.content
                                        }
                                        : msg
                                ));
                            } else if (data.type === 'done') {
                                // FIXED: Update the streaming message to mark as complete
                                setMessages(prev => {
                                    const updatedMessages = prev.map(msg => 
                                        msg.id === streamingMessage.id 
                                            ? { ...msg, isStreaming: false }
                                            : msg
                                    );
                                    
                                    // FIXED: Save conversation immediately with the complete message
                                    setTimeout(async () => {
                                        try {
                                            await saveConversationToHistory(updatedMessages, 'text');
                                        } catch (error) {
                                            console.error('Failed to save conversation:', error);
                                        }
                                    }, 100); // Small delay to ensure state is updated
                                    
                                    return updatedMessages;
                                });
                            } else if (data.type === 'error') {
                                throw new Error(data.message || 'Unknown error');
                            }
                        } catch (parseError) {
                            console.warn('Failed to parse SSE data:', parseError);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Failed to send message. Please try again.');
            
            // Update streaming message with error
            if (streamingMessage) {
                setMessages(prev => prev.map(msg => 
                    msg.id === streamingMessage.id 
                        ? { 
                            ...msg, 
                            content: `❌ Error: ${error.message}`,
                            isStreaming: false 
                        }
                        : msg
                ));
            } else {
                // Add error message if no streaming message was created - FIXED: Use unique key generation
                const errorMessage = {
                    id: Date.now() + Math.random(),
                    type: 'ai',
                    content: `❌ Error: ${error.message}`,
                    timestamp: new Date(),
                    avatar: <AlertCircle className="w-4 h-4 text-red-500" />
                };
                setMessages(prev => [...prev, errorMessage]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Enhanced file upload handler using action
    const handleUpload = () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.mp3,.mp4,.wav,.ogg,.webm,.zip,.rar,.7z,.tar,.gz,.bz2,.xlsx,.xls,.csv,.ppt,.pptx';
        fileInput.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            setIsUploading(true);
            try {
                // Use action to upload files
                const formData = new FormData();
                formData.append('sessionId', sessionId);
                files.forEach(file => {
                    formData.append('files', file);
                });

                const uploadResult = await uploadDocuments(formData);
                
                if (uploadResult.success) {
                    // Add files to local state
                    setUploadedFiles(prev => [...prev, ...files]);
                    
                    // Add success message to chat - FIXED: Use unique key generation
                    const uploadMessage = {
                        id: Date.now() + Math.random(),
                        type: 'ai',
                        content: `✅ Successfully uploaded ${files.length} document(s)! I can now help you with questions about these files.`,
                        timestamp: new Date(),
                        avatar: <Upload className="w-4 h-4 text-green-500" />
                    };
                    setMessages(prev => [...prev, uploadMessage]);
                    
                    toast.success(`Uploaded ${files.length} document(s) successfully!`);
                    
                    // Show warnings if any files were rejected
                    if (uploadResult.errors && uploadResult.errors.length > 0) {
                        toast.warning(`Some files were rejected: ${uploadResult.errors.join(', ')}`);
                    }
                } else {
                    throw new Error(uploadResult.error);
                }
            } catch (error) {
                console.error('Upload error:', error);
                toast.error('Failed to upload documents. Please try again.');
                
                // Add error message to chat - FIXED: Use unique key generation
                const errorMessage = {
                    id: Date.now() + Math.random(),
                    type: 'ai',
                    content: `❌ Failed to upload documents: ${error.message}`,
                    timestamp: new Date(),
                    avatar: <AlertCircle className="w-4 h-4 text-red-500" />
                };
                setMessages(prev => [...prev, errorMessage]);
            } finally {
                setIsUploading(false);
            }
        };
        fileInput.click();
    };

    // Clear uploaded files
    const handleClearFiles = () => {
        setUploadedFiles([]);
        toast.info('Cleared uploaded documents');
        
        // Add info message to chat - FIXED: Use unique key generation
        const clearMessage = {
            id: Date.now() + Math.random(),
            type: 'ai',
            content: "🗑️ Cleared all uploaded documents. You can upload new ones anytime!",
            timestamp: new Date(),
            avatar: <Trash2 className="w-4 h-4 text-blue-500" />
        };
        setMessages(prev => [...prev, clearMessage]);
    };

    // Add copy functionality
    const handleCopyMessage = async (content) => {
        try {
            await navigator.clipboard.writeText(content);
            toast.success('Message copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy:', error);
            toast.error('Failed to copy message');
        }
    };

    // Enhanced image rendering component
    const ImageMessage = ({ content }) => {
        const imageMatch = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/);
        
        if (imageMatch) {
            const imageUrl = imageMatch[1];
            return (
                <div className="my-4 flex justify-center">
                    <img 
                        src={imageUrl}
                        alt="Generated image"
                        className="max-w-full h-auto rounded-lg shadow-lg border border-gray-200 dark:border-gray-600"
                        style={{ maxHeight: '400px' }}
                        onError={(e) => {
                            console.error('Image failed to load:', e.target.src);
                            e.target.style.display = 'none';
                        }}
                        onLoad={() => {
                            console.log('Image loaded successfully');
                        }}
                    />
                </div>
            );
        }
        
        return (
            <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownStyles}>
                    {content}
                </ReactMarkdown>
            </div>
        );
    };

    // Update the renderMessageContent function to handle images properly
    const renderMessageContent = (message) => {
        if (message.isImageResponse) {
            return <ImageMessage content={message.content} />;
        } else {
            return (
                <div className="relative group">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownStyles}>
                            {message.content}
                        </ReactMarkdown>
                    </div>
                    {/* Copy button - only show for AI messages */}
                    {message.type === 'ai' && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyMessage(message.content)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800"
                            title="Copy message"
                        >
                            <Copy className="w-3 h-3" />
                        </Button>
                    )}
                </div>
            );
        }
    };

    // Add export functionality with format selection
    const handleExportConversation = async () => {
        if (messages.length <= 1) {
            toast.error('No conversation to export');
            return;
        }

        // Show format selection dialog
        const format = await showExportFormatDialog();
        if (!format) return; // User cancelled

        try {
            // Filter out system messages and create conversation data
            const conversationMessages = messages.filter(msg => 
                msg.type === 'user' || msg.type === 'ai'
            );

            // Create formatted conversation text
            const conversationText = conversationMessages.map(msg => {
                const timestamp = msg.timestamp.toLocaleString();
                const role = msg.type === 'user' ? 'User' : 'AI Tutor';
                return `[${timestamp}] ${role}:\n${msg.content}\n\n`;
            }).join('');

            if (format === 'doc') {
                await exportAsDOC(conversationText, conversationMessages);
            } else {
                // Fallback to text export
                await exportAsText(conversationText);
            }
            
            toast.success(`Conversation exported as ${format.toUpperCase()} successfully!`);
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export conversation');
        }
    };

    // Show export format selection dialog
    const showExportFormatDialog = () => {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            dialog.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Export Conversation</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">Choose the format for your conversation export:</p>
                    <div class="space-y-3">
                        <button class="w-full flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" data-format="doc">
                            <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-3">
                                <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                            <div class="text-left">
                                <div class="font-medium text-gray-900 dark:text-white">Word Document</div>
                                <div class="text-sm text-gray-500 dark:text-gray-400">Microsoft Word Format</div>
                            </div>
                        </button>
                        <button class="w-full flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" data-format="txt">
                            <div class="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mr-3">
                                <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"></path>
                                </svg>
                            </div>
                            <div class="text-left">
                                <div class="font-medium text-gray-900 dark:text-white">Text File</div>
                                <div class="text-sm text-gray-500 dark:text-gray-400">Plain Text Format</div>
                            </div>
                        </button>
                    </div>
                    <div class="flex justify-end space-x-3 mt-6">
                        <button class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white" data-action="cancel">Cancel</button>
                    </div>
                </div>
            `;

            // Add event listeners
            dialog.addEventListener('click', (e) => {
                if (e.target.dataset.format) {
                    document.body.removeChild(dialog);
                    resolve(e.target.dataset.format);
                } else if (e.target.dataset.action === 'cancel') {
                    document.body.removeChild(dialog);
                    resolve(null);
                }
            });

            // Close on backdrop click
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    document.body.removeChild(dialog);
                    resolve(null);
                }
            });

            document.body.appendChild(dialog);
        });
    };

    // Export as DOC (RTF format that can be opened in Word)
    const exportAsDOC = async (conversationText, conversationMessages) => {
        // Create RTF content
        let rtfContent = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}
{\\colortbl;\\red0\\green0\\blue0;\\red0\\green0\\blue255;\\red0\\green128\\blue0;}
\\f0\\fs24
{\\b AI Tutor Conversation}\\par
Exported on: ${new Date().toLocaleDateString()}\\par\\par`;

        conversationMessages.forEach(msg => {
            const timestamp = msg.timestamp.toLocaleString();
            const role = msg.type === 'user' ? 'User' : 'AI Tutor';
            rtfContent += `{\\b [${timestamp}] ${role}:}\\par`;
            rtfContent += `${msg.content.replace(/\n/g, '\\par ')}\\par\\par`;
        });

        rtfContent += '}';

        // Create blob and download
        const blob = new Blob([rtfContent], { type: 'application/rtf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-tutor-conversation-${new Date().toISOString().split('T')[0]}.rtf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Export as text (fallback)
    const exportAsText = async (conversationText) => {
        const blob = new Blob([conversationText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-tutor-conversation-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // UPDATED: Start voice session handler using RealtimeOpenAI (same approach as voice-coach)
    const startVoiceSessionHandler = async () => {
        if (isVoiceActive) {
            // Stop voice session
            try {
                if (realtimeService) {
                    realtimeService.disconnect();
                    setRealtimeService(null);
                }
            } catch (error) {
                console.error('Error disconnecting RealtimeOpenAI:', error);
            }
            setIsVoiceActive(false);
            setIsListening(false);
            setTranscription(''); // Reset transcription
            setIsSpeaking(false); // Reset speaking state
            return;
        }

        try {
            setIsLoading(true);
            
            // Get comprehensive student data
            const studentDataResult = await getCurrentUserData();
            const progressResult = await getStudentProgressData();
            const achievementsResult = await getStudentAchievementsData();
            const statsResult = await getStudentLearningStats();
            
            if (!studentDataResult.success) {
                throw new Error("Failed to load student data");
            }

            const user = studentDataResult.data;
            const studentData = {
                progress: progressResult.success ? progressResult.data : [],
                achievements: achievementsResult.success ? achievementsResult.data : [],
                learningStats: statsResult.success ? statsResult.data : {},
                resources: [],
                lessons: [],
                userProgress: statsResult.success ? statsResult.data : {}
            };

            // Prepare comprehensive student data for RealtimeOpenAI
            const studentContext = {
                studentName: user.name || user.email,
                studentId: user._id,
                email: user.email,
                grade: user.grade || '8',
                subject: selectedSubject || 'English', // NEW: Add selected subject
                subjects: user.subjects || [], // Will be populated from curriculum based on grade
                role: 'student',
                
                // Learning progress data
                progress: {
                    totalResources: studentData.progress?.length || 0,
                    completedResources: studentData.progress?.filter(p => p.status === 'completed').length || 0,
                    averageProgress: studentData.progress?.length > 0 ? 
                        (studentData.progress.filter(p => p.status === 'completed').length / studentData.progress.length) * 100 : 0,
                    totalStudyTime: studentData.progress?.reduce((sum, p) => sum + (p.progress?.timeSpent || 0), 0) || 0
                },
                
                // Recent activities and performance
                recentActivities: studentData.progress.slice(0, 5),
                pending_tasks: studentData.progress.filter(p => p.status === 'pending').slice(0, 5),
                performance: studentData.learningStats || {},
                achievements: studentData.achievements || [],
                learningAnalytics: statsResult.success ? statsResult.data : {},
                
                // Learning preferences and context
                learningExperience: 'intermediate',
                topicInterests: user.subjects || [],
                currentChallenges: studentData.progress.filter(p => p.status === 'struggling').slice(0, 3),
                strengths: studentData.achievements.slice(0, 3),
                
                // Session context
                sessionId: sessionId,
                uploadedFiles: uploadedFiles.map(f => f.name),
                conversationHistory: messages.slice(-10), // Last 10 messages for context
                
                // NEW: Include selected teacher feedback (wrapped in array as expected by backend)
                teacher_feedback: selectedFeedbackId && selectedFeedbackId !== 'none' ? [teacherFeedback.find(f => f.id === selectedFeedbackId)] : [],
                use_feedback: selectedFeedbackId && selectedFeedbackId !== 'none',
                
                // NEW: Include voice gender selection
                voiceGender: selectedVoiceGender
            };

            // Initialize RealtimeOpenAI service
            const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
            if (!apiKey) {
                throw new Error('OpenAI API key not configured');
            }

            const service = new RealtimeOpenAIService(apiKey);
            
            // Set up event handlers - same approach as voice-coach
            // Add callback for when new response starts
            service.onResponseStart = () => {
                setTranscription(''); // Reset transcript for new response
                setIsSpeaking(true); // Start speaking animation
                // Mark the last live message as complete
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage && lastMessage.type === 'ai' && lastMessage.isLive) {
                        newMessages[newMessages.length - 1] = {
                            ...lastMessage,
                            isLive: false // Mark as complete
                        };
                    }
                    return newMessages;
                });
            };

            // Add callback for when response is complete
            service.onResponseComplete = () => {
                setIsSpeaking(false); // Stop speaking animation
                // Mark the current live message as complete
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage && lastMessage.type === 'ai' && lastMessage.isLive) {
                        newMessages[newMessages.length - 1] = {
                            ...lastMessage,
                            isLive: false // Mark as complete
                        };
                    }
                    return newMessages;
                });
            };

            // Handle AI response transcripts - exactly like voice-coach
            service.onTranscript = (delta) => {
                setTranscription(prev => prev + delta);
            };

            // Handle user input transcripts - exactly like voice-coach
            service.onUserTranscript = (userTranscript) => {
                console.log('🎤 User said:', userTranscript);
                
                // Add user message to chat
                const userMessage = {
                    id: generateHydrationSafeId('user'),
                    type: 'user',
                    content: userTranscript,
                    timestamp: getHydrationSafeTimestamp(isClient), 
                    type: 'user',
                    content: userTranscript,
                    timestamp: getHydrationSafeTimestamp(isClient),
                    avatar: <User className="w-4 h-4 text-blue-500" />
                };
                
                setMessages(prev => [...prev, userMessage]);
            };

            // Connect to RealtimeOpenAI with student data, userType, and voice gender
            await service.connect(studentContext, 'student', selectedVoiceGender);
            
            setRealtimeService(service);
            setIsVoiceActive(true);
            setIsListening(true);
            
            // FIXED: Wait a bit before sending test message to ensure data channel is ready
            setTimeout(() => {
                if (service && service.dc && service.dc.readyState === 'open') {
                    service.sendTestMessage();
                } else {
                    console.warn('Data channel not ready, skipping test message');
                }
            }, 1000);
            
            toast.success('Voice session started! You can now speak with your AI tutor.');
            
        } catch (error) {
            console.error('Error starting voice session:', error);
            toast.error('Failed to start voice session. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // NEW: Handle gender change from VoiceCoachVideo
    const handleGenderChange = (gender) => {
        setSelectedVoiceGender(gender);
        
        // If already connected, update the voice in real-time
        if (isVoiceActive && realtimeService) {
            realtimeService.updateVoice(gender);
        }
    };

        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 dark:from-purple-900/20 dark:via-blue-900/20 dark:to-indigo-900/20">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/90 backdrop-blur-md"
                >
                    <div className="w-full px-2 py-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="relative">
                                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                                        <Sparkle className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                        AI Tutor
                                    </h1>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                        Your personalized learning companion
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                {/* NEW: Subject Selection Dropdown */}
                                {user?.grade && (
                                    <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                                        <BookOpen className="h-4 w-4 text-green-600" />
                                        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                                            <SelectTrigger className="w-40 h-8 text-sm">
                                                <SelectValue placeholder="Subject" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableSubjects.map((subject) => (
                                                    <SelectItem key={subject} value={subject}>
                                                        {subject}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* NEW: Voice Selection Dropdown */}
                                <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
                                    <Volume2 className="h-4 w-4 text-blue-600" />
                                    <Select value={selectedVoiceGender} onValueChange={handleGenderChange}>
                                        <SelectTrigger className="w-32 h-8 text-sm">
                                            <SelectValue placeholder="Voice" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="female">👩 Female</SelectItem>
                                            <SelectItem value="male">👨 Male</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                {/* NEW: Feedback Selection Dropdown */}
                                {showFeedbackOption && teacherFeedback && teacherFeedback.length > 0 && (
                                    <div className="w-full">
                                        <label htmlFor="feedbackSelect" className="block text-sm font-medium mb-2 flex items-center gap-2">
                                            <MessageSquare className="h-4 w-4" />
                                            Select Teacher Feedback ({teacherFeedback.length} available)
                                        </label>
                                        <Select value={selectedFeedbackId} onValueChange={setSelectedFeedbackId}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Choose feedback to use..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">No feedback</SelectItem>
                                                {teacherFeedback.map((feedback) => (
                                                    <SelectItem key={feedback.id} value={feedback.id}>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm">
                                                                {feedback.priority === 'high' ? '🔴' : feedback.priority === 'medium' ? '🟡' : '🟢'}
                                                            </span>
                                                            <span className="font-medium text-sm truncate">
                                                                {feedback.topics && feedback.topics.length > 0 
                                                                    ? feedback.topics[0] 
                                                                    : `Feedback ${feedback.id.slice(-4)}`
                                                                }
                                                            </span>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                
                                {uploadedFiles.length > 0 && (
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                        📎 {uploadedFiles.length} file(s)
                                    </Badge>
                                )}
                                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                                    Online
                                </Badge>
                                {/* Export button - made more visible */}
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={handleExportConversation}
                                    title="Export conversation"
                                    className="hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Export
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.div>

            <div className="w-full px-4 py-6">
                <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* NEW: Video Teacher Section */}
                    <div className="lg:col-span-1 flex items-center justify-center">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="w-full flex justify-center"
                        >
                            <Card className="bg-transparent backdrop-blur-sm border-0 shadow-none">
                                <CardContent className="p-4">
                                    <VoiceCoachVideo 
                                        isSpeaking={isSpeaking}
                                        isConnected={isVoiceActive}
                                        selectedGender={selectedVoiceGender} // NEW: Pass selected gender
                                    />
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>

                    {/* Chat Section */}
                    <div className="lg:col-span-2">
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="w-full"
                        >
                            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg h-[610px] flex flex-col">
                                {/* Messages Area */}
                                <div className="flex-1 overflow-hidden">
                                    <ScrollArea ref={scrollAreaRef} className="h-full w-full">
                                        <div className="p-4 space-y-2 min-h-full">
                                            <AnimatePresence>
                                                {messages.map((message) => (
                                                    <motion.div
                                                        key={message.id}
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -20 }}
                                                        className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                                                    >
                                                        <div className={`flex items-start space-x-3 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : 'flex-row space-x-3'}`}>
                                                            <Avatar className="w-8 h-8 flex-shrink-0">
                                                                <AvatarFallback className="text-lg">
                                                                    {message.avatar}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className={`rounded-2xl px-3 py-2 ${message.type === 'user'
                                                                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                                                    : 'text-black dark:text-white'
                                                                }`}>
                                                                {renderMessageContent(message)}
                                                                {/* Show typing indicator only for streaming messages */}
                                                                {message.isStreaming && (
                                                                    <div className="inline-block ml-2">
                                                                        <div className="flex space-x-1">
                                                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                                                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>

                                            {/* REMOVED: Loading indicator to prevent duplicate with streaming message */}
                                        </div>
                                        <div ref={messagesEndRef} className="h-4" />
                                    </ScrollArea>
                                </div>

                                {/* Input Area */}
                                <div className="p-2 flex-shrink-0">
                                    <div className="flex items-end space-x-3 w-full border-gray-200 dark:border-gray-700">
                                        <div className="flex-1">
                                            <Input
                                                value={inputValue}
                                                onChange={(e) => setInputValue(e.target.value)}
                                                onKeyPress={handleKeyPress}
                                                placeholder="Ask me anything about your homework..."
                                                className="border bg-gray-50 dark:bg-gray-700 border-purple-500 dark:border-purple-500 rounded-2xl px-6 py-6 w-full text-black dark:text-white"
                                                disabled={isLoading || isUploading || isVoiceActive}
                                            />
                                        </div>
                                       <div className="flex items-center space-x-2">
                                        <Button 
                                        onClick={handleUpload}
                                        disabled={isLoading || isUploading || isVoiceActive}
                                        size="icon" 
                                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-2xl px-6 py-3 text-white dark:text-white"
                                        title="Upload documents"
                                        >
                                            {isUploading ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <UploadCloud className="w-4 h-4" />
                                            )}
                                        </Button>
                                        
                                        {/* Connect Voice Button - Moved here between upload and send */}
                                        <Button 
                                            onClick={startVoiceSessionHandler}
                                            disabled={isLoading || isUploading}
                                            className={`${
                                                isVoiceActive 
                                                    ? 'bg-red-500 hover:bg-red-600' 
                                                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                                            } text-white dark:text-white rounded-2xl px-6 py-3`}
                                            title={isVoiceActive ? 'Disconnect Voice' : 'Connect Voice'}
                                        >
                                            {isLoading ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                            ) : isVoiceActive ? (
                                                <MicOff className="w-4 h-4 mr-2" />
                                            ) : (
                                                <Mic className="w-4 h-4 mr-2" />
                                            )}
                                            {isVoiceActive ? 'Disconnect' : 'Connect Voice'}
                                        </Button>
                                        
                                        {uploadedFiles.length > 0 && (
                                            <Button 
                                            onClick={handleClearFiles}
                                            disabled={isLoading || isUploading || isVoiceActive}
                                            size="icon" 
                                            variant="outline"
                                            className="rounded-2xl px-6 py-3"
                                            title="Clear uploaded files"
                                            >
                                                <File className="w-4 h-4" />
                                            </Button>
                                        )}
                                        
                                       <Button
                                            onClick={handleSendMessage}
                                            disabled={!inputValue.trim() || isLoading || isUploading || isVoiceActive}
                                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-2xl px-6 py-3 text-white dark:text-white"
                                        >
                                            <Send className="w-4 h-4" />
                                        </Button>
                                       </div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiTutor;