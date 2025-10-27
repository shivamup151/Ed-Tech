"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import PythonApiClient from "@/lib/PythonApi";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";

// Cache for teacher data to avoid repeated database calls
const teacherDataCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to serialize ObjectIds
const serializeObjectIds = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof ObjectId) return obj.toString();
  if (Array.isArray(obj)) return obj.map(serializeObjectIds);
  if (typeof obj === 'object') {
    const serialized = {};
    for (const [key, value] of Object.entries(obj)) {
      serialized[key] = serializeObjectIds(value);
    }
    return serialized;
  }
  return obj;
};

// OPTIMIZED: Single function to get all teacher data efficiently
export async function getOptimizedTeacherData() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;
    const cacheKey = `teacher_data_${userId}`;
    
    // Check cache first
    const cached = teacherDataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return { success: true, data: cached.data };
    }

    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(userId);

    // OPTIMIZED: Use separate queries instead of complex aggregation
    const [user, students, lessons, assessments, presentations, comics, images, videos, websearches, achievements] = await Promise.all([
      // Get teacher data
      db.collection('user').findOne({ _id: userObjectId }),
      
      // Get students with progress
      db.collection('user').find({ role: 'student' }).toArray(),
      
      // Get teacher's content
      db.collection('contents').find({ userId: userId }).toArray(),
      db.collection('assessments').find({ 
        $or: [
          { userId: userId },
          { teacherId: userId }
        ]
      }).toArray(),
      db.collection('presentations').find({ userId: userId }).toArray(),
      db.collection('comics').find({ userId: userObjectId }).toArray(),
      db.collection('images').find({ userId: userId }).toArray(),
      db.collection('videos').find({ userId: userId }).toArray(),
      db.collection('websearches').find({ userId: userId }).toArray(),
      db.collection('achievements').find({ userId: userId }).toArray()
    ]);

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Get progress data for students
    const studentIds = students.map(s => s._id);
    const progressData = await db.collection('progress')
      .find({ studentId: { $in: studentIds } })
      .toArray();

    // Group progress data by student
    const progressByStudent = {};
    progressData.forEach(progress => {
      const studentId = progress.studentId.toString();
      if (!progressByStudent[studentId]) {
        progressByStudent[studentId] = [];
      }
      progressByStudent[studentId].push(progress);
    });

    // Calculate performance for each student - FIXED: Remove all hardcoded values
    const calculateStudentPerformance = (studentProgress) => {
      if (!studentProgress || studentProgress.length === 0) {
        return {
          overall: 0, // FIXED: Remove hardcoded 75
          assignments: 0, // FIXED: Remove hardcoded 80
          quizzes: 0, // FIXED: Remove hardcoded 70
          participation: 0 // FIXED: Remove hardcoded 85
        };
      }

      const totalScore = studentProgress.reduce((sum, progress) => {
        return sum + (progress.score || 0);
      }, 0);
      
      const averageScore = totalScore / studentProgress.length;
      const assignmentScore = studentProgress.filter(p => p.type === 'assignment').length > 0 
        ? studentProgress.filter(p => p.type === 'assignment').reduce((sum, p) => sum + (p.score || 0), 0) / studentProgress.filter(p => p.type === 'assignment').length
        : 0; // FIXED: Remove hardcoded 80
      const quizScore = studentProgress.filter(p => p.type === 'quiz').length > 0
        ? studentProgress.filter(p => p.type === 'quiz').reduce((sum, p) => sum + (p.score || 0), 0) / studentProgress.filter(p => p.type === 'quiz').length
        : 0; // FIXED: Remove hardcoded 70
      const participationScore = studentProgress.filter(p => p.type === 'participation').length > 0
        ? studentProgress.filter(p => p.type === 'participation').reduce((sum, p) => sum + (p.score || 0), 0) / studentProgress.filter(p => p.type === 'participation').length
        : 0; // FIXED: Remove hardcoded 85

      return {
        overall: Math.round(averageScore || 0), // FIXED: Remove hardcoded 75
        assignments: Math.round(assignmentScore),
        quizzes: Math.round(quizScore),
        participation: Math.round(participationScore)
      };
    };

    // Process students data
    const processedStudents = students.map(student => {
      const studentProgress = progressByStudent[student._id.toString()] || [];
      const performance = calculateStudentPerformance(studentProgress);

      return {
        _id: student._id.toString(),
        name: student.name || student.email,
        email: student.email,
        grades: student.grades || [],
        subjects: student.subjects || [],
        performance: performance,
        lastActive: student.lastLogin || student.createdAt || new Date().toISOString(),
        group: student.group || 'Default',
        notes: student.notes || ''
      };
    });

    // Calculate average performance - FIXED: Remove hardcoded fallback
    const averagePerformance = processedStudents.length > 0 
      ? processedStudents.reduce((sum, s) => sum + s.performance.overall, 0) / processedStudents.length 
      : 0; // FIXED: Remove hardcoded 75

    // Process and serialize the data
    const processedData = {
      teacher: {
        _id: user._id.toString(),
        email: user.email,
        name: user.name || user.email,
        grades: user.grades || ['Grade 8', 'Grade 9', 'Grade 10'],
        subjects: user.subjects || ['Mathematics', 'Science', 'English']
      },
      students: processedStudents,
      content: {
        lessons: lessons.map(item => serializeObjectIds({ ...item, contentType: 'lesson' })),
        assessments: assessments.map(item => serializeObjectIds({ ...item, contentType: 'assessment' })),
        presentations: presentations.map(item => serializeObjectIds({ ...item, contentType: 'presentation' })),
        comics: comics.map(item => serializeObjectIds({ ...item, contentType: 'comic' })),
        images: images.map(item => serializeObjectIds({ ...item, contentType: 'image' })),
        videos: videos.map(item => serializeObjectIds({ ...item, contentType: 'video' })),
        websearches: websearches.map(item => serializeObjectIds({ ...item, contentType: 'webSearch' }))
      },
      achievements: achievements.map(achievement => serializeObjectIds(achievement)),
      stats: {
        totalLessons: lessons.length,
        totalAssessments: assessments.length,
        totalPresentations: presentations.length,
        totalComics: comics.length,
        totalImages: images.length,
        totalVideos: videos.length,
        totalWebSearches: websearches.length,
        totalStudents: processedStudents.length,
        averageStudentPerformance: Math.round(averagePerformance)
      }
    };

    // Cache the result
    teacherDataCache.set(cacheKey, {
      data: processedData,
      timestamp: Date.now()
    });

    return { success: true, data: processedData };
  } catch (error) {
    console.error('Error in getOptimizedTeacherData:', error);
    return { success: false, error: error.message };
  }
}

// OPTIMIZED: Create teacher data for backend that matches schema exactly
function createOptimizedTeacherDataForBackend(teacherData) {
  const { teacher, students, content, stats } = teacherData;
  
  // Limit students to top 5 for performance - FIXED: Remove hardcoded fallback
  const topStudents = students
    .sort((a, b) => (b.performance?.overall || 0) - (a.performance?.overall || 0)) // FIXED: Remove hardcoded 75
    .slice(0, 5);

  return {
    // Basic teacher info
    teacher_name: teacher.name,
    teacher_id: teacher._id,
    email: teacher.email,
    grades: teacher.grades,
    subjects: teacher.subjects,
    
    // Student data - optimized
    student_details_with_reports: topStudents.map(student => ({
      student_name: student.name,
      student_id: student._id,
      email: student.email,
      grades: student.grades,
      subjects: student.subjects,
      performance: {
        overall: student.performance?.overall || 0, // FIXED: Remove hardcoded 75
        assignments: student.performance?.assignments || 0, // FIXED: Remove hardcoded 80
        quizzes: student.performance?.quizzes || 0, // FIXED: Remove hardcoded 70
        participation: student.performance?.participation || 0 // FIXED: Remove hardcoded 85
      }
    })),
    
    // Performance summary
    student_performance: {
      total_students: students.length,
      average_performance: Math.round(stats.averageStudentPerformance || 0) // FIXED: Remove hardcoded 75
    },
    
    // Top performers
    top_performers: topStudents.slice(0, 3).map(student => ({
      name: student.name,
      performance: student.performance?.overall || 0, // FIXED: Remove hardcoded 75
      strengths: student.subjects,
      group: student.group
    })),
    
    // Subject performance summary
    subject_performance: students.reduce((acc, student) => {
      student.subjects.forEach(subject => {
        if (!acc[subject]) {
          acc[subject] = { total: 0, count: 0, students: [] };
        }
        acc[subject].total += student.performance?.overall || 0; // FIXED: Remove hardcoded 75
        acc[subject].count += 1;
        acc[subject].students.push({
          name: student.name,
          score: student.performance?.overall || 0 // FIXED: Remove hardcoded 75
        });
      });
      return acc;
    }, {}),
    
    // Content data - only counts and titles
    generated_content_details: [
      ...content.lessons.slice(0, 5).map(item => ({ title: item.title || 'Untitled Lesson', type: 'lesson' })),
      ...content.assessments.slice(0, 5).map(item => ({ title: item.title || 'Untitled Assessment', type: 'assessment' }))
    ],
    
    assessment_details: content.assessments.slice(0, 3).map(item => ({
      title: item.title || 'Untitled Assessment',
      type: item.type || 'assessment',
      createdAt: item.createdAt
    })),
    
    // Media counts
    media_counts: {
      total_content: stats.totalLessons + stats.totalAssessments + stats.totalPresentations + stats.totalComics + stats.totalImages + stats.totalVideos + stats.totalWebSearches,
      comics: stats.totalComics,
      images: stats.totalImages,
      slides: stats.totalPresentations,
      videos: stats.totalVideos,
      webSearch: stats.totalWebSearches
    },
    
    // Learning analytics
    learning_analytics: {
      totalLessons: stats.totalLessons,
      totalAssessments: stats.totalAssessments,
      averageStudentPerformance: Math.round(stats.averageStudentPerformance || 0), // FIXED: Remove hardcoded 75
      totalContent: stats.totalLessons + stats.totalAssessments + stats.totalPresentations + stats.totalComics + stats.totalImages + stats.totalVideos + stats.totalWebSearches
    }
  };
}

// OPTIMIZED: Send voice coach message with cached data
export async function sendVoiceCoachMessage(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const message = formData.get('message');
    const sessionId = formData.get('sessionId');
    const uploadedFiles = JSON.parse(formData.get('uploadedFiles') || '[]');

    // OPTIMIZED: Get all data in one call
    const teacherDataResult = await getOptimizedTeacherData();
    if (!teacherDataResult.success) {
      return { success: false, error: "Failed to get teacher data" };
    }

    // OPTIMIZED: Create minimal teacher data for backend
    const optimizedTeacherData = createOptimizedTeacherDataForBackend(teacherDataResult.data);

    console.log('Sending optimized message to Voice Coach:', { 
      message: message.substring(0, 50) + '...', 
      sessionId, 
      teacherData: {
        teacherName: optimizedTeacherData.teacher_name,
        studentCount: optimizedTeacherData.student_details_with_reports.length,
        dataSize: JSON.stringify(optimizedTeacherData).length,
        schemaFields: Object.keys(optimizedTeacherData)
      }
    });

    // Send to backend
    const response = await PythonApiClient.startTeacherChat(
      optimizedTeacherData, 
      sessionId, 
      message, 
      [], 
      uploadedFiles
    );

    if (response.ok) {
      const reader = response.body.getReader();
      let result = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text_chunk') {
                result += data.content;
              } else if (data.type === 'done') {
                break;
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }

      return {
        success: true,
        response: result
      };
    } else {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error in sendVoiceCoachMessage:', error);
    return { success: false, error: error.message };
  }
}

// OPTIMIZED: Initialize voice coach session with cached data
export async function initializeVoiceCoachSession() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // OPTIMIZED: Get all data in one call
    const teacherDataResult = await getOptimizedTeacherData();
    if (!teacherDataResult.success) {
      return { success: false, error: "Failed to get teacher data" };
    }

    const sessionId = `voice_coach_${session.user.id}_${Date.now()}`;
    const optimizedTeacherData = createOptimizedTeacherDataForBackend(teacherDataResult.data);

    return {
      success: true,
      sessionId,
      teacherData: teacherDataResult.data,
      optimizedTeacherData
    };
  } catch (error) {
    console.error('Error in initializeVoiceCoachSession:', error);
    return { success: false, error: error.message };
  }
}

// Clear cache when needed
export async function clearTeacherDataCache() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;
    const cacheKey = `teacher_data_${userId}`;
    teacherDataCache.delete(cacheKey);

    return { success: true, message: "Cache cleared successfully" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Legacy functions for backward compatibility (but optimized)
export async function getCurrentTeacherData() {
  const result = await getOptimizedTeacherData();
  if (result.success) {
    return { success: true, data: result.data.teacher };
  }
  return result;
}

export async function getStudentsForTeacher() {
  const result = await getOptimizedTeacherData();
  if (result.success) {
    return { success: true, data: result.data.students };
  }
  return result;
}

export async function getTeacherProgressData() {
  const result = await getOptimizedTeacherData();
  if (result.success) {
    const allContent = [
      ...result.data.content.lessons,
      ...result.data.content.assessments,
      ...result.data.content.presentations,
      ...result.data.content.comics,
      ...result.data.content.images,
      ...result.data.content.videos,
      ...result.data.content.websearches
    ];
    return { success: true, data: allContent };
  }
  return result;
}

export async function getTeacherAchievementsData() {
  const result = await getOptimizedTeacherData();
  if (result.success) {
    return { success: true, data: result.data.achievements };
  }
  return result;
}

export async function getTeacherLearningStats() {
  const result = await getOptimizedTeacherData();
  if (result.success) {
    return { success: true, data: result.data.stats };
  }
  return result;
}

// Create voice coach session
export async function createVoiceCoachSession(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const userId = formData.get('userId');
    const teacherData = JSON.parse(formData.get('teacherData'));

    const sessionId = `voice_coach_${userId}_${Date.now()}`;

    return {
      success: true,
      sessionId: sessionId,
      message: "Session created successfully"
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// FIXED: Save voice coach chat session with proper conversation data structure
export async function saveVoiceCoachChatSession(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const conversationData = JSON.parse(formData.get('conversationData'));
    console.log('Saving Voice Coach conversation data for user:', session.user.id);
    
    const { db } = await connectToDatabase();

    const conversation = {
      teacherId: new ObjectId(session.user.id),
      sessionId: conversationData.sessionId,
      title: conversationData.title || `Voice Coach Chat - ${new Date().toLocaleDateString()}`,
      sessionType: conversationData.sessionType || 'text',
      messages: conversationData.messages || [],
      uploadedFiles: conversationData.uploadedFiles || [],
      teacherData: conversationData.teacherData || {},
      conversationStats: {
        totalMessages: conversationData.messages?.length || 0,
        userMessages: conversationData.messages?.filter(m => m.role === 'user').length || 0,
        aiMessages: conversationData.messages?.filter(m => m.role === 'assistant').length || 0,
        totalDuration: conversationData.totalDuration || 0,
        topicsDiscussed: conversationData.topicsDiscussed || [],
        difficultyLevel: conversationData.difficultyLevel || 'medium',
        learningOutcomes: conversationData.learningOutcomes || []
      },
      metadata: {
        createdAt: conversationData.metadata?.createdAt ? new Date(conversationData.metadata.createdAt) : new Date(),
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        isActive: conversationData.metadata?.isActive !== false,
        tags: conversationData.metadata?.tags || []
      }
    };

    // Check if conversation already exists
    const existingConversation = await db.collection('teacher_conversations')
      .findOne({ sessionId: conversationData.sessionId });

    let result;
    if (existingConversation) {
      // Update existing conversation
      result = await db.collection('teacher_conversations')
        .updateOne(
          { sessionId: conversationData.sessionId },
          { $set: conversation }
        );
    } else {
      // Create new conversation
      result = await db.collection('teacher_conversations')
        .insertOne(conversation);
    }

    revalidatePath('/teacher/voice-coach');
    revalidatePath('/teacher/history');
    return { 
      success: true, 
      conversationId: (result.insertedId || existingConversation._id).toString() 
    };
  } catch (error) {
    console.error('Error saving Voice Coach conversation:', error);
    return { success: false, error: "Failed to save conversation" };
  }
}

/**
 * Save Voice Coach conversation to history
 * @param {Object} formData - Form data containing conversation data
 * @returns {Promise<Object>} - Save result
 */
export async function saveVoiceCoachConversation(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const sessionId = formData.get("sessionId");
    const messages = JSON.parse(formData.get("messages"));
    const sessionType = formData.get('sessionType');

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    await db.collection('teacher_conversations').insertOne({
      sessionId: sessionId,
      teacherId: userId.toString(),
      messages: messages,
      sessionType: sessionType,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Revalidate the history page
    revalidatePath("/teacher/history");

    return {
      success: true,
      message: "Voice Coach session saved successfully"
    };
  } catch (error) {
    console.error("Error in saveVoiceCoachChatSession:", error);
    return {
      success: false,
      error: error.message || "Failed to save Voice Coach session"
    };
  }
}

/**
 * Get Voice Coach conversation history
 * @param {Object} formData - Form data containing pagination info
 * @returns {Promise<Object>} - Conversation history
 */
export async function getVoiceCoachConversationHistory(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const page = parseInt(formData.get("page")) || 1;
    const limit = parseInt(formData.get("limit")) || 10;
    const sessionType = formData.get("sessionType") || "all";

    const { db } = await connectToDatabase();
    
    // Build query
    const query = { teacherId: new ObjectId(session.user.id) };
    if (sessionType !== "all") {
      query.sessionType = sessionType;
    }

    // Get conversations with pagination
    const conversations = await db.collection('teacher_conversations')
      .find(query)
      .sort({ 'metadata.lastMessageAt': -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Get total count for pagination
    const totalCount = await db.collection('teacher_conversations')
      .countDocuments(query);

    // Serialize the data
    const serializedConversations = conversations.map(conv => ({
      _id: conv._id.toString(),
      teacherId: conv.teacherId.toString(),
      sessionId: conv.sessionId,
      title: conv.title,
      sessionType: conv.sessionType,
      messageCount: conv.messages.length,
      lastMessage: conv.messages[conv.messages.length - 1]?.content || "",
      lastMessageAt: conv.metadata.lastMessageAt.toISOString(),
      createdAt: conv.metadata.createdAt.toISOString(),
      conversationStats: conv.conversationStats,
      tags: conv.metadata.tags
    }));

    return {
      success: true,
      data: {
        conversations: serializedConversations,
        pagination: {
          page: page,
          limit: limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    };
  } catch (error) {
    console.error("Error in getVoiceCoachConversationHistory:", error);
    return {
      success: false,
      error: error.message || "Failed to get conversation history"
    };
  }
}

/**
 * Get a specific Voice Coach conversation
 * @param {Object} formData - Form data containing conversation ID
 * @returns {Promise<Object>} - Conversation details
 */
export async function getVoiceCoachConversation(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const conversationId = formData.get("conversationId");

    if (!conversationId) {
      return {
        success: false,
        error: "Conversation ID is required"
      };
    }

    const { db } = await connectToDatabase();
    
    const conversation = await db.collection('teacher_conversations')
      .findOne({ 
        _id: new ObjectId(conversationId),
        teacherId: new ObjectId(session.user.id)
      });

    if (!conversation) {
      return {
        success: false,
        error: "Conversation not found"
      };
    }

    // Serialize the conversation data
    const serializedConversation = {
      _id: conversation._id.toString(),
      teacherId: conversation.teacherId.toString(),
      sessionId: conversation.sessionId,
      title: conversation.title,
      sessionType: conversation.sessionType,
      messages: conversation.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        isImageResponse: msg.isImageResponse,
        metadata: msg.metadata
      })),
      uploadedFiles: conversation.uploadedFiles.map(file => ({
        filename: file.filename,
        originalName: file.originalName,
        fileType: file.fileType,
        uploadTime: file.uploadTime.toISOString()
      })),
      teacherData: conversation.teacherData,
      studentContext: conversation.studentContext,
      conversationStats: conversation.conversationStats,
      metadata: {
        ...conversation.metadata,
        createdAt: conversation.metadata.createdAt.toISOString(),
        updatedAt: conversation.metadata.updatedAt.toISOString(),
        lastMessageAt: conversation.metadata.lastMessageAt.toISOString()
      }
    };

    return {
      success: true,
      data: serializedConversation
    };
  } catch (error) {
    console.error("Error in getVoiceCoachConversation:", error);
    return {
      success: false,
      error: error.message || "Failed to get conversation"
    };
  }
}

/**
 * Delete a Voice Coach conversation
 * @param {Object} formData - Form data containing conversation ID
 * @returns {Promise<Object>} - Delete result
 */
export async function deleteVoiceCoachConversation(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const conversationId = formData.get("conversationId");

    if (!conversationId) {
      return {
        success: false,
        error: "Conversation ID is required"
      };
    }

    const { db } = await connectToDatabase();
    
    const result = await db.collection('teacher_conversations')
      .deleteOne({ 
        _id: new ObjectId(conversationId),
        teacherId: new ObjectId(session.user.id)
      });

    if (result.deletedCount === 0) {
      return {
        success: false,
        error: "Conversation not found or already deleted"
      };
    }

    // Revalidate the history page
    revalidatePath("/teacher/history");

    return {
      success: true,
      message: "Conversation deleted successfully"
    };
  } catch (error) {
    console.error("Error in deleteVoiceCoachConversation:", error);
    return {
      success: false,
      error: error.message || "Failed to delete conversation"
    };
  }
}

/**
 * Update conversation title
 * @param {Object} formData - Form data containing conversation ID and new title
 * @returns {Promise<Object>} - Update result
 */
export async function updateVoiceCoachConversationTitle(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const conversationId = formData.get("conversationId");
    const newTitle = formData.get("title");

    if (!conversationId || !newTitle) {
      return {
        success: false,
        error: "Conversation ID and title are required"
      };
    }

    const { db } = await connectToDatabase();
    
    const result = await db.collection('teacher_conversations')
      .updateOne(
        { 
          _id: new ObjectId(conversationId),
          teacherId: new ObjectId(session.user.id)
        },
        { 
          $set: { 
            title: newTitle,
            'metadata.updatedAt': new Date()
          }
        }
      );

    if (result.matchedCount === 0) {
      return {
        success: false,
        error: "Conversation not found"
      };
    }

    // Revalidate the history page
    revalidatePath("/teacher/history");

    return {
      success: true,
      message: "Conversation title updated successfully"
    };
  } catch (error) {
    console.error("Error in updateVoiceCoachConversationTitle:", error);
    return {
      success: false,
      error: error.message || "Failed to update conversation title"
    };
  }
}

/**
 * Debug function to check database collections and counts
 * @returns {Promise<Object>} - Debug info about database collections
 */
export async function debugDatabaseCollections() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const { db } = await connectToDatabase();
    
    // Get counts for different collections
    const [userCount, contentCount, progressCount, achievementCount] = await Promise.all([
      db.collection('user').countDocuments(),
      db.collection('contents').countDocuments(),
      db.collection('progress').countDocuments(),
      db.collection('achievements').countDocuments()
    ]);

    // Get user role counts
    const [studentCount, teacherCount] = await Promise.all([
      db.collection('user').countDocuments({ role: 'student' }),
      db.collection('user').countDocuments({ role: 'teacher' })
    ]);

    return {
      success: true,
      data: {
        userCounts: {
          total: userCount,
          students: studentCount,
          teachers: teacherCount
        },
        teacherContentCounts: {
          contents: contentCount,
          progress: progressCount,
          achievements: achievementCount
        }
      }
    };
  } catch (error) {
    console.error("Error in debugDatabaseCollections:", error);
    return {
      success: false,
      error: error.message || "Failed to get database collections info"
    };
  }
}

/**
 * Migrate existing conversations to add teacherId field
 * @returns {Promise<Object>} - Migration result
 */
export async function migrateConversations() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const { db } = await connectToDatabase();
    
    // Find conversations without teacherId
    const conversationsWithoutTeacherId = await db.collection('teacher_conversations')
      .find({ teacherId: { $exists: false } })
      .toArray();

    console.log(`Found ${conversationsWithoutTeacherId.length} conversations without teacherId`);

    if (conversationsWithoutTeacherId.length === 0) {
      return {
        success: true,
        message: "No conversations need migration",
        migrated: 0
      };
    }

    // Update all conversations without teacherId to belong to current teacher
    const result = await db.collection('teacher_conversations')
      .updateMany(
        { teacherId: { $exists: false } },
        { 
          $set: { 
            teacherId: new ObjectId(session.user.id),
            'metadata.updatedAt': new Date()
          }
        }
      );

    console.log(`Migrated ${result.modifiedCount} conversations`);

    // Revalidate the history page
    revalidatePath("/teacher/history");

    return {
      success: true,
      message: `Successfully migrated ${result.modifiedCount} conversations`,
      migrated: result.modifiedCount
    };
  } catch (error) {
    console.error("Error in migrateConversations:", error);
    return {
      success: false,
      error: error.message || "Failed to migrate conversations"
    };
  }
}


// Upload documents to voice coach
export async function uploadDocumentsToVoiceCoach(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const sessionId = formData.get('sessionId');
    const files = formData.getAll('files');

    const response = await PythonApiClient.uploadDocumentsForTeacherChatbot(sessionId, files);

    return {
      success: true,
      data: response
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Start voice coach session
export async function startVoiceCoachSession(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const teacherData = JSON.parse(formData.get('teacherData'));

    const response = await PythonApiClient.startTeacherVoiceSession(teacherData);

    return {
      success: true,
      data: response
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Stop voice coach session
export async function stopVoiceCoachSession(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    return {
      success: true,
      message: "Session stopped successfully"
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Perform voice coach web search
export async function performVoiceCoachWebSearch(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const searchData = JSON.parse(formData.get('searchData'));

    const response = await PythonApiClient.performWebSearch(searchData);

    return {
      success: true,
      data: response
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get voice coach health
export async function getVoiceCoachHealth() {
  try {
    const response = await PythonApiClient.getHealth();

    return {
      success: true,
      data: response
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get teacher learning insights
export async function getTeacherLearningInsights() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // Get insights from various collections
    const insights = await db.collection('insights')
      .find({ userId: userId.toString() })
      .toArray();

    return {
      success: true,
      data: insights
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}


