import { connectToDatabase } from './db';
import { ObjectId } from 'mongodb';

export async function cleanupExpiredFeedback() {
  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    
    console.log(`Starting feedback cleanup at ${now.toISOString()}`);
    
    // Find all users with feedback that might have expired items
    const users = await db.collection('user').find({
      "feedback": { $exists: true, $ne: [] }
    }).toArray();
    
    let totalCleaned = 0;
    let usersProcessed = 0;
    
    for (const user of users) {
      if (!user.feedback || !Array.isArray(user.feedback)) {
        continue;
      }
      
      const originalCount = user.feedback.length;
      const activeFeedback = user.feedback.filter(fb => {
        // Keep feedback that is less than 3 days old
        const feedbackDate = new Date(fb.createdAt);
        const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
        return feedbackDate > threeDaysAgo;
      });
      
      const expiredCount = originalCount - activeFeedback.length;
      
      if (expiredCount > 0) {
        await db.collection('user').updateOne(
          { _id: user._id },
          { 
            $set: { 
              feedback: activeFeedback,
              updatedAt: new Date()
            }
          }
        );
        
        totalCleaned += expiredCount;
        console.log(`Cleaned up ${expiredCount} expired feedback items for user ${user._id} (${user.name || user.email})`);
      }
      
      usersProcessed++;
    }
    
    console.log(`Feedback cleanup completed. Processed ${usersProcessed} users, cleaned ${totalCleaned} expired feedback items.`);
    
    return { 
      success: true, 
      usersProcessed, 
      totalCleaned,
      timestamp: now.toISOString()
    };
  } catch (error) {
    console.error('Error cleaning up feedback:', error);
    return { 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Function to get feedback statistics
export async function getFeedbackStats() {
  try {
    const { db } = await connectToDatabase();
    const now = new Date();
    
    const users = await db.collection('user').find({
      "feedback": { $exists: true, $ne: [] }
    }).toArray();
    
    let totalFeedback = 0;
    let expiredFeedback = 0;
    let activeFeedback = 0;
    
    for (const user of users) {
      if (!user.feedback || !Array.isArray(user.feedback)) {
        continue;
      }
      
      totalFeedback += user.feedback.length;
      
      user.feedback.forEach(fb => {
        const feedbackDate = new Date(fb.createdAt);
        const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
        if (feedbackDate > threeDaysAgo) {
          activeFeedback++;
        } else {
          expiredFeedback++;
        }
      });
    }
    
    return {
      success: true,
      stats: {
        totalUsers: users.length,
        totalFeedback,
        activeFeedback,
        expiredFeedback,
        timestamp: now.toISOString()
      }
    };
  } catch (error) {
    console.error('Error getting feedback stats:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}
