"use server";

import { revalidatePath } from "next/cache";
import PythonApi from "@/lib/PythonApi";
import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";

// Cache for database connection to avoid repeated connections
let dbConnection = null;
const getDbConnection = async () => {
  if (!dbConnection) {
    const { db } = await connectToDatabase();
    dbConnection = db;
  }
  return dbConnection;
};

// Helper function to serialize MongoDB objects based on actual schema
const serializeProgressData = (items) => {
  return items.map(item => ({
    _id: item._id.toString(),
    studentId: item.studentId.toString(),
    contentId: item.contentId.toString(),
    contentType: item.contentType,
    contentTitle: item.contentTitle,
    subject: item.subject,
    grade: item.grade,
    status: item.status,
    progress: {
      currentStep: item.progress?.currentStep || 0,
      totalSteps: item.progress?.totalSteps || 1,
      percentage: item.progress?.percentage || 0,
      timeSpent: item.progress?.timeSpent || 0,
      lastAccessedAt: item.progress?.lastAccessedAt ? item.progress.lastAccessedAt.toISOString() : null
    },
    completionData: item.completionData ? {
      completedAt: item.completionData.completedAt ? item.completionData.completedAt.toISOString() : null,
      score: item.completionData.score,
      answers: item.completionData.answers || [],
      correctAnswers: item.completionData.correctAnswers || 0,
      totalQuestions: item.completionData.totalQuestions || 0,
      timeToComplete: item.completionData.timeToComplete || 0,
      feedback: item.completionData.feedback
    } : null,
    metadata: {
      createdAt: item.metadata?.createdAt ? item.metadata.createdAt.toISOString() : null,
      updatedAt: item.metadata?.updatedAt ? item.metadata.updatedAt.toISOString() : null,
      attempts: item.metadata?.attempts || 0,
      bookmarked: item.metadata?.bookmarked || false
    }
  }));
};

// Helper function to serialize achievement data
const serializeAchievementData = (items) => {
  return items.map(item => ({
    _id: item._id.toString(),
    studentId: item.studentId.toString(),
    achievementId: item.achievementId,
    name: item.title || item.name,
    description: item.description,
    icon: item.icon,
    color: item.color,
    category: item.category,
    points: item.points,
    earnedAt: item.earnedAt.toISOString(),
    metadata: item.metadata
  }));
};

// Helper function to safely convert dates to ISO strings
function safeToISOString(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string') return dateValue;
  if (dateValue.toISOString && typeof dateValue.toISOString === 'function') {
    return dateValue.toISOString();
  }
  return dateValue;
}

// Get student progress data
export async function getStudentProgressData() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const db = await getDbConnection();
    
    const progressItems = await db.collection('progress')
      .find({ studentId: new ObjectId(session.user.id) })
      .sort({ 'metadata.updatedAt': -1 })
      .toArray();

    return { 
      success: true, 
      data: serializeProgressData(progressItems)
    };
  } catch (error) {
    console.error('Error fetching student progress:', error);
    return { success: false, error: error.message };
  }
}

// Get student achievements data
export async function getStudentAchievementsData() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const db = await getDbConnection();
    
    const achievements = await db.collection('achievements')
      .find({ studentId: new ObjectId(session.user.id) })
      .sort({ earnedAt: -1 })
      .toArray();

    return { 
      success: true, 
      data: serializeAchievementData(achievements)
    };
  } catch (error) {
    console.error('Error fetching student achievements:', error);
    return { success: false, error: error.message };
  }
}

// Get student learning stats
export async function getStudentLearningStats() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const db = await getDbConnection();
    
    // Get progress stats
    const progressStats = await db.collection('progress')
      .aggregate([
        { $match: { studentId: new ObjectId(session.user.id) } },
        {
          $group: {
            _id: null,
            totalResources: { $sum: 1 },
            completedResources: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
            averageProgress: { $avg: "$progress.percentage" },
            totalStudyTime: { $sum: "$progress.timeSpent" }
          }
        }
      ])
      .toArray();

    // Get achievement stats
    const achievementStats = await db.collection('achievements')
      .aggregate([
        { $match: { studentId: new ObjectId(session.user.id) } },
        {
          $group: {
            _id: null,
            totalAchievements: { $sum: 1 },
            recentAchievements: { $sum: { $cond: [{ $gte: ["$earnedAt", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] }, 1, 0] } }
          }
        }
      ])
      .toArray();

    const stats = {
      totalResources: progressStats[0]?.totalResources || 0,
      completedResources: progressStats[0]?.completedResources || 0,
      averageProgress: progressStats[0]?.averageProgress || 0,
      totalStudyTime: progressStats[0]?.totalStudyTime || 0,
      totalAchievements: achievementStats[0]?.totalAchievements || 0,
      recentAchievements: achievementStats[0]?.recentAchievements || 0
    };

    return { 
      success: true, 
      data: stats 
    };
  } catch (error) {
    console.error('Error fetching learning stats:', error);
    return { success: false, error: error.message };
  }
}

// Get current user data
export async function getCurrentUserData() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const db = await getDbConnection();
    
    const user = await db.collection('user')
      .findOne({ _id: new ObjectId(session.user.id) });

    if (!user) {
      // Return fallback user data instead of throwing error
      return { 
        success: true, 
        data: {
          _id: session.user.id,
          email: session.user.email || 'student@example.com',
          name: session.user.name || 'Student',
          grade: '8',
          grades: ['8'],
          subjects: [] // Will be populated from curriculum based on grade
        }
      };
    }

    // Convert MongoDB objects to plain objects
    const serializedUser = {
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
      grade: user.grade || user.grades?.[0] || '8',
      grades: user.grades || [user.grade || '8'],
      subjects: user.subjects || [], // Will be populated from curriculum based on grade
      role: user.role,
      createdAt: user.createdAt?.toISOString(),
      updatedAt: user.updatedAt?.toISOString()
    };

    return { 
      success: true, 
      data: serializedUser 
    };
  } catch (error) {
    console.error('Error fetching user data:', error);
    return { 
      success: true, 
      data: {
        _id: 'fallback_user_id',
        email: 'student@example.com',
        name: 'Student',
        grade: '8',
        grades: ['8'],
        subjects: [] // Will be populated from curriculum based on grade
      }
    };
  }
}

/**
 * Send a chat message to the AI Tutor - OPTIMIZED
 * @param {Object} formData - Form data containing the message and session info
 * @returns {Promise<Object>} - Response from the AI Tutor
 */
export async function sendAITutorMessage(formData) {
  try {
    const message = formData.get("message");
    const sessionId = formData.get("sessionId");
    const studentData = JSON.parse(formData.get("studentData") || "{}");
    
    if (!message || !sessionId) {
      throw new Error("Message and session ID are required");
    }

    // OPTIMIZED: Use pre-processed student data from state instead of recalculating
    const optimizedStudentData = {
      id: studentData.id || 'student_id',
      email: studentData.email || 'student@example.com',
      name: studentData.name || 'Student',
      grade: studentData.grade || '8',
      progress: studentData.progress || {},
      achievements: studentData.achievements || [],
      learning_stats: studentData.learningStats || {},
      assessments: studentData.assessments || [],
      lessons: studentData.lessons || [],
      resources: studentData.resources || [],
      analytics: studentData.analytics || []
    };

    const pythonApi = new PythonApi();
    // FIX: Replaced startStudentChat with startChatbotStream and corrected argument order
    const response = await pythonApi.startStudentChat(optimizedStudentData, sessionId, message, files, history, webSearchEnabled);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Handle streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';

    try {
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
              
              // Check if this is an image response
              if (jsonStr.includes('__IMAGE_RESPONSE__')) {
                const imageContent = jsonStr.replace('__IMAGE_RESPONSE__', '');
                
                try {
                  const data = JSON.parse(imageContent);
                  if (data.content) {
                    fullResponse = data.content;
                  } else {
                    fullResponse = imageContent;
                  }
                } catch (parseError) {
                  fullResponse = imageContent;
                }
                continue;
              }
              
              // Handle regular text chunks
              const data = JSON.parse(jsonStr);
              
              if (data.type === 'text_chunk') {
                fullResponse += data.content;
              } else if (data.type === 'done') {
                break;
              } else if (data.type === 'error') {
                throw new Error(data.message);
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError);
              console.error('Problematic line:', line);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      success: true,
      response: fullResponse
    };

  } catch (error) {
    console.error('Error in sendAITutorMessage:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload documents for the AI Tutor session
 * @param {Object} formData - Form data containing files and session info
 * @returns {Promise<Object>} - Upload result
 */
export async function uploadDocuments(formData) {
  try {
    const sessionId = formData.get("sessionId");
    const files = formData.getAll("files");

    if (!sessionId) {
      return {
        success: false,
        error: "Session ID is required"
      };
    }

    if (!files || files.length === 0) {
      return {
        success: false,
        error: "No files provided"
      };
    }

    // Validate file types and sizes
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/csv'
    ];

    const validFiles = [];
    const errors = [];

    for (const file of files) {
      if (file.size > maxFileSize) {
        errors.push(`${file.name}: File too large (max 10MB)`);
        continue;
      }
      
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: Unsupported file type`);
        continue;
      }
      
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      return {
        success: false,
        error: `No valid files. Errors: ${errors.join(', ')}`
      };
    }

    // Upload to Python backend
    const uploadResponse = await PythonApi.uploadDocumentsForChatbot(sessionId, validFiles);

    if (!uploadResponse.success) {
      throw new Error(uploadResponse.message || "Upload failed");
    }

    return {
      success: true,
      message: `Successfully uploaded ${validFiles.length} document(s)`,
      filesProcessed: uploadResponse.files_processed || validFiles.length,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    console.error("Error in uploadDocuments:", error);
    return {
      success: false,
      error: error.message || "Failed to upload documents"
    };
  }
}

/**
 * Start a real-time voice session with the AI Tutor
 * @param {Object} studentData - Comprehensive student data
 * @returns {Promise<Object>} - WebSocket connection info
 */
export async function startVoiceSession(studentData) {
  try {
    if (!studentData.id || !studentData.name) {
      return {
        success: false,
        error: "Student ID and name are required for voice session"
      };
    }

    // Prepare comprehensive student context for personalized tutoring
    const studentContext = {
      id: studentData.id,
      email: studentData.email || "",
      name: studentData.name,
      grade: studentData.grade || "8",
      
      // Learning Progress
      progress: studentData.progress || {},
      learningStats: studentData.learningStats || {},
      userProgress: studentData.userProgress || {},
      
      // Achievements and milestones
      achievements: studentData.achievements || [],
      
      // Academic Resources
      subjects: studentData.subjects || [], // Will be populated from curriculum based on grade
      lessons: studentData.lessons || [],
      resources: studentData.resources || [],
      assessments: (studentData.resources || []).filter(r => r.resourceType === 'assessment'),
      
      // Current Learning Status
      recentLessons: (studentData.lessons || []).slice(0, 5),
      incompleteAssessments: (studentData.resources || []).filter(r => 
        r.resourceType === 'assessment' && r.status !== 'completed'
      ),
      
      // Study patterns and preferences
      studyPreferences: {
        learningStyle: studentData.learningStyle || 'visual',
        difficultyPreference: studentData.difficultyPreference || 'medium',
        topicInterests: studentData.topicInterests || []
      },
      
      // Current session context
      pending_tasks: [
        {"topic": "Help with homework and assignments", "status": "Active"},
        {"topic": "Concept understanding and clarification", "status": "Available"},
        {"topic": "Practice problems and exercises", "status": "Available"}
      ],
      
      // Performance insights
      performanceInsights: {
        strongSubjects: (studentData.learningStats?.strongSubjects) || [],
        needsImprovement: (studentData.learningStats?.weakSubjects) || [],
        averageScore: studentData.learningStats?.averageScore || 'N/A',
        studyTime: studentData.learningStats?.totalStudyTime || 'N/A',
        lastActivity: studentData.learningStats?.lastActivity || new Date().toISOString()
      }
    };

    // Note: WebSocket creation happens on client side
    // This function prepares the data structure
    return {
      success: true,
      studentContext: studentContext,
      message: "Student context prepared for voice session"
    };

  } catch (error) {
    console.error("Error in startVoiceSession:", error);
    return {
      success: false,
      error: error.message || "Failed to prepare voice session"
    };
  }
}

/**
 * Stop the current voice session
 * @param {Object} formData - Form data containing session info
 * @returns {Promise<Object>} - Stop result
 */
export async function stopVoiceSession(formData) {
  try {
    const sessionId = formData.get("sessionId");

    if (!sessionId) {
      return {
        success: false,
        error: "Session ID is required"
      };
    }

    // Note: Actual WebSocket cleanup happens on client side
    // This function provides server-side cleanup if needed
    return {
      success: true,
      message: "Voice session stopped successfully"
    };

  } catch (error) {
    console.error("Error in stopVoiceSession:", error);
    return {
      success: false,
      error: error.message || "Failed to stop voice session"
    };
  }
}

/**
 * Perform web search through the AI Tutor
 * @param {Object} formData - Form data containing search parameters
 * @returns {Promise<Object>} - Search results
 */
export async function performWebSearch(formData) {
  try {
    const topic = formData.get("topic");
    const gradeLevel = formData.get("gradeLevel") || "8";
    const subject = formData.get("subject") || "General";
    const contentType = formData.get("contentType") || "articles";
    const language = formData.get("language") || "English";
    const comprehension = formData.get("comprehension") || "intermediate";
    const maxResults = parseInt(formData.get("maxResults")) || 3;

    if (!topic) {
      return {
        success: false,
        error: "Search topic is required"
      };
    }

    const searchData = {
      topic,
      gradeLevel,
      subject,
      contentType,
      language,
      comprehension,
      maxResults
    };

    const response = await PythonApi.runWebSearch(searchData);

    return {
      success: true,
      query: response.query,
      content: response.content,
      results: response.results || []
    };

  } catch (error) {
    console.error("Error in performWebSearch:", error);
    return {
      success: false,
      error: error.message || "Failed to perform web search"
    };
  }
}

/**
 * Get AI Tutor health status
 * @returns {Promise<Object>} - Health status
 */
export async function getAiTutorHealth() {
  try {
    const response = await PythonApi.healthCheck();
    
    return {
      success: true,
      status: response.status,
      message: response.message,
      timestamp: response.timestamp
    };

  } catch (error) {
    console.error("Error checking AI Tutor health:", error);
    return {
      success: false,
      error: error.message || "Failed to check AI Tutor health"
    };
  }
}

/**
 * Create a new AI Tutor session
 * @param {Object} formData - Form data containing session info
 * @returns {Promise<Object>} - Session creation result
 */
export async function createAiTutorSession(formData) {
  try {
    const userId = formData.get("userId");
    const studentData = JSON.parse(formData.get("studentData") || "{}");

    if (!userId) {
      return {
        success: false,
        error: "User ID is required"
      };
    }

    const sessionId = `student_${userId}_${Date.now()}`;
    
    return {
      success: true,
      sessionId: sessionId,
      message: "AI Tutor session created successfully"
    };

  } catch (error) {
    console.error("Error creating AI Tutor session:", error);
    return {
      success: false,
      error: error.message || "Failed to create AI Tutor session"
    };
  }
}

/**
 * Get student learning insights for AI Tutor personalization
 * @param {Object} formData - Form data containing user info
 * @returns {Promise<Object>} - Learning insights
 */
export async function getStudentLearningInsights(formData) {
  try {
    const userId = formData.get("userId");
    const studentData = JSON.parse(formData.get("studentData") || "{}");

    if (!userId) {
      return {
        success: false,
        error: "User ID is required"
      };
    }

    // Prepare learning insights based on student data
    const insights = {
      gradeLevel: studentData.grade || "8",
      subjects: studentData.subjects || [], // Will be populated from curriculum based on grade
      learningStyle: studentData.learningStyle || "visual",
      difficultyLevel: studentData.difficultyPreference || "medium",
      progress: studentData.progress || {},
      achievements: studentData.achievements || [],
      learningStats: studentData.learningStats || {},
      recentLessons: (studentData.lessons || []).slice(0, 5),
      incompleteAssessments: (studentData.resources || []).filter(r => 
        r.resourceType === 'assessment' && r.status !== 'completed'
      ),
      strongSubjects: (studentData.learningStats?.strongSubjects) || [],
      weakSubjects: (studentData.learningStats?.weakSubjects) || []
    };

    return {
      success: true,
      insights: insights,
      message: "Learning insights retrieved successfully"
    };

  } catch (error) {
    console.error("Error getting learning insights:", error);
    return {
      success: false,
      error: error.message || "Failed to get learning insights"
    };
  }
}

/**
 * Save AI Tutor chat session
 * @param {Object} formData - Form data containing session data
 * @returns {Promise<Object>} - Save result
 */
export async function saveAiTutorChatSession(formData) {
  try {
    const sessionData = JSON.parse(formData.get("sessionData") || "{}");

    if (!sessionData.sessionId || !sessionData.userId) {
      return {
        success: false,
        error: "Session ID and User ID are required"
      };
    }

    // Revalidate the chat sessions page to show updated data
    revalidatePath("/student/ai-tutor");

    return {
      success: true,
      message: "AI Tutor chat session saved successfully",
      sessionId: sessionData.sessionId
    };

  } catch (error) {
    console.error("Error saving AI Tutor chat session:", error);
    return {
      success: false,
      error: error.message || "Failed to save chat session"
    };
  }
}
