import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { ObjectId } from "mongodb";

export async function GET(request, { params }) {
  try {
    const { studentId } = await params; // FIXED: Add await here
    
    if (!studentId) {
      return NextResponse.json(
        { success: false, error: "Student ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    
    // Create TTL index for automatic deletion if it doesn't exist
    try {
      await db.collection('user').createIndex(
        { "feedback.expiresAt": 1 },
        { 
          name: "feedback_ttl_index",
          expireAfterSeconds: 0, // MongoDB will delete documents when expiresAt field is reached
          partialFilterExpression: { 
            "feedback": { $exists: true, $ne: [] },
            "feedback.expiresAt": { $exists: true }
          }
        }
      );
    } catch (indexError) {
      // Index might already exist, continue
      console.log("TTL index creation skipped (might already exist):", indexError.message);
    }
    
    const student = await db.collection('user').findOne(
      { _id: new ObjectId(studentId) },
      { projection: { feedback: 1 } }
    );

    if (!student) {
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 }
      );
    }

    // Filter out feedback older than 3 days and create previews
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
    const activeFeedback = (student.feedback || [])
      .filter(fb => {
        const feedbackDate = new Date(fb.createdAt);
        return fb.isActive && feedbackDate > threeDaysAgo;
      })
      .map(fb => {
        // Create preview (2-3 sentences)
        const sentences = fb.message.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const preview = sentences.slice(0, 2).join('. ').trim();
        const finalPreview = preview.endsWith('.') ? preview : preview + '.';
        
        return {
          ...fb,
          preview: finalPreview
        };
      });

    // Clean up expired feedback from database
    if (activeFeedback.length !== (student.feedback || []).length) {
      await db.collection('user').updateOne(
        { _id: new ObjectId(studentId) },
        { 
          $set: { feedback: activeFeedback },
          $set: { updatedAt: new Date() }
        }
      );
    }

    return NextResponse.json({
      success: true,
      feedback: activeFeedback
    });
  } catch (error) {
    console.error("Error fetching student feedback:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}
