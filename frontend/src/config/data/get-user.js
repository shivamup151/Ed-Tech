"use server";

import { getServerSession } from "@/lib/get-session";

// Simple function to get user data from session
export async function getUser() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return { success: false, error: "Unauthorized" };
    }
    
    return { 
      success: true, 
      data: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        profilePicture: session.user.profilePicture
      }
    };
  } catch (error) {
    console.error('Error getting user:', error);
    return { success: false, error: "Failed to get user data" };
  }
}

// Simple function to get teacher user
export async function getTeacher() {
  const result = await getUser();
  if (!result.success) return result;
  
  if (result.data.role !== 'teacher') {
    return { success: false, error: "Teacher access required" };
  }
  
  return result;
}

// Simple function to get admin user
export async function getAdmin() {
  const result = await getUser();
  if (!result.success) return result;
  
  if (result.data.role !== 'admin') {
    return { success: false, error: "Admin access required" };
  }
  
  return result;
}

// Simple function to get student user
export async function getStudent() {
  const result = await getUser();
  if (!result.success) return result;
  
  if (result.data.role !== 'student') {
    return { success: false, error: "Student access required" };
  }
  
  return result;
}
