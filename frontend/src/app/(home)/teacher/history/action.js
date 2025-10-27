"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";

// Helper function to serialize MongoDB objects
function serializeMongoData(data) {
  if (data === null || data === undefined) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => serializeMongoData(item));
  }
  
  if (typeof data === 'object') {
    if (data._id && typeof data._id.toString === 'function') {
      return {
        ...data,
        _id: data._id.toString()
      };
    }
    
    const serialized = {};
    for (const [key, value] of Object.entries(data)) {
      serialized[key] = serializeMongoData(value);
    }
    return serialized;
  }
  
  return data;
}

// Helper function to safely convert dates to ISO strings
function safeToISOString(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string') return dateValue;
  if (dateValue.toISOString && typeof dateValue.toISOString === 'function') {
    return dateValue.toISOString();
  }
  return dateValue;
}

/**
 * Comprehensive debug function to check database and session
 * @returns {Promise<Object>} - Debug info
 */
export async function comprehensiveDebug() {
  try {
    
    // Check session
    const session = await getServerSession();

    
    if (!session?.user?.id) {
      return {
        success: false,
        error: "No session or user ID found",
        debug: {
          hasSession: !!session,
          hasUser: !!session?.user,
          hasUserId: !!session?.user?.id,
          sessionData: session
        }
      };
    }

    // Check database connection
    const { db } = await connectToDatabase();

    // List all collections
    const collections = await db.listCollections().toArray();

    // Check if teacherConversations collection exists
    const teacherConversationsExists = collections.some(c => c.name === 'teacherConversations');

    // Get all conversations in teacherConversations (if exists)
    let allConversations = [];
    if (teacherConversationsExists) {
      allConversations = await db.collection('teacherConversations').find({}).toArray();
    }

    // Check conversations for this specific teacher using sessionId pattern
    const userId = session.user.id;
    
    // Look for conversations where sessionId contains the user ID
    const teacherConversations = await db.collection('teacherConversations')
      .find({ sessionId: { $regex: userId, $options: 'i' } })
      .toArray();
    

    // Also check if there are conversations with teacherId field
    const conversationsWithTeacherId = await db.collection('teacherConversations')
      .find({ teacherId: { $in: [new ObjectId(userId), userId] } })
      .toArray();
    

    // Check all unique sessionId patterns
    const uniqueSessionIds = await db.collection('teacherConversations')
      .distinct('sessionId');
    

    return {
      success: true,
      debug: {
        session: {
          hasSession: !!session,
          hasUser: !!session?.user,
          hasUserId: !!session?.user?.id,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          userRole: session?.user?.role
        },
        database: {
          connected: true,
          collections: collections.map(c => c.name),
          teacherConversationsExists: teacherConversationsExists
        },
        conversations: {
          totalInCollection: allConversations.length,
          forThisTeacher: teacherConversations.length,
          withTeacherIdField: conversationsWithTeacherId.length,
          uniqueSessionIds: uniqueSessionIds,
          sampleConversation: allConversations.length > 0 ? {
            _id: allConversations[0]._id?.toString(),
            sessionId: allConversations[0].sessionId,
            sessionType: allConversations[0].sessionType,
            messageCount: allConversations[0].messages?.length || 0,
            hasTeacherId: !!allConversations[0].teacherId
          } : null
        }
      }
    };
  } catch (error) {
    console.error("Error in comprehensiveDebug:", error);
    return {
      success: false,
      error: error.message || "Debug failed",
      stack: error.stack
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
        error: "Unauthorized - No session found"
      };
    }

    const page = parseInt(formData.get("page")) || 1;
    const limit = parseInt(formData.get("limit")) || 10;
    const sessionType = formData.get("sessionType") || "all";


    const { db } = await connectToDatabase();
    
    // Build query - try multiple approaches to find conversations
    const userId = session.user.id;
    
    
    // First, try to find conversations by sessionId pattern (voice_coach_USERID_*)
    let query = { 
      sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' }
    };
    
    if (sessionType !== "all") {
      query.sessionType = sessionType;
    }


    // Get conversations with pagination
    let conversations = await db.collection('teacherConversations')
      .find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();


    // If no conversations found with sessionId pattern, try teacherId field
    if (conversations.length === 0) {
      query = { teacherId: { $in: [new ObjectId(userId), userId] } };
      if (sessionType !== "all") {
        query.sessionType = sessionType;
      }
      
      conversations = await db.collection('teacherConversations')
        .find(query)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();
      
    }

    // Get total count for pagination
    const totalCount = await db.collection('teacherConversations')
      .countDocuments({ 
        $or: [
          { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
          { teacherId: { $in: [new ObjectId(userId), userId] } }
        ]
      });


    // Serialize the data
    const serializedConversations = conversations.map(conv => {
      const lastMessage = conv.messages && conv.messages.length > 0 
        ? conv.messages[conv.messages.length - 1] 
        : null;
      
      return {
        _id: conv._id.toString(),
        teacherId: conv.teacherId?.toString() || userId, // Use userId as fallback
        sessionId: conv.sessionId,
        title: conv.title || `Conversation ${conv.sessionId.split('_').pop()}`,
        sessionType: conv.sessionType || "text",
        messageCount: conv.messages?.length || 0,
        lastMessage: lastMessage?.content || "No messages",
        lastMessageAt: safeToISOString(conv.updatedAt || conv.createdAt),
        createdAt: safeToISOString(conv.createdAt),
        conversationStats: conv.conversationStats || {
          totalMessages: conv.messages?.length || 0,
          userMessages: conv.messages?.filter(m => m.role === 'user').length || 0,
          aiMessages: conv.messages?.filter(m => m.role === 'assistant').length || 0,
          totalDuration: 0
        },
        tags: conv.metadata?.tags || []
      };
    });

    

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
    
    const userId = session.user.id;
    
    // Try to find conversation by ID and verify ownership through sessionId pattern or teacherId
    const conversation = await db.collection('teacherConversations')
      .findOne({ 
        _id: new ObjectId(conversationId),
        $or: [
          { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
          { teacherId: { $in: [new ObjectId(userId), userId] } }
        ]
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
      teacherId: conversation.teacherId?.toString() || userId,
      sessionId: conversation.sessionId,
      title: conversation.title || `Conversation ${conversation.sessionId.split('_').pop()}`,
      sessionType: conversation.sessionType || "text",
      messages: (conversation.messages || []).map(msg => ({
        id: msg.id || msg._id?.toString(),
        role: msg.role,
        content: msg.content,
        timestamp: safeToISOString(msg.timestamp),
        isImageResponse: msg.isImageResponse || false,
        metadata: msg.metadata || {}
      })),
      uploadedFiles: (conversation.uploadedFiles || []).map(file => ({
        filename: file.filename,
        originalName: file.originalName,
        fileType: file.fileType,
        uploadTime: safeToISOString(file.uploadTime)
      })),
      teacherData: conversation.teacherData || {},
      studentContext: conversation.studentContext || {},
      conversationStats: conversation.conversationStats || {
        totalMessages: conversation.messages?.length || 0,
        userMessages: conversation.messages?.filter(m => m.role === 'user').length || 0,
        aiMessages: conversation.messages?.filter(m => m.role === 'assistant').length || 0,
        totalDuration: 0
      },
      metadata: {
        ...conversation.metadata,
        createdAt: safeToISOString(conversation.createdAt),
        updatedAt: safeToISOString(conversation.updatedAt),
        lastMessageAt: safeToISOString(conversation.updatedAt || conversation.createdAt)
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
    
    const userId = session.user.id;
    
    const result = await db.collection('teacherConversations')
      .deleteOne({ 
        _id: new ObjectId(conversationId),
        $or: [
          { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
          { teacherId: { $in: [new ObjectId(userId), userId] } }
        ]
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
    
    const userId = session.user.id;
    
    const result = await db.collection('teacherConversations')
      .updateOne(
        { 
          _id: new ObjectId(conversationId),
          $or: [
            { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
            { teacherId: { $in: [new ObjectId(userId), userId] } }
          ]
        },
        { 
          $set: { 
            title: newTitle,
            updatedAt: new Date()
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
 * Debug function to check all conversations in database
 * @returns {Promise<Object>} - Debug info
 */
export async function debugConversations() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return {
        success: false,
        error: "Unauthorized"
      };
    }

    const { db } = await connectToDatabase();
    
    const userId = session.user.id;
    
    // Get all conversations for this teacher using sessionId pattern
    const allConversations = await db.collection('teacherConversations')
      .find({ 
        $or: [
          { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
          { teacherId: { $in: [new ObjectId(userId), userId] } }
        ]
      })
      .toArray();

    // Get all conversations in the database (for debugging)
    const allConversationsInDb = await db.collection('teacherConversations')
      .find({})
      .toArray();


    return {
      success: true,
      data: {
        teacherConversations: allConversations.length,
        totalConversations: allConversationsInDb.length,
        teacherId: session.user.id,
        conversations: allConversations.map(conv => ({
          _id: conv._id.toString(),
          teacherId: conv.teacherId?.toString() || userId,
          sessionId: conv.sessionId,
          title: conv.title || `Conversation ${conv.sessionId.split('_').pop()}`,
          sessionType: conv.sessionType,
          messageCount: conv.messages?.length || 0
        }))
      }
    };
  } catch (error) {
    console.error("Error in debugConversations:", error);
    return {
      success: false,
      error: error.message || "Failed to debug conversations"
    };
  }
}

/**
 * Migration function to update conversation data structure
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
    
    const userId = session.user.id;
    
    // Get all conversations for this teacher using sessionId pattern
    const conversations = await db.collection('teacherConversations')
      .find({ 
        $or: [
          { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
          { teacherId: { $in: [new ObjectId(userId), userId] } }
        ]
      })
      .toArray();

    let migratedCount = 0;
    
    for (const conv of conversations) {
      const updateData = {};
      let needsUpdate = false;

      // Add teacherId if missing
      if (!conv.teacherId) {
        updateData.teacherId = new ObjectId(userId);
        needsUpdate = true;
      }

      // Ensure title exists
      if (!conv.title) {
        updateData.title = `Conversation ${conv.sessionId.split('_').pop()}`;
        needsUpdate = true;
      }

      // Ensure sessionType exists
      if (!conv.sessionType) {
        updateData.sessionType = "text";
        needsUpdate = true;
      }

      // Ensure conversationStats exists
      if (!conv.conversationStats) {
        const messageCount = conv.messages?.length || 0;
        const userMessages = conv.messages?.filter(m => m.role === 'user').length || 0;
        const aiMessages = conv.messages?.filter(m => m.role === 'assistant').length || 0;
        
        updateData.conversationStats = {
          totalMessages: messageCount,
          userMessages: userMessages,
          aiMessages: aiMessages,
          totalDuration: 0,
          topicsDiscussed: [],
          difficultyLevel: "medium",
          teachingOutcomes: []
        };
        needsUpdate = true;
      }

      // Ensure metadata exists
      if (!conv.metadata) {
        updateData.metadata = {
          createdAt: conv.createdAt || new Date(),
          updatedAt: conv.updatedAt || new Date(),
          lastMessageAt: conv.updatedAt || conv.createdAt || new Date(),
          isActive: true,
          tags: []
        };
        needsUpdate = true;
      }

      // Ensure updatedAt exists
      if (!conv.updatedAt) {
        updateData.updatedAt = conv.createdAt || new Date();
        needsUpdate = true;
      }

      if (needsUpdate) {
        await db.collection('teacherConversations')
          .updateOne(
            { _id: conv._id },
            { $set: updateData }
          );
        migratedCount++;
      }
    }

    return {
      success: true,
      message: `Successfully migrated ${migratedCount} conversations`
    };
  } catch (error) {
    console.error("Error in migrateConversations:", error);
    return {
      success: false,
      error: error.message || "Failed to migrate conversations"
    };
  }
}

// Save or update a teacher conversation
export async function saveTeacherConversation(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const conversationData = JSON.parse(formData.get('conversationData'));
    console.log('Saving teacher conversation data for user:', session.user.id);
    
    const { db } = await connectToDatabase();

    const conversation = {
      teacherId: new ObjectId(session.user.id),
      sessionId: conversationData.sessionId,
      title: conversationData.title || `Voice Coach Chat - ${new Date().toLocaleDateString()}`,
      sessionType: conversationData.sessionType || 'voice',
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
      console.log('Updated existing teacher conversation:', result);
    } else {
      // Insert new conversation
      result = await db.collection('teacher_conversations')
        .insertOne(conversation);
      console.log('Inserted new teacher conversation:', result);
    }

    revalidatePath('/teacher/history');
    
    return { 
      success: true, 
      conversationId: result.insertedId || existingConversation?._id,
      message: existingConversation ? 'Conversation updated successfully' : 'Conversation saved successfully'
    };

  } catch (error) {
    console.error('Error saving teacher conversation:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to save conversation' 
    };
  }
}

