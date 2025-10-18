"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";

// Helper function to serialize MongoDB objects
function serializeMongoData(data) {
  if (data === null || data === undefined) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => serializeMongoData(item));
  }
  
  if (typeof data === 'object') {
    if (data._id && data._id.toString) {
      data._id = data._id.toString();
    }
    
    const serialized = {};
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && value.constructor === Date) {
        serialized[key] = value.toISOString();
      } else if (value && typeof value === 'object' && value.toString && value.toString().includes('ObjectId')) {
        serialized[key] = value.toString();
      } else {
        serialized[key] = serializeMongoData(value);
      }
    }
    return serialized;
  }
  
  return data;
}

// Get all conversations (both teacher and student) for admin view
export async function getAllConversations(page = 1, limit = 10) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return { success: false, error: "Admin access required" };
    }

    const { db } = await connectToDatabase();

    // Get student conversations with pagination
    const studentConversations = await db.collection('student_conversations')
      .find({})
      .sort({ 'metadata.lastMessageAt': -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Get teacher conversations with pagination
    const teacherConversations = await db.collection('teacherConversations')
      .find({})
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    // Get all unique user IDs
    const studentIds = [...new Set(studentConversations.map(conv => conv.studentId?.toString()).filter(Boolean))];
    const teacherIds = [...new Set(teacherConversations.map(conv => conv.teacherId?.toString()).filter(Boolean))];
    const allUserIds = [...studentIds, ...teacherIds];

    // Fetch user names
    const users = await db.collection('user')
      .find({ _id: { $in: allUserIds.map(id => new ObjectId(id)) } })
      .project({ _id: 1, name: 1, email: 1 })
      .toArray();

    // Create user lookup map
    const userMap = users.reduce((acc, user) => {
      acc[user._id.toString()] = { name: user.name, email: user.email };
      return acc;
    }, {});

    // Transform student conversations to unified format
    const transformedStudentConversations = studentConversations.map(conv => {
      const userInfo = userMap[conv.studentId?.toString()] || { name: 'Unknown User', email: 'Unknown' };
      return {
        _id: conv._id.toString(),
        type: 'student',
        userId: conv.studentId?.toString(),
        userName: userInfo.name,
        userEmail: userInfo.email,
        sessionId: conv.sessionId,
        title: conv.title,
        sessionType: conv.sessionType || 'text',
        messages: conv.messages || [],
        messageCount: conv.messages?.length || 0,
        lastMessage: conv.messages && conv.messages.length > 0 
          ? conv.messages[conv.messages.length - 1].content 
          : "No messages",
        lastMessageAt: conv.metadata?.lastMessageAt || conv.metadata?.createdAt,
        createdAt: conv.metadata?.createdAt,
        conversationStats: conv.conversationStats || {
          totalMessages: conv.messages?.length || 0,
          userMessages: conv.messages?.filter(m => m.role === 'user').length || 0,
          aiMessages: conv.messages?.filter(m => m.role === 'assistant').length || 0,
          totalDuration: 0
        },
        uploadedFiles: conv.uploadedFiles || [],
        studentData: conv.studentData || {}
      };
    });

    // Transform teacher conversations to unified format
    const transformedTeacherConversations = teacherConversations.map(conv => {
      const userInfo = userMap[conv.teacherId?.toString()] || { name: 'Unknown User', email: 'Unknown' };
      return {
        _id: conv._id.toString(),
        type: 'teacher',
        userId: conv.teacherId?.toString(),
        userName: userInfo.name,
        userEmail: userInfo.email,
        sessionId: conv.sessionId,
        title: conv.title || `Conversation ${conv.sessionId.split('_').pop()}`,
        sessionType: conv.sessionType || 'text',
        messages: conv.messages || [],
        messageCount: conv.messages?.length || 0,
        lastMessage: conv.messages && conv.messages.length > 0 
          ? conv.messages[conv.messages.length - 1].content 
          : "No messages",
        lastMessageAt: conv.updatedAt || conv.createdAt,
        createdAt: conv.createdAt,
        conversationStats: conv.conversationStats || {
          totalMessages: conv.messages?.length || 0,
          userMessages: conv.messages?.filter(m => m.role === 'user').length || 0,
          aiMessages: conv.messages?.filter(m => m.role === 'assistant').length || 0,
          totalDuration: 0
        },
        uploadedFiles: conv.uploadedFiles || [],
        teacherData: conv.teacherData || {}
      };
    });

    // Get total counts for pagination
    const totalStudentCount = await db.collection('student_conversations').countDocuments({});
    const totalTeacherCount = await db.collection('teacherConversations').countDocuments({});
    const totalCount = totalStudentCount + totalTeacherCount;

    // Combine and sort all conversations
    const allConversations = [...transformedStudentConversations, ...transformedTeacherConversations]
      .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

    return {
      success: true,
      data: serializeMongoData(allConversations),
      pagination: {
        page: page,
        limit: limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching all conversations:', error);
    return { success: false, error: "Failed to fetch conversations" };
  }
}

// Get conversations by type (all, teacher, student)
export async function getConversationsByType(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return { success: false, error: "Admin access required" };
    }

    const type = formData.get('type') || 'all';
    const page = parseInt(formData.get('page')) || 1;
    const limit = parseInt(formData.get('limit')) || 10;
    const { db } = await connectToDatabase();

    let conversations = [];
    let totalCount = 0;

    if (type === 'all') {
      // Get all conversations
      const result = await getAllConversations(page, limit);
      return result;
    } else if (type === 'teacher') {
      // Get only teacher conversations
      const teacherConversations = await db.collection('teacherConversations')
        .find({})
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      // Get teacher user IDs
      const teacherIds = [...new Set(teacherConversations.map(conv => conv.teacherId?.toString()).filter(Boolean))];
      
      // Fetch teacher user names
      const users = await db.collection('user')
        .find({ _id: { $in: teacherIds.map(id => new ObjectId(id)) } })
        .project({ _id: 1, name: 1, email: 1 })
        .toArray();

      // Create user lookup map
      const userMap = users.reduce((acc, user) => {
        acc[user._id.toString()] = { name: user.name, email: user.email };
        return acc;
      }, {});

      conversations = teacherConversations.map(conv => {
        const userInfo = userMap[conv.teacherId?.toString()] || { name: 'Unknown User', email: 'Unknown' };
        return {
          _id: conv._id.toString(),
          type: 'teacher',
          userId: conv.teacherId?.toString(),
          userName: userInfo.name,
          userEmail: userInfo.email,
          sessionId: conv.sessionId,
          title: conv.title || `Conversation ${conv.sessionId.split('_').pop()}`,
          sessionType: conv.sessionType || 'text',
          messages: conv.messages || [],
          messageCount: conv.messages?.length || 0,
          lastMessage: conv.messages && conv.messages.length > 0 
            ? conv.messages[conv.messages.length - 1].content 
            : "No messages",
          lastMessageAt: conv.updatedAt || conv.createdAt,
          createdAt: conv.createdAt,
          conversationStats: conv.conversationStats || {
            totalMessages: conv.messages?.length || 0,
            userMessages: conv.messages?.filter(m => m.role === 'user').length || 0,
            aiMessages: conv.messages?.filter(m => m.role === 'assistant').length || 0,
            totalDuration: 0
          },
          uploadedFiles: conv.uploadedFiles || [],
          teacherData: conv.teacherData || {}
        };
      });

      // Get total count for teacher conversations
      const totalCount = await db.collection('teacherConversations').countDocuments({});
    } else if (type === 'student') {
      // Get only student conversations
      const studentConversations = await db.collection('student_conversations')
        .find({})
        .sort({ 'metadata.lastMessageAt': -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      // Get student user IDs
      const studentIds = [...new Set(studentConversations.map(conv => conv.studentId?.toString()).filter(Boolean))];
      
      // Fetch student user names
      const users = await db.collection('user')
        .find({ _id: { $in: studentIds.map(id => new ObjectId(id)) } })
        .project({ _id: 1, name: 1, email: 1 })
        .toArray();

      // Create user lookup map
      const userMap = users.reduce((acc, user) => {
        acc[user._id.toString()] = { name: user.name, email: user.email };
        return acc;
      }, {});

      conversations = studentConversations.map(conv => {
        const userInfo = userMap[conv.studentId?.toString()] || { name: 'Unknown User', email: 'Unknown' };
        return {
          _id: conv._id.toString(),
          type: 'student',
          userId: conv.studentId?.toString(),
          userName: userInfo.name,
          userEmail: userInfo.email,
          sessionId: conv.sessionId,
          title: conv.title,
          sessionType: conv.sessionType || 'text',
          messages: conv.messages || [],
          messageCount: conv.messages?.length || 0,
          lastMessage: conv.messages && conv.messages.length > 0 
            ? conv.messages[conv.messages.length - 1].content 
            : "No messages",
          lastMessageAt: conv.metadata?.lastMessageAt || conv.metadata?.createdAt,
          createdAt: conv.metadata?.createdAt,
          conversationStats: conv.conversationStats || {
            totalMessages: conv.messages?.length || 0,
            userMessages: conv.messages?.filter(m => m.role === 'user').length || 0,
            aiMessages: conv.messages?.filter(m => m.role === 'assistant').length || 0,
            totalDuration: 0
          },
          uploadedFiles: conv.uploadedFiles || [],
          studentData: conv.studentData || {}
        };
      });

      // Get total count for student conversations
      const totalCount = await db.collection('student_conversations').countDocuments({});
    }

    return {
      success: true,
      data: serializeMongoData(conversations),
      pagination: {
        page: page,
        limit: limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching conversations by type:', error);
    return { success: false, error: "Failed to fetch conversations" };
  }
}

// Get conversation statistics for admin dashboard
export async function getAdminConversationStats() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return { success: false, error: "Admin access required" };
    }

    const { db } = await connectToDatabase();

    // Get student conversation stats
    const studentStats = await db.collection('student_conversations').aggregate([
      {
        $group: {
          _id: null,
          totalStudentConversations: { $sum: 1 },
          totalStudentMessages: { $sum: { $size: '$messages' } },
          totalStudentUsers: { $addToSet: '$studentId' },
          avgStudentMessagesPerConversation: { $avg: { $size: '$messages' } },
          lastStudentConversationDate: { $max: '$metadata.lastMessageAt' }
        }
      }
    ]).toArray();

    // Get teacher conversation stats
    const teacherStats = await db.collection('teacherConversations').aggregate([
      {
        $group: {
          _id: null,
          totalTeacherConversations: { $sum: 1 },
          totalTeacherMessages: { $sum: { $size: '$messages' } },
          totalTeacherUsers: { $addToSet: '$teacherId' },
          avgTeacherMessagesPerConversation: { $avg: { $size: '$messages' } },
          lastTeacherConversationDate: { $max: '$updatedAt' }
        }
      }
    ]).toArray();

    const stats = {
      student: studentStats[0] || {
        totalStudentConversations: 0,
        totalStudentMessages: 0,
        totalStudentUsers: [],
        avgStudentMessagesPerConversation: 0,
        lastStudentConversationDate: null
      },
      teacher: teacherStats[0] || {
        totalTeacherConversations: 0,
        totalTeacherMessages: 0,
        totalTeacherUsers: [],
        avgTeacherMessagesPerConversation: 0,
        lastTeacherConversationDate: null
      }
    };

    // Calculate totals
    stats.total = {
      conversations: stats.student.totalStudentConversations + stats.teacher.totalTeacherConversations,
      messages: stats.student.totalStudentMessages + stats.teacher.totalTeacherMessages,
      users: stats.student.totalStudentUsers.length + stats.teacher.totalTeacherUsers.length
    };

    return {
      success: true,
      data: serializeMongoData(stats)
    };
  } catch (error) {
    console.error('Error fetching admin conversation stats:', error);
    return { success: false, error: "Failed to fetch conversation statistics" };
  }
}

// Get detailed conversation by ID
export async function getConversationDetails(formData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    // Check if user is admin
    if (session.user.role !== 'admin') {
      return { success: false, error: "Admin access required" };
    }

    const conversationId = formData.get('conversationId');
    const conversationType = formData.get('type'); // 'student' or 'teacher'

    if (!conversationId || !conversationType) {
      return { success: false, error: "Conversation ID and type are required" };
    }

    const { db } = await connectToDatabase();

    let conversation;
    if (conversationType === 'student') {
      conversation = await db.collection('student_conversations')
        .findOne({ _id: new ObjectId(conversationId) });
    } else if (conversationType === 'teacher') {
      conversation = await db.collection('teacherConversations')
        .findOne({ _id: new ObjectId(conversationId) });
    }

    if (!conversation) {
      return { success: false, error: "Conversation not found" };
    }

    // Transform to unified format
    const transformedConversation = {
      _id: conversation._id.toString(),
      type: conversationType,
      userId: conversationType === 'student' ? conversation.studentId?.toString() : conversation.teacherId?.toString(),
      sessionId: conversation.sessionId,
      title: conversation.title || `Conversation ${conversation.sessionId.split('_').pop()}`,
      sessionType: conversation.sessionType || 'text',
      messages: conversation.messages || [],
      messageCount: conversation.messages?.length || 0,
      lastMessage: conversation.messages && conversation.messages.length > 0 
        ? conversation.messages[conversation.messages.length - 1].content 
        : "No messages",
      lastMessageAt: conversationType === 'student' 
        ? (conversation.metadata?.lastMessageAt || conversation.metadata?.createdAt)
        : (conversation.updatedAt || conversation.createdAt),
      createdAt: conversationType === 'student' 
        ? conversation.metadata?.createdAt 
        : conversation.createdAt,
      conversationStats: conversation.conversationStats || {
        totalMessages: conversation.messages?.length || 0,
        userMessages: conversation.messages?.filter(m => m.role === 'user').length || 0,
        aiMessages: conversation.messages?.filter(m => m.role === 'assistant').length || 0,
        totalDuration: 0
      },
      uploadedFiles: conversation.uploadedFiles || [],
      studentData: conversation.studentData || {},
      teacherData: conversation.teacherData || {}
    };

    return {
      success: true,
      data: serializeMongoData(transformedConversation)
    };
  } catch (error) {
    console.error('Error fetching conversation details:', error);
    return { success: false, error: "Failed to fetch conversation details" };
  }
}