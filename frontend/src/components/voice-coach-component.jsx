"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
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
    GraduationCap,
    BookOpen,
    Users,
    TrendingUp,
    Volume2, // NEW: Add volume icon for voice selection
    Copy, // NEW: Add copy icon
    Download // NEW: Add download icon
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { MarkdownStyles } from '@/components/Markdown';
import { generateHydrationSafeId, getHydrationSafeTimestamp, useIsClient } from '@/lib/hydration-safe';
import { 
    sendVoiceCoachMessage, 
    uploadDocumentsToVoiceCoach, 
    startVoiceCoachSession, 
    stopVoiceCoachSession,
    performVoiceCoachWebSearch,
    getVoiceCoachHealth,
    createVoiceCoachSession,
    getTeacherLearningInsights,
    saveVoiceCoachChatSession,
    getTeacherProgressData,
    getTeacherAchievementsData,
    getTeacherLearningStats,
    getCurrentTeacherData,
    getStudentsForTeacher,
    debugDatabaseCollections,
    // NEW: Import optimized functions
    initializeVoiceCoachSession,
    clearTeacherDataCache
} from '../app/(home)/teacher/voice-coach/action';

// Import RealtimeOpenAIService from the separate file
import { RealtimeOpenAIService } from '@/lib/realtimeOpenAI';

// Import the Video component instead of 3D model
import dynamic from 'next/dynamic';

// Comment out the 3D component
// const LipSyncTeacher3D = dynamic(() => import('./LipSyncTeacher3D'), { 
//     ssr: false,
//     loading: () => (
//         <div className="w-full h-[500px] flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl">
//             <div className="text-center">
//                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
//                 <p className="text-sm text-gray-600 dark:text-gray-400">Loading 3D Teacher...</p>
//             </div>
//         </div>
//     )
// });

// Import the new Video component
const VoiceCoachVideo = dynamic(() => import('./VoiceCoachVideo'), { 
    ssr: false,
    loading: () => (
        <div className="w-[200px] h-[500px] rounded-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Loading Video...</p>
            </div>
        </div>
    )
});

const VoiceCoach = () => {
    const [messages, setMessages] = useState([
        {
            id: 1,
            type: 'ai',
            content: "Hello! 👋 I'm your Voice Coach! I'm here to help you improve your teaching methods, classroom management, and student engagement. What teaching challenge would you like to work on today?",
            timestamp: null, // Will be set on client side
            avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const messagesEndRef = useRef(null);
    const scrollAreaRef = useRef(null);
    
    // Voice state using RealtimeOpenAIService
    const [isConnected, setIsConnected] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState('');
    const openAIServiceRef = useRef(null);

    // NEW: Video state instead of lip sync
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    
    // NEW: Voice gender selection state
    const [selectedVoiceGender, setSelectedVoiceGender] = useState('female');

    // Get API key from environment or localStorage - safe for SSR
    const [apiKey, setApiKey] = useState(process.env.NEXT_PUBLIC_OPENAI_API_KEY || '');
    
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedKey = localStorage.getItem('openai_api_key');
            if (storedKey && !process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
                setApiKey(storedKey);
            }
        }
    }, []);

    // Fix hydration mismatch by ensuring client-side rendering
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        // Set timestamp for initial message on client side
        setMessages(prev => prev.map((msg, index) => 
            index === 0 ? { ...msg, timestamp: new Date() } : msg
        ));
    }, []);

    // Helper function to generate safe IDs and timestamps
    const generateMessageId = () => generateHydrationSafeId('msg');
    const generateTimestamp = () => getHydrationSafeTimestamp(isClient);

    // OPTIMIZED: Single state for all teacher data
    const [teacherData, setTeacherData] = useState({
        teacher: null,
        students: [],
        content: {
            lessons: [],
            assessments: [],
            presentations: [],
            comics: [],
            images: [],
            videos: [],
            websearches: []
        },
        achievements: [],
        stats: {}
    });
    const [dataLoading, setDataLoading] = useState(true);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // API key validation and cleanup
    useEffect(() => {
        if (!apiKey) {
            setError('❌ OpenAI API key required. Set NEXT_PUBLIC_OPENAI_API_KEY or add to localStorage.');
        }

        return () => {
            if (openAIServiceRef.current) {
                openAIServiceRef.current.disconnect();
            }
        };
    }, [apiKey]);

    // Handle transcript updates - automatically add to messages
    useEffect(() => {
        if (transcript !== undefined && transcript !== '') {
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                
                // Only create new message if there's no existing live AI message
                if (!lastMessage || lastMessage.type !== 'ai' || !lastMessage.isLive) {
                    // Add new live message
                    newMessages.push({ 
                        id: generateMessageId(),
                        type: 'ai', 
                        content: transcript, 
                        isLive: true,
                        timestamp: generateTimestamp(),
                        avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
                    });
                } else {
                    // Update existing live message
                    newMessages[newMessages.length - 1] = { 
                        ...lastMessage, 
                        content: transcript,
                        id: lastMessage.id // Keep the same ID
                    };
                }
                
                return newMessages;
            });
        }
    }, [transcript]);

    // OPTIMIZED: Single data fetch with caching
    useEffect(() => {
        const fetchOptimizedTeacherData = async () => {
            setDataLoading(true);
            try {
                // OPTIMIZED: Single call to get all data
                const result = await initializeVoiceCoachSession();
                
                if (result.success) {
                    setTeacherData(result.teacherData);
                    setSessionId(result.sessionId);
                    
                    // FIXED: Remove undefined setUser and setStudents calls
                    // The teacherData is already set above with all the data
                } else {
                    toast.error('Failed to load your teaching data');
                    // Set fallback data
                    setTeacherData({
                        teacher: {
                            _id: 'fallback_teacher_id',
                            email: 'teacher@example.com',
                            name: 'Teacher',
                            grades: ['Grade 8', 'Grade 9', 'Grade 10'],
                            subjects: ['Mathematics', 'Science', 'English']
                        },
                        students: [],
                        content: {
                            lessons: [],
                            assessments: [],
                            presentations: [],
                            comics: [],
                            images: [],
                            videos: [],
                            websearches: []
                        },
                        achievements: [],
                        stats: {}
                    });
                }
            } catch (error) {
                console.error('Error fetching teacher data:', error);
                toast.error('Failed to load your teaching data');
                
                // Set fallback data
                setTeacherData({
                    teacher: {
                        _id: 'fallback_teacher_id',
                        email: 'teacher@example.com',
                        name: 'Teacher',
                        grades: ['Grade 8', 'Grade 9', 'Grade 10'],
                        subjects: ['Mathematics', 'Science', 'English']
                    },
                    students: [],
                    content: {
                        lessons: [],
                        assessments: [],
                        presentations: [],
                        comics: [],
                        images: [],
                        videos: [],
                        websearches: []
                    },
                    achievements: [],
                    stats: {}
                });
            } finally {
                setDataLoading(false);
            }
        };

        fetchOptimizedTeacherData();
    }, []);

    // OPTIMIZED: Send message handler with cached data AND conversation saving
    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading || !sessionId || !teacherData.teacher) return;

        const userMessage = {
            id: generateMessageId(),
            type: 'user',
            content: inputValue,
            timestamp: generateTimestamp(),
            avatar: <User className="w-4 h-4 text-blue-500" />
        };

        setMessages(prev => [...prev, userMessage]);
        const currentInput = inputValue;
        setInputValue('');
        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('message', currentInput);
            formData.append('sessionId', sessionId);
            
            // OPTIMIZED: No need to send student data - it's already cached in backend
            formData.append('studentData', JSON.stringify({}));
            
            // Pass the names of the uploaded files to the server action
            const fileNames = uploadedFiles.map(file => file.name);
            formData.append('uploadedFiles', JSON.stringify(fileNames));

            const response = await sendVoiceCoachMessage(formData);

            if (response.success) {
                const aiMessage = {
                    id: generateMessageId(),
                    type: 'ai',
                    content: response.response,
                    timestamp: generateTimestamp(),
                    avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
                };

                // FIXED: Update messages and save conversation immediately
                setMessages(prev => {
                    const updatedMessages = [...prev, aiMessage];
                    
                    // FIXED: Save conversation immediately after adding AI message
                    setTimeout(async () => {
                        try {
                            await saveVoiceCoachConversationToHistory(updatedMessages, 'text');
                        } catch (error) {
                            console.error('Failed to save conversation:', error);
                        }
                    }, 100); // Small delay to ensure state is updated
                    
                    return updatedMessages;
                });
            } else {
                const errorMessage = {
                    id: generateMessageId(),
                    type: 'ai',
                    content: `Sorry, I encountered an error: ${response.error}`,
                    timestamp: generateTimestamp(),
                    avatar: <GraduationCap className="w-4 h-4 text-red-500" />
                };

                setMessages(prev => [...prev, errorMessage]);
            }
        } catch (error) {
            toast.error('Failed to send message. Please try again.');

            const errorMessage = {
                id: generateMessageId(),
                type: 'ai',
                content: 'Sorry, I encountered an error while processing your message. Please try again.',
                timestamp: generateTimestamp(),
                avatar: <GraduationCap className="w-4 h-4 text-red-500" />
            };

            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // Handle key press
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Clear chat
    const handleClearChat = () => {
        const clearMessage = {
            id: generateMessageId(),
            type: 'ai',
            content: "Chat cleared! How can I help you with your teaching today?",
            timestamp: generateTimestamp(),
            avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
        };
        setMessages([clearMessage]);
    };

    // OPTIMIZED: Voice functionality with cached data
    const handleStart = async () => {
        if (!apiKey) {
            setError('❌ OpenAI API key required');
            return;
        }
        
        if (isLoading) return;
        
        setIsLoading(true);
        setError('');
        
        try {
            openAIServiceRef.current = new RealtimeOpenAIService(apiKey);

            // Add callback for when new response starts
            openAIServiceRef.current.onResponseStart = () => {
                setTranscript(''); // Reset transcript for new response
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
            openAIServiceRef.current.onResponseComplete = () => {
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

            openAIServiceRef.current.onTranscript = (delta) => {
                setTranscript(prev => prev + delta);
            };

            openAIServiceRef.current.onUserTranscript = (userTranscript) => {
                const userMessage = {
                    id: generateMessageId(),
                    type: 'user',
                    content: userTranscript,
                    timestamp: generateTimestamp(),
                    avatar: <User className="w-4 h-4 text-blue-500" />
                };
                
                setMessages(prev => [...prev, userMessage]);
            };

            // OPTIMIZED: Use cached teacher data - FIXED: Include all required properties
            const teacherDataForAI = {
                teacherName: teacherData.teacher?.name || 'Teacher',
                students: teacherData.students.slice(0, 5).map(student => ({
                    student_name: student.name,
                    student_id: student._id,
                    email: student.email,
                    grades: student.grades,
                    subjects: student.subjects,
                    performance: {
                        overall: student.performance?.overall || 0
                    }
                })),
                studentPerformance: {
                    totalStudents: teacherData.students.length,
                    averagePerformance: teacherData.stats.averageStudentPerformance || 0
                },
                // FIXED: Add missing properties that createTeacherPrompt expects
                studentOverview: {
                    totalStudents: teacherData.students.length,
                    averagePerformance: teacherData.stats.averageStudentPerformance || 0,
                    performanceDistribution: {
                        high: teacherData.students.filter(s => (s.performance?.overall || 0) >= 80).length,
                        medium: teacherData.students.filter(s => (s.performance?.overall || 0) >= 60 && (s.performance?.overall || 0) < 80).length,
                        low: teacherData.students.filter(s => (s.performance?.overall || 0) < 60).length
                    }
                },
                topPerformers: teacherData.students
                    .sort((a, b) => (b.performance?.overall || 0) - (a.performance?.overall || 0))
                    .slice(0, 3)
                    .map(student => ({
                        name: student.name,
                        performance: student.performance?.overall || 0,
                        strengths: student.subjects,
                        group: student.group || 'Default'
                    })),
                subjectPerformance: teacherData.students.reduce((acc, student) => {
                    student.subjects.forEach(subject => {
                        if (!acc[subject]) {
                            acc[subject] = { total: 0, count: 0, students: [] };
                        }
                        acc[subject].total += student.performance?.overall || 0;
                        acc[subject].count += 1;
                        acc[subject].students.push({
                            name: student.name,
                            score: student.performance?.overall || 0
                        });
                    });
                    return acc;
                }, {}),
                content: {
                    totalContent: (teacherData.stats.totalLessons || 0) + (teacherData.stats.totalAssessments || 0) + (teacherData.stats.totalPresentations || 0) + (teacherData.stats.totalComics || 0) + (teacherData.stats.totalImages || 0) + (teacherData.stats.totalVideos || 0) + (teacherData.stats.totalWebSearches || 0),
                    lessons: teacherData.content.lessons.slice(0, 3).map(item => ({ title: item.title || 'Untitled Lesson', type: 'lesson' })),
                    assessments: teacherData.content.assessments.slice(0, 3).map(item => ({ title: item.title || 'Untitled Assessment', type: 'assessment' })),
                    presentations: teacherData.content.presentations.slice(0, 3).map(item => ({ title: item.title || 'Untitled Presentation', type: 'presentation' })),
                    comics: teacherData.content.comics.slice(0, 3).map(item => ({ title: item.title || 'Untitled Comic', type: 'comic' })),
                    images: teacherData.content.images.slice(0, 3).map(item => ({ title: item.title || 'Untitled Image', type: 'image' })),
                    videos: teacherData.content.videos.slice(0, 3).map(item => ({ title: item.title || 'Untitled Video', type: 'video' })),
                    websearches: teacherData.content.websearches.slice(0, 3).map(item => ({ title: item.title || 'Untitled Web Search', type: 'webSearch' }))
                },
                assessments: teacherData.content.assessments.slice(0, 3).map(item => ({
                    title: item.title || 'Untitled Assessment',
                    type: item.type || 'assessment',
                    createdAt: item.createdAt
                })),
                mediaToolkit: {
                    totalContent: (teacherData.stats.totalLessons || 0) + (teacherData.stats.totalAssessments || 0) + (teacherData.stats.totalPresentations || 0) + (teacherData.stats.totalComics || 0) + (teacherData.stats.totalImages || 0) + (teacherData.stats.totalVideos || 0) + (teacherData.stats.totalWebSearches || 0),
                    comics: teacherData.stats.totalComics || 0,
                    images: teacherData.stats.totalImages || 0,
                    slides: teacherData.stats.totalPresentations || 0,
                    videos: teacherData.stats.totalVideos || 0,
                    webSearch: teacherData.stats.totalWebSearches || 0
                },
                learningAnalytics: {
                    totalLessons: teacherData.stats.totalLessons || 0,
                    totalAssessments: teacherData.stats.totalAssessments || 0,
                    averageStudentPerformance: teacherData.stats.averageStudentPerformance || 0
                }
            };

            await openAIServiceRef.current.connect(teacherDataForAI, 'teacher', selectedVoiceGender);
            
            setIsConnected(true);
            setIsFirstLoad(false); // Trigger intro video
            setMessages(prev => [...prev, { 
                id: generateMessageId(),
                type: 'system', 
                content: `🎤 Voice connection established! Start speaking with your AI Voice Coach.` 
            }]);
            
        } catch (error) {
            setError(`Failed to connect: ${error.message}`);
            setMessages(prev => [...prev, { 
                id: generateMessageId(),
                type: 'error', 
                content: `❌ Connection failed: ${error.message}` 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Add the handleVoiceToggle function after handleDisconnect
    const handleVoiceToggle = async () => {
        if (isConnected) {
            handleDisconnect();
        } else {
            await handleStart();
        }
    };

    // Improve the handleDisconnect function
    const handleDisconnect = () => {
        try {
            if (openAIServiceRef.current) {
                openAIServiceRef.current.disconnect();
                openAIServiceRef.current = null;
            }
            
            setIsConnected(false);
            setTranscript('');
            setError('');
            setIsLoading(false);
            setIsSpeaking(false);
            
            setMessages(prev => [...prev, { 
                id: generateMessageId(),
                type: 'system', 
                content: '🔌 Voice connection ended. It was a pleasure to help you today!' 
            }]);
            
        } catch (error) {
            setError(`Disconnect error: ${error.message}`);
        }
    };

    // NEW: Handle gender change from VoiceCoachVideo
    const handleGenderChange = (gender) => {
        console.log(`🎤 VoiceCoach: Received gender change to ${gender}`);
        console.log(`🔍 VoiceCoach: isConnected = ${isConnected}, openAIServiceRef.current = ${!!openAIServiceRef.current}`);
        setSelectedVoiceGender(gender);
        
        // If already connected, update the voice in real-time
        if (isConnected && openAIServiceRef.current) {
            console.log(`🔄 VoiceCoach: Updating voice for connected service`);
            openAIServiceRef.current.updateVoice(gender);
        } else {
            console.log(`ℹ️ VoiceCoach: Service not connected, voice will be set on next connection`);
        }
    };

    // File upload handler
    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0 || !sessionId || !teacherData.teacher) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            files.forEach(file => formData.append('files', file));
            formData.append('sessionId', sessionId);
            formData.append('studentData', JSON.stringify({
                id: teacherData.teacher._id,
                name: teacherData.teacher.name,
                email: teacherData.teacher.email,
                grades: teacherData.teacher.grades,
                subjects: teacherData.teacher.subjects,
                role: 'teacher'
            }));

            const response = await uploadDocumentsToVoiceCoach(formData);

            if (response.success) {
                setUploadedFiles(prev => [...prev, ...files]);
                toast.success(`Uploaded ${files.length} file(s) successfully`);
                
                const uploadMessage = {
                    id: generateMessageId(),
                    type: 'ai',
                    content: `I've received ${files.length} file(s). I can now help you analyze and discuss the content. What would you like to know about these documents?`,
                    timestamp: generateTimestamp(),
                    avatar: <File className="w-4 h-4 text-green-500" />
                };
                setMessages(prev => [...prev, uploadMessage]);
            } else {
                throw new Error(response.error || 'Upload failed');
            }
        } catch (error) {
            toast.error('Failed to upload files. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    // Clear uploaded files
    const handleClearFiles = () => {
        setUploadedFiles([]);
        toast.info('Cleared uploaded documents');
        
        const clearMessage = {
            id: generateMessageId(),
            type: 'ai',
            content: "🗑️ Cleared all uploaded documents. You can upload new ones anytime!",
            timestamp: generateTimestamp(),
            avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
        };
        setMessages(prev => [...prev, clearMessage]);
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
                const formData = new FormData();
                formData.append('sessionId', sessionId);
                files.forEach(file => {
                    formData.append('files', file);
                });

                const uploadResult = await uploadDocumentsToVoiceCoach(formData);
                
                if (uploadResult.success) {
                    setUploadedFiles(prev => [...prev, ...files]);
                    
                    const uploadMessage = {
                        id: generateMessageId(),
                        type: 'ai',
                        content: `✅ Successfully uploaded ${files.length} document(s)! I can now help you with questions about these files.`,
                        timestamp: generateTimestamp(),
                        avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
                    };
                    setMessages(prev => [...prev, uploadMessage]);
                    
                    toast.success(`Uploaded ${files.length} document(s) successfully!`);
                } else {
                    throw new Error(uploadResult.error);
                }
            } catch (error) {
                toast.error('Failed to upload documents. Please try again.');
                
                const errorMessage = {
                    id: generateMessageId(),
                    type: 'error',
                    content: "❌ Failed to upload your documents. Please try again or contact support if the problem persists.",
                    timestamp: generateTimestamp(),
                    avatar: <GraduationCap className="w-4 h-4 text-blue-500" />
                };
                setMessages(prev => [...prev, errorMessage]);
            } finally {
                setIsUploading(false);
            }
        };
        fileInput.click();
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
                const role = msg.type === 'user' ? 'User' : 'Voice Coach';
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
{\\b Voice Coach Conversation}\\par
Exported on: ${new Date().toLocaleDateString()}\\par\\par`;

        conversationMessages.forEach(msg => {
            const timestamp = msg.timestamp.toLocaleString();
            const role = msg.type === 'user' ? 'User' : 'Voice Coach';
            rtfContent += `{\\b [${timestamp}] ${role}:}\\par`;
            rtfContent += `${msg.content.replace(/\n/g, '\\par ')}\\par\\par`;
        });

        rtfContent += '}';

        // Create blob and download
        const blob = new Blob([rtfContent], { type: 'application/rtf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voice-coach-conversation-${new Date().toISOString().split('T')[0]}.rtf`;
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
        a.download = `voice-coach-conversation-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // NEW: Add conversation saving function for Voice Coach
    const saveVoiceCoachConversationToHistory = async (messagesToSave, sessionType = 'text') => {
        try {
            const conversationData = {
                sessionId: sessionId,
                title: `Voice Coach Chat - ${new Date().toLocaleDateString()}`,
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
                teacherData: {
                    name: teacherData.teacher?.name || 'Teacher',
                    email: teacherData.teacher?.email || 'teacher@example.com',
                    grades: teacherData.teacher?.grades || [],
                    subjects: teacherData.teacher?.subjects || []
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
            
            const result = await saveVoiceCoachChatSession(formData);
            
            if (result.success) {
                console.log('Voice Coach conversation saved to history successfully');
            } else {
                console.error('Failed to save Voice Coach conversation:', result.error);
            }
        } catch (error) {
            console.error('Error saving Voice Coach conversation to history:', error);
        }
    };

    if (dataLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-lg text-gray-600 dark:text-gray-400">Loading your teaching data...</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">This may take a moment</p>
                </div>
            </div>
        );
    }

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
                                    <GraduationCap className="w-5 h-5 text-white" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                                    Voice Coach
                                </h1>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Your personalized teaching companion
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
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
                            
                            {uploadedFiles.length > 0 && (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                    📎 {uploadedFiles.length} file(s)
                                </Badge>
                            )}
                            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                                Online
                            </Badge>
                            {/* Export button */}
                            <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={handleExportConversation}
                                title="Export conversation"
                                className="hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                                <Download className="w-5 h-5" />
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
                                        isConnected={isConnected}
                                        selectedGender={selectedVoiceGender}
                                    />
                                </CardContent>

                                {/* Error Display */}
                                {error && (
                                    <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
                                        {error}
                                    </div>
                                )}
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
                            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg h-[600px] flex flex-col">
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
                                                                    : message.type === 'system'
                                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                                    : message.type === 'error'
                                                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                                    : 'text-black dark:text-white'
                                                                }`}>
                                                                {renderMessageContent(message)}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>

                                            {isLoading && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="flex justify-start"
                                                >
                                                    <div className="flex items-start space-x-3">
                                                        <Avatar className="w-8 h-8 flex-shrink-0">
                                                            <AvatarFallback className="text-lg">
                                                                <GraduationCap className="w-4 h-4 text-blue-500" />
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="text-black dark:text-white text-sm animate-pulse">
                                                            ⚪
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
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
                                                placeholder="Ask me about teaching methods, classroom management, or student engagement..."
                                                className="border bg-gray-50 dark:bg-gray-700 border-purple-500 dark:border-purple-500 rounded-2xl px-6 py-6 w-full text-black dark:text-white"
                                                disabled={isLoading || isUploading}
                                            />
                                        </div>
                                       <div className="flex items-center space-x-2">
                                        <Button 
                                        onClick={handleUpload}
                                        disabled={isLoading || isUploading}
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
                                            onClick={handleVoiceToggle}
                                            disabled={isLoading || isUploading}
                                            className={`${
                                                isConnected 
                                                    ? 'bg-red-500 hover:bg-red-600' 
                                                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                                            } text-white dark:text-white rounded-2xl px-6 py-3`}
                                            title={isConnected ? 'Disconnect Voice' : 'Connect Voice'}
                                        >
                                            {isLoading ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                            ) : isConnected ? (
                                                <MicOff className="w-4 h-4 mr-2" />
                                            ) : (
                                                <Mic className="w-4 h-4 mr-2" />
                                            )}
                                            {isConnected ? 'Disconnect' : 'Connect Voice'}
                                        </Button>
                                        
                                        {uploadedFiles.length > 0 && (
                                            <Button 
                                            onClick={handleClearFiles}
                                            disabled={isLoading || isUploading}
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
                                            disabled={!inputValue.trim() || isLoading || isUploading}
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

export default VoiceCoach;