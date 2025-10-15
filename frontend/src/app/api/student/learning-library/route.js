import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/get-session';
import { connectToDatabase } from '@/lib/db';
import { ObjectId } from 'mongodb';

function normalizeGrades(userGrades) {
  const normalizedGrades = [];
  
  userGrades.forEach(grade => {
    normalizedGrades.push(grade);
    
    if (grade.startsWith('Grade ')) {
      const withoutGrade = grade.replace('Grade ', '');
      if (/^\d+$/.test(withoutGrade)) {
        normalizedGrades.push(withoutGrade);
      }
    } else if (/^\d+$/.test(grade)) {
      const withGrade = `Grade ${grade}`;
      normalizedGrades.push(withGrade);
    }
  });
  
  return [...new Set(normalizedGrades)];
}

// GET /api/student/learning-library
export async function GET(request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('user');
    const lessonsCollection = db.collection('lessons');
    const progressCollection = db.collection('progress');

    // Get user grades
    const user = await usersCollection.findOne(
      { _id: new ObjectId(session.user.id) },
      { projection: { grades: 1 } }
    );
    
    if (!user || !user.grades || user.grades.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No grade assigned. Please contact administration to add your grade.',
        lessons: []
      });
    }

    const normalizedGrades = normalizeGrades(user.grades);
    const studentId = new ObjectId(session.user.id);

    // Get lessons with optimized projection
    const lessons = await lessonsCollection
      .find(
        { 
          grade: { $in: normalizedGrades },
          status: 'published'
        },
        {
          projection: {
            _id: 1,
            title: 1,
            subject: 1,
            grade: 1,
            topic: 1,
            lessonDescription: 1,
            description: 1,
            contentType: 1,
            assessmentId: 1,
            assessmentContent: 1,
            generatedContent: 1,
            contentData: 1,
            content: 1,
            difficulty: 1,
            language: 1,
            duration: 1,
            'metadata.createdAt': 1,
            'metadata.updatedAt': 1,
            'metadata.viewCount': 1,
            status: 1,
            teacherId: 1,
            userId: 1,
            
            // Content type specific fields
            imageUrls: 1,
            images: 1,
            imageUrl: 1,
            videoUrl: 1,
            presentationUrl: 1,
            slideImages: 1,
            slidesCount: 1,
            slideCount: 1,
            thumbnailUrl: 1,
            panels: 1,
            numPanels: 1,
            comicType: 1,
            instruction: 1,
            imageBase64: 1,
            visualType: 1,
            instructions: 1,
            difficultyFlag: 1,
            cloudinaryPublicId: 1,
            cloudinaryPublicIds: 1,
            panelTexts: 1,  // ADD THIS LINE - This was missing!
            template: 1,
            verbosity: 1,
            includeImages: 1,
            downloadUrl: 1,
            taskId: 1,
            taskStatus: 1,
            voiceName: 1,
            talkingPhotoName: 1,
            videoId: 1,
            voiceId: 1,
            talkingPhotoId: 1,
            searchResults: 1,
            searchQuery: 1
          }
        }
      )
      .sort({ 'metadata.createdAt': -1 })
      .limit(100)
      .toArray();

    // Get progress data in parallel
    const contentIds = lessons.map(lesson => lesson._id);
    const progressRecords = contentIds.length > 0 ? await progressCollection
      .find(
        { 
          studentId: studentId,
          contentId: { $in: contentIds }
        },
        {
          projection: {
            contentId: 1,
            status: 1,
            'progress.currentStep': 1,
            'progress.totalSteps': 1,
            'progress.percentage': 1,
            'progress.timeSpent': 1,
            'progress.lastAccessedAt': 1,
            'completionData.completedAt': 1,
            'completionData.score': 1,
            'completionData.answers': 1,
            'completionData.correctAnswers': 1,
            'completionData.totalQuestions': 1,
            'completionData.evaluationResults': 1,
            'metadata.attempts': 1,
            'metadata.bookmarked': 1
          }
        }
      )
      .toArray() : [];

    // Create progress map
    const progressMap = {};
    progressRecords.forEach(progress => {
      progressMap[progress.contentId.toString()] = progress;
    });

    // Transform lessons efficiently
    const transformedLessons = lessons.map(lesson => {
      const progress = progressMap[lesson._id.toString()];
      
      // Proper resource type determination
      let resourceType = 'content'; // default
      
      if (lesson.contentType) {
        // Use the actual contentType from the database
        resourceType = lesson.contentType;
      } else if (lesson.assessmentId || lesson.assessmentContent) {
        // Only if it has assessment-specific fields
        resourceType = 'assessment';
      } else if (lesson.imageUrls && lesson.imageUrls.length > 0) {
        resourceType = 'comic';
      } else if (lesson.imageUrl) {
        resourceType = 'image';
      } else if (lesson.videoUrl) {
        resourceType = 'video';
      } else if (lesson.presentationUrl) {
        resourceType = 'slides';
      }

      return {
        _id: lesson._id.toString(),
        resourceId: lesson._id.toString(),
        teacherId: lesson.teacherId?.toString() || lesson.userId?.toString(),
        title: lesson.title,
        subject: lesson.subject,
        grade: lesson.grade,
        topic: lesson.topic,
        description: lesson.lessonDescription || lesson.description,
        content: lesson.generatedContent || lesson.contentData || lesson.assessmentContent || lesson.content || '',
        resourceType: resourceType,
        difficulty: lesson.difficulty,
        language: lesson.language,
        estimatedTimeMinutes: lesson.duration || 30,
        rating: 4.5,
        views: lesson.metadata?.viewCount || 0,
        likes: 0,
        metadata: {
          createdAt: lesson.metadata?.createdAt?.toISOString?.() || lesson.metadata?.createdAt,
          updatedAt: lesson.metadata?.updatedAt?.toISOString?.() || lesson.metadata?.updatedAt
        },
        status: lesson.status,
        progress: progress ? {
          currentStep: progress.progress?.currentStep || 0,
          totalSteps: progress.progress?.totalSteps || 1,
          percentage: progress.progress?.percentage || 0,
          timeSpent: progress.progress?.timeSpent || 0,
          lastAccessedAt: progress.progress?.lastAccessedAt?.toISOString?.() || progress.progress?.lastAccessedAt,
          status: progress.status,
          completedAt: progress.completionData?.completedAt?.toISOString?.() || progress.completionData?.completedAt,
          score: progress.completionData?.score,
          attempts: progress.metadata?.attempts || 0,
          bookmarked: progress.metadata?.bookmarked || false,
          // Include the complete completionData object
          completionData: progress.completionData ? {
            completedAt: progress.completionData.completedAt?.toISOString?.() || progress.completionData.completedAt,
            score: progress.completionData.score,
            answers: progress.completionData.answers,
            correctAnswers: progress.completionData.correctAnswers,
            totalQuestions: progress.completionData.totalQuestions,
            timeToComplete: progress.completionData.timeToComplete,
            feedback: progress.completionData.feedback,
            evaluationResults: progress.completionData.evaluationResults
          } : null
        } : null,
        
        // Content type specific fields
        panels: lesson.panels,
        imageUrls: lesson.imageUrls,
        images: lesson.images,
        cloudinaryPublicIds: lesson.cloudinaryPublicIds,
        numPanels: lesson.numPanels,
        comicType: lesson.comicType,
        instruction: lesson.instruction,
        panelTexts: lesson.panelTexts,  // ADD THIS LINE - This was missing!
        imageUrl: lesson.imageUrl,
        imageBase64: lesson.imageBase64,
        visualType: lesson.visualType,
        instructions: lesson.instructions,
        difficultyFlag: lesson.difficultyFlag,
        cloudinaryPublicId: lesson.cloudinaryPublicId,
        presentationUrl: lesson.presentationUrl,
        slideImages: lesson.slideImages,
        slidesCount: lesson.slidesCount || lesson.slideCount,
        slideCount: lesson.slideCount,
        template: lesson.template,
        verbosity: lesson.verbosity,
        includeImages: lesson.includeImages,
        downloadUrl: lesson.downloadUrl,
        taskId: lesson.taskId,
        taskStatus: lesson.taskStatus,
        videoUrl: lesson.videoUrl,
        thumbnailUrl: lesson.thumbnailUrl,
        voiceName: lesson.voiceName,
        talkingPhotoName: lesson.talkingPhotoName,
        videoId: lesson.videoId,
        voiceId: lesson.voiceId,
        talkingPhotoId: lesson.talkingPhotoId,
        assessmentContent: lesson.assessmentContent,
        assessmentId: lesson.assessmentId,
        searchResults: lesson.searchResults,
        searchQuery: lesson.searchQuery
      };
    });

    return NextResponse.json({
      success: true,
      lessons: transformedLessons
    });

  } catch (error) {
    console.error('Error fetching learning library content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch content' },
      { status: 500 }
    );
  }
}

