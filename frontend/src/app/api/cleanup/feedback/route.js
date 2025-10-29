import { NextResponse } from "next/server";
import { cleanupExpiredFeedback, getFeedbackStats } from "@/lib/cleanup-feedback";

export async function POST() {
  try {
    console.log("Manual feedback cleanup triggered");
    const result = await cleanupExpiredFeedback();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Cleanup completed successfully. Processed ${result.usersProcessed} users and cleaned ${result.totalCleaned} expired feedback items.`,
        data: result
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }
  } catch (error) {
    console.error("API cleanup error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const stats = await getFeedbackStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("API stats error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
