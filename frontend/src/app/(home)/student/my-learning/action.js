"use server";

import { getServerSession } from "@/lib/get-session";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";
import { ACHIEVEMENT_TYPES } from "../achievements/constants";

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
      answers: item.completionData.answers || {},
      correctAnswers: item.completionData.correctAnswers || 0,
      totalQuestions: item.completionData.totalQuestions || 0,
      timeToComplete: item.completionData.timeToComplete || 0,
      feedback: item.completionData.feedback,
      evaluationResults: item.completionData.evaluationResults || {}
    } : null,
    metadata: {
      createdAt: item.metadata?.createdAt ? item.metadata.createdAt.toISOString() : null,
      updatedAt: item.metadata?.updatedAt ? item.metadata.updatedAt.toISOString() : null,
      attempts: item.metadata?.attempts || 0,
      bookmarked: item.metadata?.bookmarked || false
    }
  }));
};

// Achievement checking function
async function checkAndAwardAchievements(studentId, contentId = null, completionData = null) {
  try {
    const db = await getDbConnection();
    
    // Get student's current progress
    const progressStats = await db.collection('progress').aggregate([
      { $match: { studentId } },
      {
        $group: {
          _id: null,
          totalContent: { $sum: 1 },
          completedContent: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          totalTimeSpent: { $sum: '$progress.timeSpent' },
          totalAttempts: { $sum: '$metadata.attempts' },
          perfectScores: {
            $sum: { 
              $cond: [
                { $eq: ['$completionData.score', 100] }, 
                1, 
                0
              ] 
            }
          },
          goodScores: {
            $sum: { 
              $cond: [
                { $gte: ['$completionData.score', 80] }, 
                1, 
                0
              ] 
            }
          },
          averageScore: {
            $avg: {
              $cond: [
                { 
                  $and: [
                    { $ne: ['$completionData.score', null] },
                    { $ne: ['$completionData.score', undefined] }
                  ]
                },
                '$completionData.score',
                null
              ]
            }
          },
          feedbackCount: {
            $sum: { 
              $cond: [
                { $ne: ['$completionData.feedback', null] }, 
                1, 
                0
              ] 
            }
          },
          bookmarkedContent: {
            $sum: { 
              $cond: [
                { $eq: ['$metadata.bookmarked', true] }, 
                1, 
                0
              ] 
            }
          }
        }
      }
    ]).toArray();

    const stats = progressStats[0] || {
      totalContent: 0,
      completedContent: 0,
      totalTimeSpent: 0,
      totalAttempts: 0,
      perfectScores: 0,
      goodScores: 0,
      averageScore: 0,
      feedbackCount: 0,
      bookmarkedContent: 0
    };

    // Get existing achievements to avoid duplicates
    const existingAchievements = await db.collection('achievements')
      .find({ studentId })
      .toArray();

    const existingAchievementIds = new Set(existingAchievements.map(a => a.achievementId));

    // Check each achievement type
    const newAchievements = [];
    
    for (const achievementType of Object.values(ACHIEVEMENT_TYPES)) {
      if (existingAchievementIds.has(achievementType.id)) {
        continue; // Skip if already earned
      }

      let shouldAward = false;
      
      switch (achievementType.id) {
        // Progress-based achievements
        case 'first_lesson':
          shouldAward = stats.completedContent >= 1;
          break;
        case 'dedicated_learner':
          shouldAward = stats.completedContent >= 5;
          break;
        case 'knowledge_seeker':
          shouldAward = stats.completedContent >= 10;
          break;
        case 'learning_champion':
          shouldAward = stats.completedContent >= 25;
          break;
        case 'learning_master':
          shouldAward = stats.completedContent >= 50;
          break;
        
        // Time-based achievements
        case 'time_investor':
          shouldAward = stats.totalTimeSpent >= 300; // 5 hours in minutes
          break;
        case 'time_master':
          shouldAward = stats.totalTimeSpent >= 1500; // 25 hours in minutes
          break;
        case 'time_legend':
          shouldAward = stats.totalTimeSpent >= 6000; // 100 hours in minutes
          break;
        
        // Performance-based achievements
        case 'perfectionist':
          shouldAward = stats.perfectScores >= 1;
          break;
        case 'high_achiever':
          shouldAward = stats.averageScore >= 90;
          break;
        case 'consistent_performer':
          shouldAward = stats.goodScores >= 10;
          break;
        
        // Subject-specific achievements (simplified for now)
        case 'math_whiz':
          shouldAward = stats.completedContent >= 5;
          break;
        case 'science_explorer':
          shouldAward = stats.completedContent >= 5;
          break;
        case 'language_artist':
          shouldAward = stats.completedContent >= 5;
          break;
        
        // Streak achievements (simplified for now)
        case 'daily_learner':
          shouldAward = stats.completedContent >= 7;
          break;
        case 'weekly_warrior':
          shouldAward = stats.completedContent >= 30;
          break;
        
        // Special achievements
        case 'feedback_giver':
          shouldAward = stats.feedbackCount >= 5;
          break;
        case 'bookmark_collector':
          shouldAward = stats.bookmarkedContent >= 10;
          break;
        case 'early_bird':
          shouldAward = stats.completedContent >= 1;
          break;
        
        default:
          shouldAward = false;
      }

      if (shouldAward) {
        newAchievements.push({
          studentId,
          achievementId: achievementType.id,
          title: achievementType.name,
          description: achievementType.description,
          icon: achievementType.icon,
          color: achievementType.color,
          category: achievementType.category,
          points: achievementType.points,
          earnedAt: new Date(),
          metadata: {
            awardedFor: achievementType.id,
            awardedAt: new Date(),
            contentId: contentId ? new ObjectId(contentId) : null
          }
        });
      }
    }

    if (newAchievements.length > 0) {
      await db.collection('achievements').insertMany(newAchievements);
    }

    return { success: true, newAchievements: newAchievements.length };
  } catch (error) {
    console.error('Error checking and awarding achievements:', error);
    return { success: false, error: error.message };
  }
}

// Get all student progress records with optimized query
export async function getStudentProgress() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const db = await getDbConnection();
    
    // Use the correct collection name 'progress' as used in learning-library
    const progressItems = await db.collection('progress')
      .find(
        { studentId: new ObjectId(session.user.id) },
        {
          projection: {
            _id: 1,
            studentId: 1,
            contentId: 1,
            contentType: 1,
            contentTitle: 1,
            subject: 1,
            grade: 1,
            status: 1,
            progress: 1,
            completionData: 1,
            metadata: 1
          }
        }
      )
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

// Get specific progress record with optimized query
export async function getProgressById(contentId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const db = await getDbConnection();
    
    const progressItem = await db.collection('progress')
      .findOne(
        { 
          studentId: new ObjectId(session.user.id),
          contentId: new ObjectId(contentId)
        },
        {
          projection: {
            _id: 1,
            studentId: 1,
            contentId: 1,
            contentType: 1,
            contentTitle: 1,
            subject: 1,
            grade: 1,
            status: 1,
            progress: 1,
            completionData: 1,
            metadata: 1
          }
        }
      );

    return { 
      success: true, 
      data: progressItem ? serializeProgressData([progressItem])[0] : null 
    };
  } catch (error) {
    console.error('Error fetching progress by ID:', error);
    return { success: false, error: error.message };
  }
}

// Update progress record with optimized upsert and achievement checking
export async function updateProgress(progressData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const db = await getDbConnection();
    
    const { contentId, ...updateData } = progressData;
    const now = new Date();
    
    const result = await db.collection('progress').findOneAndUpdate(
      {
        studentId: new ObjectId(session.user.id),
        contentId: new ObjectId(contentId)
      },
      {
        $set: {
          ...updateData,
          'metadata.updatedAt': now
        },
        $setOnInsert: {
          'metadata.createdAt': now,
          'metadata.attempts': 1,
          'metadata.bookmarked': false
        }
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    // Check achievements after progress update
    await checkAndAwardAchievements(new ObjectId(session.user.id), contentId, updateData);

    return { success: true, data: result };
  } catch (error) {
    console.error('Error updating progress:', error);
    return { success: false, error: error.message };
  }
}

// Add feedback to completed content with validation and achievement checking
export async function addFeedback(contentId, feedback) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    if (!feedback || feedback.trim().length === 0) {
      throw new Error('Feedback cannot be empty');
    }

    const db = await getDbConnection();
    
    const result = await db.collection('progress').findOneAndUpdate(
      {
        studentId: new ObjectId(session.user.id),
        contentId: new ObjectId(contentId),
        status: 'completed'
      },
      {
        $set: {
          'completionData.feedback': feedback.trim(),
          'metadata.updatedAt': new Date()
        }
      },
      {
        returnDocument: 'after'
      }
    );

    if (!result) {
      throw new Error('Progress record not found or content not completed');
    }

    // Check achievements after adding feedback
    await checkAndAwardAchievements(new ObjectId(session.user.id), contentId, { feedback: feedback.trim() });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error adding feedback:', error);
    return { success: false, error: error.message };
  }
}

// Update feedback with validation and achievement checking
export async function updateFeedback(feedbackId, feedback) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    if (!feedback || feedback.trim().length === 0) {
      throw new Error('Feedback cannot be empty');
    }

    const db = await getDbConnection();
    
    const result = await db.collection('progress').findOneAndUpdate(
      {
        studentId: new ObjectId(session.user.id),
        contentId: new ObjectId(feedbackId),
        status: 'completed'
      },
      {
        $set: {
          'completionData.feedback': feedback.trim(),
          'metadata.updatedAt': new Date()
        }
      },
      {
        returnDocument: 'after'
      }
    );

    if (!result) {
      throw new Error('Progress record not found or content not completed');
    }

    // Check achievements after updating feedback
    await checkAndAwardAchievements(new ObjectId(session.user.id), feedbackId, { feedback: feedback.trim() });

    return { success: true, data: result };
  } catch (error) {
    console.error('Error updating feedback:', error);
    return { success: false, error: error.message };
  }
}

// Delete feedback with optimized query
export async function deleteFeedback(contentId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const db = await getDbConnection();
    
    const result = await db.collection('progress').findOneAndUpdate(
      {
        studentId: new ObjectId(session.user.id),
        contentId: new ObjectId(contentId)
      },
      {
        $unset: {
          'completionData.feedback': ""
        },
        $set: {
          'metadata.updatedAt': new Date()
        }
      },
      {
        returnDocument: 'after'
      }
    );

    if (!result) {
      throw new Error('Progress record not found');
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return { success: false, error: error.message };
  }
}

// Bookmark content with optimized single query and achievement checking
export async function toggleBookmark(contentId) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const db = await getDbConnection();
    const now = new Date();
    
    // Use a single atomic operation to toggle bookmark status
    const result = await db.collection('progress').findOneAndUpdate(
      {
        studentId: new ObjectId(session.user.id),
        contentId: new ObjectId(contentId)
      },
      [
        {
          $set: {
            'metadata.bookmarked': {
              $not: { $ifNull: ['$metadata.bookmarked', false] }
            },
            'metadata.updatedAt': now,
            'metadata.createdAt': {
              $cond: {
                if: { $ne: ['$metadata.createdAt', null] },
                then: '$metadata.createdAt',
                else: now
              }
            },
            'metadata.attempts': {
              $cond: {
                if: { $ne: ['$metadata.attempts', null] },
                then: '$metadata.attempts',
                else: 1
              }
            }
          }
        }
      ],
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    const newBookmarkStatus = result?.metadata?.bookmarked || false;

    // Check achievements after bookmarking
    await checkAndAwardAchievements(new ObjectId(session.user.id), contentId, { bookmarked: newBookmarkStatus });

    return { 
      success: true, 
      data: result, 
      bookmarked: newBookmarkStatus 
    };
  } catch (error) {
    console.error('Error toggling bookmark:', error);
    return { success: false, error: error.message };
  }
}

// Get progress statistics with optimized aggregation
export async function getProgressStats() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const db = await getDbConnection();
    
    const stats = await db.collection('progress').aggregate([
      { 
        $match: { 
          studentId: new ObjectId(session.user.id) 
        } 
      },
      {
        $group: {
          _id: null,
          totalContent: { $sum: 1 },
          completedContent: {
            $sum: { 
              $cond: [
                { $eq: ['$status', 'completed'] }, 
                1, 
                0
              ] 
            }
          },
          inProgressContent: {
            $sum: { 
              $cond: [
                { $eq: ['$status', 'in_progress'] }, 
                1, 
                0
              ] 
            }
          },
          totalTimeSpent: { 
            $sum: { 
              $ifNull: ['$progress.timeSpent', 0] 
            } 
          },
          averageScore: {
            $avg: {
              $cond: [
                { 
                  $and: [
                    { $ne: ['$completionData.score', null] },
                    { $ne: ['$completionData.score', undefined] }
                  ]
                },
                '$completionData.score',
                null
              ]
            }
          },
          bookmarkedContent: {
            $sum: { 
              $cond: [
                { $eq: ['$metadata.bookmarked', true] }, 
                1, 
                0
              ] 
            }
          },
          totalAttempts: {
            $sum: { 
              $ifNull: ['$metadata.attempts', 1] 
            }
          }
        }
      }
    ]).toArray();

    const defaultStats = {
      totalContent: 0,
      completedContent: 0,
      inProgressContent: 0,
      totalTimeSpent: 0,
      averageScore: 0,
      bookmarkedContent: 0,
      totalAttempts: 0
    };

    return { 
      success: true, 
      data: stats[0] || defaultStats
    };
  } catch (error) {
    console.error('Error fetching progress stats:', error);
    return { success: false, error: error.message };
  }
}

// Batch operations for better performance with achievement checking
export async function batchUpdateProgress(progressUpdates) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const db = await getDbConnection();
    const now = new Date();
    
    const bulkOps = progressUpdates.map(update => ({
      updateOne: {
        filter: {
          studentId: new ObjectId(session.user.id),
          contentId: new ObjectId(update.contentId)
        },
        update: {
          $set: {
            ...update.data,
            'metadata.updatedAt': now
          },
          $setOnInsert: {
            'metadata.createdAt': now,
            'metadata.attempts': 1,
            'metadata.bookmarked': false
          }
        },
        upsert: true
      }
    }));

    const result = await db.collection('progress').bulkWrite(bulkOps);
    
    // Check achievements after batch update
    await checkAndAwardAchievements(new ObjectId(session.user.id));
    
    return { 
      success: true, 
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount
      }
    };
  } catch (error) {
    console.error('Error batch updating progress:', error);
    return { success: false, error: error.message };
  }
}

// Get progress with pagination for large datasets
export async function getStudentProgressPaginated(page = 1, limit = 20, status = null) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const db = await getDbConnection();
    
    const matchQuery = { studentId: new ObjectId(session.user.id) };
    if (status) {
      matchQuery.status = status;
    }

    const skip = (page - 1) * limit;
    
    const [progressItems, totalCount] = await Promise.all([
      db.collection('progress')
        .find(matchQuery, {
          projection: {
            _id: 1,
            studentId: 1,
            contentId: 1,
            contentType: 1,
            contentTitle: 1,
            subject: 1,
            grade: 1,
            status: 1,
            progress: 1,
            completionData: 1,
            metadata: 1
          }
        })
        .sort({ 'metadata.updatedAt': -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('progress').countDocuments(matchQuery)
    ]);

    return { 
      success: true, 
      data: {
        items: serializeProgressData(progressItems),
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
          hasNext: page * limit < totalCount,
          hasPrev: page > 1
        }
      }
    };
  } catch (error) {
    console.error('Error fetching paginated progress:', error);
    return { success: false, error: error.message };
  }
}

// Create or update progress record with proper schema matching your data and achievement checking
export async function createOrUpdateProgress(progressData) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const db = await getDbConnection();
    const now = new Date();
    
    // Ensure all required fields are present according to your actual schema
    const completeProgressData = {
      studentId: new ObjectId(session.user.id),
      contentId: new ObjectId(progressData.contentId),
      contentType: progressData.contentType || 'content',
      contentTitle: progressData.contentTitle || 'Untitled',
      subject: progressData.subject || 'General',
      grade: progressData.grade || 'All',
      status: progressData.status || 'not_started',
      progress: {
        currentStep: progressData.progress?.currentStep || 0,
        totalSteps: progressData.progress?.totalSteps || 1,
        percentage: progressData.progress?.percentage || 0,
        timeSpent: progressData.progress?.timeSpent || 0,
        lastAccessedAt: progressData.progress?.lastAccessedAt || now
      },
      completionData: progressData.completionData || null,
      metadata: {
        createdAt: now,
        updatedAt: now,
        attempts: progressData.metadata?.attempts || 1,
        bookmarked: progressData.metadata?.bookmarked || false
      }
    };

    const result = await db.collection('progress').findOneAndUpdate(
      {
        studentId: new ObjectId(session.user.id),
        contentId: new ObjectId(progressData.contentId)
      },
      {
        $set: completeProgressData
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    // Check achievements after creating/updating progress
    await checkAndAwardAchievements(new ObjectId(session.user.id), progressData.contentId, progressData);

    return { success: true, data: result };
  } catch (error) {
    console.error('Error creating/updating progress:', error);
    return { success: false, error: error.message };
  }
}

// Manual achievement checking function for external use
export async function checkAchievements() {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      throw new Error('Unauthorized');
    }

    const result = await checkAndAwardAchievements(new ObjectId(session.user.id));
    return result;
  } catch (error) {
    console.error('Error checking achievements:', error);
    return { success: false, error: error.message };
  }
}
