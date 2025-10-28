"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  TrendingUp, 
  Calendar, 
  Target,
  Search,
  Filter,
  Edit3,
  Save,
  X,
  UserCheck,
  UserX,
  Award,
  AlertCircle,
  BookOpen,
  BarChart3,
  PieChart,
  Activity,
  MessageSquare, // NEW: Add this icon
  Plus, // NEW: Add this icon
} from "lucide-react";
import { toast } from "sonner";
import { getStudents, updateStudentGroup, updateStudentNotes, getClassStatistics, addStudentFeedback, getStudentFeedback, deleteStudentFeedback, getStudentLearningFeedback } from "./action"; // NEW: Import feedback functions
import { authClient } from "@/lib/auth-client";
import Loading from "./loading";

export default function ClassGroupingPage() {
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState(null); // NEW: For feedback dialog
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false); // NEW: For feedback dialog
  const [feedbackFormData, setFeedbackFormData] = useState({ // NEW: Feedback form data
    message: '',
    topics: [],
    focusAreas: [],
    strengths: [],
    improvements: [],
    priority: 'medium'
  });
  const [studentLearningFeedback, setStudentLearningFeedback] = useState([]); // NEW: Student learning feedback

  // Get user session
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data } = await authClient.getSession();
        setUser(data?.user || null);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };
    getUser();
  }, []);

  // Load students and statistics
  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user?.id]);

  // Filter students based on search, grade, and group
  useEffect(() => {
    let filtered = students;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(student => 
        student.name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query)
      );
    }

    // Filter by grade
    if (selectedGrade !== "all") {
      filtered = filtered.filter(student => 
        student.grades && student.grades.includes(selectedGrade)
      );
    }

    // Filter by group
    if (selectedGroup !== "all") {
      filtered = filtered.filter(student => student.group === selectedGroup);
    }

    setFilteredStudents(filtered);
  }, [students, searchQuery, selectedGrade, selectedGroup]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentsResult, statsResult] = await Promise.all([
        getStudents(),
        getClassStatistics()
      ]);

      if (studentsResult.success) {
        setStudents(studentsResult.students);
      } else {
        toast.error(studentsResult.error || "Failed to load students");
      }

      if (statsResult.success) {
        setStatistics(statsResult.statistics);
      } else {
        toast.error(statsResult.error || "Failed to load statistics");
      }

      // Load student learning feedback
      await loadStudentLearningFeedback();
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleGroupChange = async (studentId, newGroup) => {
    try {
      const result = await updateStudentGroup(studentId, newGroup);
      if (result.success) {
        setStudents(prev => prev.map(student => 
          student._id === studentId ? { ...student, group: newGroup } : student
        ));
        toast.success("Student group updated successfully");
      } else {
        toast.error(result.error || "Failed to update group");
      }
    } catch (error) {
      console.error("Error updating group:", error);
      toast.error("Failed to update group");
    }
  };

  const getPerformanceColor = (score) => {
    if (score >= 90) return "text-green-600 bg-green-100";
    if (score >= 80) return "text-blue-600 bg-blue-100";
    if (score >= 70) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  const getPerformanceIcon = (score) => {
    if (score >= 90) return <Award className="h-4 w-4" />;
    if (score >= 80) return <TrendingUp className="h-4 w-4" />;
    if (score >= 70) return <Target className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getUniqueGrades = () => {
    const allGrades = students.flatMap(student => student.grades || []);
    return [...new Set(allGrades)];
  };

  const getUniqueGroups = () => {
    return [...new Set(students.map(student => student.group))];
  };

  // NEW: Handle adding feedback
  const handleAddFeedback = async (student) => {
    setSelectedStudent(student);
    setFeedbackDialogOpen(true);
    setFeedbackFormData({
      message: '',
      topics: [],
      focusAreas: [],
      strengths: [],
      improvements: [],
      priority: 'medium'
    });
  };

  // NEW: Submit feedback
  const handleSubmitFeedback = async () => {
    if (!selectedStudent || !feedbackFormData.message.trim()) {
      toast.error("Please provide feedback message");
      return;
    }

    try {
      const result = await addStudentFeedback(selectedStudent._id, feedbackFormData);
      if (result.success) {
        toast.success("Feedback added successfully");
        setFeedbackDialogOpen(false);
        await loadData(); // Reload data to show updated feedback
      } else {
        toast.error(result.error || "Failed to add feedback");
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback");
    }
  };

  // NEW: Load student learning feedback
  const loadStudentLearningFeedback = async () => {
    try {
      // Pass null or undefined if no grade, the function will handle it
      const result = await getStudentLearningFeedback(user?.grade || null);
      if (result.success) {
        setStudentLearningFeedback(result.feedback);
      } else {
        console.error("Error loading student learning feedback:", result.error);
      }
    } catch (error) {
      console.error("Error loading student learning feedback:", error);
    }
  };

  if (loading) {
    return <Loading/>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Class Grouping & Management</h1>
        <p className="text-muted-foreground">
          Manage student groups, track performance, and organize your class effectively
        </p>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                  <p className="text-2xl font-bold">{statistics.totalStudents}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Performance</p>
                  <p className="text-2xl font-bold">{statistics.averagePerformance}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Groups</p>
                  <p className="text-2xl font-bold">{Object.keys(statistics.groupDistribution).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={selectedGrade} onValueChange={setSelectedGrade}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Grades</SelectItem>
            {getUniqueGrades().map(grade => (
              <SelectItem key={grade} value={grade}>{grade}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            {getUniqueGroups().map(group => (
              <SelectItem key={group} value={group}>{group}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            All Students
            <Badge variant="secondary">{filteredStudents.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="groups" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Groups
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Student Feedback
            <Badge variant="secondary">{studentLearningFeedback.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* All Students Tab */}
        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStudents.map((student) => (
              <Card key={student._id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {student.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{student.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{student.email}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={getPerformanceColor(student.performance.overall)}>
                      {getPerformanceIcon(student.performance.overall)}
                      {student.performance.overall}%
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Grades</p>
                      <p className="font-medium">
                        {student.grades && student.grades.length > 0 
                          ? student.grades.join(', ') 
                          : "Not Set"
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Active</p>
                      <p className="font-medium">{formatDate(student.lastActive)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Group</p>
                      <p className="font-medium">{student.group}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Performance</p>
                      <p className="font-medium">{student.performance.overall}%</p>
                    </div>
                  </div>

                  {/* NEW: Feedback Section */}
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Feedback ({student.feedback?.length || 0})
                      </p>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleAddFeedback(student)}
                        className="flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </Button>
                    </div>
                    
                    {student.feedback && student.feedback.length > 0 && (
                      <div className="max-h-24 overflow-y-auto space-y-1">
                        {student.feedback.slice(-2).reverse().map((fb, idx) => (
                          <div key={idx} className="text-xs bg-muted p-2 rounded">
                            <p className="font-medium">{new Date(fb.createdAt).toLocaleDateString()}</p>
                            <p className="text-muted-foreground truncate">{fb.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">Change Group</p>
                      <Select 
                        value={student.group} 
                        onValueChange={(value) => handleGroupChange(student._id, value)}
                      >
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Group A">A</SelectItem>
                          <SelectItem value="Group B">B</SelectItem>
                          <SelectItem value="Group C">C</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {statistics?.performanceRanges && Object.entries(statistics.performanceRanges).map(([range, count]) => (
                    <div key={range} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${
                          range === 'excellent' ? 'bg-green-500' :
                          range === 'good' ? 'bg-blue-500' :
                          range === 'average' ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        <span className="capitalize">{range.replace(/([A-Z])/g, ' $1')}</span>
                      </div>
                      <Badge variant="outline">{count} students</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle>Top Performers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredStudents
                    .sort((a, b) => b.performance.overall - a.performance.overall)
                    .slice(0, 5)
                    .map((student, index) => (
                    <div key={student._id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{student.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {student.grades && student.grades.length > 0 
                              ? student.grades.join(', ') 
                              : "No Grades"
                            }
                          </p>
                        </div>
                      </div>
                      <Badge className={getPerformanceColor(student.performance.overall)}>
                        {student.performance.overall}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {getUniqueGroups().map(group => {
              const groupStudents = filteredStudents.filter(s => s.group === group);
              const avgPerformance = groupStudents.length > 0 ? Math.round(
                groupStudents.reduce((sum, s) => sum + s.performance.overall, 0) / groupStudents.length
              ) : 0;
              
              return (
                <Card key={group}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {group}
                      <Badge variant="secondary">{groupStudents.length} students</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{avgPerformance}%</p>
                        <p className="text-sm text-muted-foreground">Average Performance</p>
                      </div>
                      
                      <div className="space-y-2">
                        {groupStudents.map(student => (
                          <div key={student._id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                                {student.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <span className="text-sm font-medium">{student.name}</span>
                            </div>
                            <Badge variant="outline" className={getPerformanceColor(student.performance.overall)}>
                              {student.performance.overall}%
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Student Feedback Tab */}
        <TabsContent value="feedback" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Student Learning Feedback</h2>
              <p className="text-sm text-muted-foreground">
                Feedback from students {user?.grade ? `in your grade (${user.grade})` : '(all students)'}
              </p>
            </div>
            
            {studentLearningFeedback.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Student Feedback Yet</h3>
                  <p className="text-muted-foreground text-center">
                    Students haven't submitted any feedback from their learning activities yet.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {studentLearningFeedback.map((feedback) => (
                  <Card key={feedback.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                            {feedback.studentName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-semibold">{feedback.studentName}</h3>
                            <p className="text-sm text-muted-foreground">{feedback.studentEmail}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {feedback.grade}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-1">Content</h4>
                        <p className="text-sm font-medium">{feedback.contentTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {feedback.contentType} • {feedback.subject}
                        </p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-1">Student Feedback</h4>
                        <p className="text-sm bg-muted p-3 rounded-lg">
                          {feedback.feedback}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {new Date(feedback.submittedAt).toLocaleDateString()}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          Learning Feedback
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grade Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Grade Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statistics?.gradeDistribution && Object.keys(statistics.gradeDistribution).length > 0 ? (
                    Object.entries(statistics.gradeDistribution).map(([grade, count]) => (
                      <div key={grade} className="flex items-center justify-between">
                        <span className="font-medium">{grade}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-muted rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${(count / statistics.totalStudents) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm text-muted-foreground w-8">{count}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No grade data available</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Performance Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statistics?.performanceRanges && Object.entries(statistics.performanceRanges).map(([range, count]) => (
                    <div key={range} className="flex items-center justify-between">
                      <span className="font-medium capitalize">{range.replace(/([A-Z])/g, ' $1')}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-muted rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              range === 'excellent' ? 'bg-green-500' :
                              range === 'good' ? 'bg-blue-500' :
                              range === 'average' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${(count / statistics.totalStudents) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-8">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* NEW: Feedback Dialog */}
      {feedbackDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Add Feedback for {selectedStudent?.name}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Feedback Message *</label>
                <textarea
                  value={feedbackFormData.message}
                  onChange={(e) => setFeedbackFormData({...feedbackFormData, message: e.target.value})}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 min-h-[100px] resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Provide detailed feedback for the student..."
                  style={{ whiteSpace: 'pre-wrap' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Focus Areas</label>
                <Input
                  value={feedbackFormData.focusAreas.join(', ')}
                  onChange={(e) => setFeedbackFormData({
                    ...feedbackFormData, 
                    focusAreas: e.target.value.split(',').filter(Boolean)
                  })}
                  placeholder="e.g., Algebra, Reading Comprehension (comma-separated)"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Strengths</label>
                <Input
                  value={feedbackFormData.strengths.join(', ')}
                  onChange={(e) => setFeedbackFormData({
                    ...feedbackFormData, 
                    strengths: e.target.value.split(',').filter(Boolean)
                  })}
                  placeholder="e.g., Problem-solving, Critical thinking (comma-separated)"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Areas for Improvement</label>
                <Input
                  value={feedbackFormData.improvements.join(', ')}
                  onChange={(e) => setFeedbackFormData({
                    ...feedbackFormData, 
                    improvements: e.target.value.split(',').filter(Boolean)
                  })}
                  placeholder="e.g., Time management, Attention to detail (comma-separated)"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Priority</label>
                <Select 
                  value={feedbackFormData.priority} 
                  onValueChange={(value) => setFeedbackFormData({...feedbackFormData, priority: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmitFeedback}>
                Submit Feedback
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}