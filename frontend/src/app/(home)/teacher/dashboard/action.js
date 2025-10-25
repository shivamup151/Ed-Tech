"use server";

import { cache } from "react";
import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";

// Helper function to safely convert dates to ISO strings
function safeToISOString(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string') return dateValue;
  if (dateValue.toISOString && typeof dateValue.toISOString === 'function') {
    return dateValue.toISOString();
  }
  return dateValue;
}

// Helper function to generate better titles
function generateBetterTitle(item, type) {
  if (item.title && item.title.trim() !== '') {
    return item.title;
  }

  switch (type) {
    case 'comic':
      if (item.instruction && item.instruction.trim() !== '') {
        return item.instruction.length > 50 
          ? item.instruction.substring(0, 50) + '...' 
          : item.instruction;
      }
      return `${item.subject || 'General'} Comic - Grade ${item.grade || 'All'}`;
    
    case 'image':
      if (item.prompt && item.prompt.trim() !== '') {
        return item.prompt.length > 50 
          ? item.prompt.substring(0, 50) + '...' 
          : item.prompt;
      }
      return `${item.subject || 'General'} Image - Grade ${item.grade || 'All'}`;
    
    case 'video':
      if (item.topic && item.topic.trim() !== '') {
        return item.topic.length > 50 
          ? item.topic.substring(0, 50) + '...' 
          : item.topic;
      }
      return `${item.subject || 'General'} Video - Grade ${item.grade || 'All'}`;
    
    case 'presentation':
      if (item.topic && item.topic.trim() !== '') {
        return item.topic.length > 50 
          ? item.topic.substring(0, 50) + '...' 
          : item.topic;
      }
      return `${item.subject || 'General'} Presentation - Grade ${item.grade || 'All'}`;
    
    case 'websearch':
      if (item.query && item.query.trim() !== '') {
        return item.query.length > 50 
          ? item.query.substring(0, 50) + '...' 
          : item.query;
      }
      return `${item.subject || 'General'} Web Search - Grade ${item.grade || 'All'}`;
    
    case 'content':
      if (item.topic && item.topic.trim() !== '') {
        return item.topic.length > 50 
          ? item.topic.substring(0, 50) + '...' 
          : item.topic;
      }
      return `${item.subject || 'General'} ${item.contentType || 'Content'} - Grade ${item.grade || 'All'}`;
    
    default:
      return `${item.subject || 'General'} ${type} - Grade ${item.grade || 'All'}`;
  }
}

// OPTIMIZED: Add caching to prevent duplicate calls during SSR
export const getTeacherDashboardData = cache(async () => {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return { success: false, error: "Unauthorized" };
    }

    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user.id);

    // OPTIMIZED: Use Promise.all for parallel execution
    const [user, conversations, contents, presentations, comics, images, videos, assessments, webSearches] = await Promise.all([
      db.collection('user').findOne({ _id: userId }),
      
      db.collection('teacher_conversations')
        .find({ 
          $or: [
            { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
            { teacherId: { $in: [userId, userId.toString()] } }
          ]
        })
        .sort({ "metadata.updatedAt": -1 })
        .limit(10)
        .toArray(),
      
      db.collection('contents')
        .find({ userId: userId.toString() })
        .sort({ "metadata.createdAt": -1 })
        .limit(5)
        .toArray(),
      
      db.collection('presentations')
        .find({ userId: userId.toString() })
        .sort({ "metadata.createdAt": -1 })
        .limit(5)
        .toArray(),
      
      db.collection('comics')
        .find({ userId: userId })
        .sort({ "metadata.createdAt": -1 })
        .limit(5)
        .toArray(),
      
      db.collection('images')
        .find({ userId: userId.toString() })
        .sort({ "metadata.createdAt": -1 })
        .limit(5)
        .toArray(),
      
      db.collection('videos')
        .find({ userId: userId.toString() })
        .sort({ "metadata.createdAt": -1 })
        .limit(5)
        .toArray(),
      
      db.collection('assessments')
        .find({ userId: userId })
        .sort({ "metadata.createdAt": -1 })
        .limit(5)
        .toArray(),
      
      db.collection('websearches')
        .find({ userId: userId })
        .sort({ "metadata.createdAt": -1 })
        .limit(5)
        .toArray()
    ]);

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // OPTIMIZED: Calculate stats in parallel
    const [
      totalConversations,
      totalContents,
      totalPresentations,
      totalComics,
      totalImages,
      totalVideos,
      totalAssessments,
      totalWebSearches,
      recentActivity,
      todayActivity
    ] = await Promise.all([
      db.collection('teacher_conversations')
        .countDocuments({ 
          $or: [
            { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
            { teacherId: { $in: [userId, userId.toString()] } }
          ]
        }),
      db.collection('contents').countDocuments({ userId: userId.toString() }),
      db.collection('presentations').countDocuments({ userId: userId.toString() }),
      db.collection('comics').countDocuments({ userId: userId }),
      db.collection('images').countDocuments({ userId: userId.toString() }),
      db.collection('videos').countDocuments({ userId: userId.toString() }),
      db.collection('assessments').countDocuments({ userId: userId }),
      db.collection('websearches').countDocuments({ userId: userId }),
      
      // Recent activity (last 7 days)
      db.collection('teacher_conversations')
        .countDocuments({
          $or: [
            { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
            { teacherId: { $in: [userId, userId.toString()] } }
          ],
          "metadata.updatedAt": { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }),
      
      // Today's activity
      (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        return db.collection('teacher_conversations')
          .countDocuments({
            $or: [
              { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
              { teacherId: { $in: [userId, userId.toString()] } }
            ],
            "metadata.updatedAt": {
              $gte: today,
              $lt: tomorrow
            }
          });
      })()
    ]);

    const totalContentGenerated = totalContents + totalPresentations + totalComics + totalImages + totalVideos + totalWebSearches;

    // Transform recent conversations
    const recentConversations = conversations.map(conversation => ({
      _id: conversation._id.toString(),
      teacherId: conversation.teacherId?.toString() || userId.toString(),
      sessionId: conversation.sessionId,
      title: conversation.title || `Conversation ${conversation.sessionId?.split('_').pop() || 'Unknown'}`,
      sessionType: conversation.sessionType || "text",
      messageCount: conversation.messages?.length || 0,
      lastMessage: conversation.messages && conversation.messages.length > 0 
        ? conversation.messages[conversation.messages.length - 1].content 
        : "No messages",
      lastMessageAt: safeToISOString(conversation.metadata?.lastMessageAt || conversation.metadata?.updatedAt || conversation.metadata?.createdAt),
      createdAt: safeToISOString(conversation.metadata?.createdAt),
      conversationStats: conversation.conversationStats || {
        totalMessages: conversation.messages?.length || 0,
        userMessages: conversation.messages?.filter(m => m.role === 'user').length || 0,
        aiMessages: conversation.messages?.filter(m => m.role === 'assistant').length || 0,
        totalDuration: 0
      },
      tags: conversation.metadata?.tags || []
    }));

    // Transform all content types into a unified format with better titles
    const allContent = [
      ...contents.map(content => ({
        _id: content._id.toString(),
        title: generateBetterTitle(content, 'content'),
        type: content.contentType || 'lesson',
        subject: content.subject || 'General',
        grade: content.grade || 'All',
        status: content.status || 'draft',
        createdAt: safeToISOString(content.metadata?.createdAt),
        updatedAt: safeToISOString(content.metadata?.updatedAt),
        contentType: 'content'
      })),
      ...presentations.map(presentation => ({
        _id: presentation._id.toString(),
        title: generateBetterTitle(presentation, 'presentation'),
        type: 'presentation',
        subject: presentation.subject || 'General',
        grade: presentation.grade || 'All',
        status: presentation.status || 'draft',
        createdAt: safeToISOString(presentation.metadata?.createdAt),
        updatedAt: safeToISOString(presentation.metadata?.updatedAt),
        contentType: 'presentation'
      })),
      ...comics.map(comic => ({
        _id: comic._id.toString(),
        title: generateBetterTitle(comic, 'comic'),
        type: 'comic',
        subject: comic.subject || 'General',
        grade: comic.grade || 'All',
        status: comic.status || 'draft',
        createdAt: safeToISOString(comic.metadata?.createdAt),
        updatedAt: safeToISOString(comic.metadata?.updatedAt),
        contentType: 'comic'
      })),
      ...images.map(image => ({
        _id: image._id.toString(),
        title: generateBetterTitle(image, 'image'),
        type: 'image',
        subject: image.subject || 'General',
        grade: image.grade || 'All',
        status: image.status || 'draft',
        createdAt: safeToISOString(image.metadata?.createdAt),
        updatedAt: safeToISOString(image.metadata?.updatedAt),
        contentType: 'image'
      })),
      ...videos.map(video => ({
        _id: video._id.toString(),
        title: generateBetterTitle(video, 'video'),
        type: 'video',
        subject: video.subject || 'General',
        grade: video.grade || 'All',
        status: video.status || 'draft',
        createdAt: safeToISOString(video.metadata?.createdAt),
        updatedAt: safeToISOString(video.metadata?.updatedAt),
        contentType: 'video'
      })),
      ...webSearches.map(search => ({
        _id: search._id.toString(),
        title: generateBetterTitle(search, 'websearch'),
        type: 'websearch',
        subject: search.subject || 'General',
        grade: search.grade || 'All',
        status: search.status || 'completed',
        createdAt: safeToISOString(search.metadata?.createdAt),
        updatedAt: safeToISOString(search.metadata?.updatedAt),
        contentType: 'websearch'
      }))
    ].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    const recentContent = allContent.slice(0, 10);

    // Transform assessments
    const recentAssessments = assessments.map(assessment => ({
      _id: assessment._id.toString(),
      title: assessment.title || `${assessment.subject || 'General'} Assessment - Grade ${assessment.grade || 'All'}`,
      type: assessment.questionTypes ? 
        (assessment.questionTypes.mcq ? 'quiz' : 
         assessment.questionTypes.true_false ? 'true-false' : 
         assessment.questionTypes.short_answer ? 'short-answer' : 'mixed') : 'quiz',
      subject: assessment.subject || 'General',
      grade: assessment.grade || 'All',
      questionCount: assessment.numQuestions || 0,
      status: assessment.status || 'draft',
      createdAt: safeToISOString(assessment.metadata?.createdAt),
      updatedAt: safeToISOString(assessment.metadata?.updatedAt)
    }));

    const productivityScore = Math.min(100, Math.round(
      (totalConversations * 5) + 
      (totalContentGenerated * 8) + 
      (totalAssessments * 12) + 
      (recentActivity * 2)
    ));

    // OPTIMIZED: Use aggregation for weekly activity instead of 7 separate queries
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);
    
    const weeklyActivityResults = await db.collection('teacher_conversations').aggregate([
      {
        $match: {
          $or: [
            { sessionId: { $regex: `voice_coach_${userId}_`, $options: 'i' } },
            { teacherId: { $in: [userId, userId.toString()] } }
          ],
          "metadata.updatedAt": { $gte: weekAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$metadata.updatedAt" }
          },
          activity: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]).toArray();

    // Create weeklyActivity array with all 7 days
    const weeklyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayData = weeklyActivityResults.find(d => d._id === dateStr);
      
      weeklyActivity.push({
        date: dateStr,
        activity: dayData ? dayData.activity : 0
      });
    }

    const dashboardData = {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        createdAt: safeToISOString(user.createdAt)
      },
      stats: {
        totalConversations,
        totalContentGenerated,
        totalAssessments,
        totalMediaUploads: totalImages + totalVideos,
        recentActivity,
        todayActivity,
        productivityScore,
        totalContents,
        totalPresentations,
        totalComics,
        totalImages,
        totalVideos,
        totalWebSearches
      },
      recentConversations,
      recentContent,
      recentAssessments,
      weeklyActivity
    };

    return { success: true, data: dashboardData };
  } catch (error) {
    console.error('Error fetching teacher dashboard data:', error);
    return { success: false, error: "Failed to fetch dashboard data" };
  }
});

// Remove getTeacherQuickStats since we're getting all data in one call now