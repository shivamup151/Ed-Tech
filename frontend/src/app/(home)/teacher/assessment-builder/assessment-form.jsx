'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, Edit, FileText, Eye, Clock, BookOpen, Save, RefreshCcw, BookmarkPlus } from 'lucide-react';
import { generateAssessment, deleteAssessment, getAssessments, updateAssessment, getUserAssignedGradesAndSubjects, addAssessmentToLesson } from './action';
import AssessmentPreview from '@/components/assessment-preview';
import { grade , subject , language } from '@/config/data';   

const AssessmentForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [assessments, setAssessments] = useState([]);   
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [questionTypes, setQuestionTypes] = useState({
    mcq: false,
    true_false: false,
    short_answer: false
  });
  const [questionDistribution, setQuestionDistribution] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [previewAssessment, setPreviewAssessment] = useState(null);
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [activeTab, setActiveTab] = useState("create");
  const [userGrades, setUserGrades] = useState([]);
  const [userSubjects, setUserSubjects] = useState([]);
  const [loadingUserData, setLoadingUserData] = useState(true);
  const [addToLessonDialog, setAddToLessonDialog] = useState(false);
  const [selectedAssessmentForLesson, setSelectedAssessmentForLesson] = useState(null);
  const [isAddingToLesson, setIsAddingToLesson] = useState(false);
  const [lessonFormData, setLessonFormData] = useState({
    title: '',
    lessonDescription: '',
    learningObjectives: '',
    isPublic: false
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset
  } = useForm({
    defaultValues: {
      title: '',
      subject: '',
      grade: '',
      topic: '',
      duration: 30,
      difficulty: 'Medium',
      language: 'English',
      learningObjectives: '',
      anxietyTriggers: '',
      customPrompt: ''
    }
  });

  // Load assessments on component mount
  useEffect(() => {
    loadAssessments();
  }, []);

  // Fetch user's assigned grades and subjects
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoadingUserData(true);
        const result = await getUserAssignedGradesAndSubjects();
        
        if (result.success) {
          setUserGrades(result.grades);
          setUserSubjects(result.subjects);
        } else {
          toast.error(result.error || "Failed to load user data");
        }
      } catch (error) {
        toast.error("Failed to load user data");
        console.error(error);
      } finally {
        setLoadingUserData(false);
      }
    };

    fetchUserData();
  }, []);

  const loadAssessments = async () => {
    try {
      setLoadingAssessments(true);
      const fetchedAssessments = await getAssessments();
      setAssessments(fetchedAssessments);
    } catch (error) {
      console.error('Error loading assessments:', error);
    } finally {
      setLoadingAssessments(false);
    }
  };

  // Update question distribution when question types change
  useEffect(() => {
    const selectedTypes = Object.keys(questionTypes).filter(type => questionTypes[type]);
    if (selectedTypes.length > 0) {
      const distribution = distributeQuestions(selectedTypes);
      setQuestionDistribution(distribution);
    }
  }, [questionTypes]);

  const distributeQuestions = (types) => {
    if (types.length === 1) {
      return { [types[0]]: 5 }; // Default 5 questions per type
    }

    const distribution = {};
    const questionsPerType = Math.floor(10 / types.length); // Default 10 total questions
    const remainder = 10 % types.length;

    types.forEach((type, index) => {
      distribution[type] = questionsPerType + (index < remainder ? 1 : 0);
    });

    return distribution;
  };

  const handleQuestionTypeChange = (type, checked) => {
    setQuestionTypes(prev => ({
      ...prev,
      [type]: checked
    }));
  };

  const handleQuestionDistributionChange = (type, value) => {
    const numValue = parseInt(value) || 0;
    setQuestionDistribution(prev => ({
      ...prev,
      [type]: numValue
    }));
  };

  const onSubmit = async (data) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const selectedTypes = Object.keys(questionTypes).filter(type => questionTypes[type]);
      
      if (selectedTypes.length === 0) {
        throw new Error('Please select at least one question type');
      }

      const assessmentData = {
        ...data,
        questionTypes,
        questionDistribution
      };

      const result = await generateAssessment(assessmentData);
      setSuccess('Assessment generated successfully! Click Save to store it in your database.');
      
      // Set the generated assessment for preview
      setSelectedAssessment(result.assessment);
      
      // Reset form after successful generation
      reset();
      setQuestionTypes({ mcq: false, true_false: false, short_answer: false });
      setQuestionDistribution({});
      
    } catch (err) {
      setError(err.message || 'An error occurred while processing the assessment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (assessment) => {
    setEditingAssessment(assessment);
    setActiveTab("create"); // Switch to the create tab
    
    reset({
      title: assessment.title || '',
      subject: assessment.subject || '',
      grade: assessment.grade || '',
      topic: assessment.topic || '',
      duration: assessment.duration || 30,
      difficulty: assessment.difficulty || 'Medium',
      language: assessment.language || 'English',
      learningObjectives: assessment.learningObjectives || '',
      anxietyTriggers: assessment.anxietyTriggers || '',
      customPrompt: assessment.customPrompt || ''
    });

    if (assessment.questionTypes) {
      setQuestionTypes(assessment.questionTypes);
    }

    if (assessment.questionDistribution) {
      setQuestionDistribution(assessment.questionDistribution);
    }

    setSelectedAssessment(assessment);
  };

  const cancelEdit = () => {
    setEditingAssessment(null);
    setSelectedAssessment(null);
    reset();
    setQuestionTypes({ mcq: false, true_false: false, short_answer: false });
    setQuestionDistribution({});
  };

  const saveEditedAssessment = async () => {
    if (!editingAssessment) {
      setError('No assessment to save');
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateAssessment(editingAssessment.id, {
        ...editingAssessment,
        regenerate: false
      });

      if (result.success) {
        setSuccess('Assessment updated successfully!');
        setEditingAssessment(null);
        setSelectedAssessment(null);
        setActiveTab("saved");
        await loadAssessments();
      } else {
        setError('Failed to update assessment');
      }
    } catch (error) {
      console.error('Error updating assessment:', error);
      setError('Failed to update assessment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (assessmentId) => {
    if (!confirm('Are you sure you want to delete this assessment?')) return;
    
    try {
      setIsLoading(true);
      await deleteAssessment(assessmentId);
      setAssessments(prev => prev.filter(a => a.id !== assessmentId));
      if (selectedAssessment?.id === assessmentId) {
        setSelectedAssessment(null);
      }
      setSuccess('Assessment deleted successfully!');
    } catch (error) {
      console.error('Error deleting assessment:', error);
      setError('Failed to delete assessment. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (assessment) => {
    setSelectedAssessment(assessment);
  };

  const handleSaveAssessment = async () => {
    if (!selectedAssessment) {
      setError('No assessment to save');
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateAssessment(selectedAssessment.id, selectedAssessment);

      if (result.success) {
        setSuccess('Assessment saved successfully!');
        // Reload assessments and clear the preview
        await loadAssessments();
        setSelectedAssessment(null);
      } else {
        setError('Failed to save assessment');
      }
    } catch (error) {
      console.error('Error saving assessment:', error);
      setError('Failed to save assessment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'generated': return 'bg-blue-100 text-blue-800';
      case 'published': return 'bg-green-100 text-green-800';
      case 'archived': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const selectedTypes = Object.keys(questionTypes).filter(type => questionTypes[type]);

  const previewAssessmentHandler = (assessment) => {
    setPreviewAssessment(assessment);
  };

  const closePreview = () => {
    setPreviewAssessment(null);
  };

  const handleAddToLesson = async (assessment) => {
    setSelectedAssessmentForLesson(assessment);
    setLessonFormData({
      title: `${assessment.title} - Lesson`,
      lessonDescription: `Lesson based on assessment: ${assessment.title}`,
      learningObjectives: assessment.learningObjectives || '',
      isPublic: false
    });
    setAddToLessonDialog(true);
  };

  const handleSubmitAddToLesson = async () => {
    if (!selectedAssessmentForLesson) return;

    setIsAddingToLesson(true);
    try {
      const result = await addAssessmentToLesson(selectedAssessmentForLesson.id, lessonFormData);
      if (result.success) {
        setSuccess('Assessment added to lesson successfully!');
        setAddToLessonDialog(false);
        setSelectedAssessmentForLesson(null);
        setLessonFormData({
          title: '',
          lessonDescription: '',
          learningObjectives: '',
          isPublic: false
        });
      } else {
        setError('Failed to add assessment to lesson');
      }
    } catch (error) {
      console.error('Error adding to lesson:', error);
      setError('Failed to add assessment to lesson');
    } finally {
      setIsAddingToLesson(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Assessment Builder</h1>
        <p className="text-gray-600 mt-2">
          Create, manage, and generate AI-powered assessments for your students
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Create Assessment</TabsTrigger>
          <TabsTrigger value="saved">Saved Assessments</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6">
          {editingAssessment ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Edit className="h-5 w-5" />
                      Edit Assessment
                    </CardTitle>
                    <CardDescription>
                      Edit the assessment: {editingAssessment.title}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEdit}
                    className="text-red-600 hover:text-red-700"
                  >
                    Cancel Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="assessmentEditor">Assessment Content</Label>
                  <Textarea
                    id="assessmentEditor"
                    value={editingAssessment.generatedContent || ''}
                    onChange={(e) => setEditingAssessment(prev => ({
                      ...prev,
                      generatedContent: e.target.value
                    }))}
                    rows={20}
                    className="font-mono text-sm"
                    placeholder="Edit your assessment content here..."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveEditedAssessment}
                    disabled={isSaving}
                    className="min-w-[120px]"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Create New Assessment
                </CardTitle>
                <CardDescription>
                  Create a new assessment with AI-generated questions
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* Error and Success Messages */}
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  {success && (
                    <Alert>
                      <AlertDescription>{success}</AlertDescription>
                    </Alert>
                  )}

                  {/* Basic Information */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Assessment Title *</Label>
                        <Input
                          id="title"
                          {...register('title', { required: 'Title is required' })}
                          placeholder="e.g., American Revolution Quiz"
                        />
                        {errors.title && (
                          <p className="text-sm text-red-500">{errors.title.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div className="space-y-2 ">
                        <Label htmlFor="subject">Subject *</Label>
                        {loadingUserData ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span className="text-sm text-muted-foreground">Loading subjects...</span>
                          </div>
                        ) : userSubjects.length > 0 ? (
                          <Select onValueChange={(value) => setValue('subject', value)} defaultValue="math">
                            <SelectTrigger>
                              <SelectValue placeholder="Select subject " />
                            </SelectTrigger>
                            <SelectContent>
                              {userSubjects.map(subject => (
                                <SelectItem key={subject} value={subject}>
                                  {subject}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md text-center">
                            <p className="text-sm text-muted-foreground">No subjects assigned to your account</p>
                            <p className="text-xs text-muted-foreground mt-1">Contact your administrator to assign subjects</p>
                          </div>
                        )}
                        {errors.subject && (
                          <p className="text-sm text-red-500">{errors.subject.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="grade">Grade Level *</Label>
                        {loadingUserData ? (
                          <div className="flex items-center justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span className="text-sm text-muted-foreground">Loading grades...</span>
                          </div>
                        ) : userGrades.length > 0 ? (
                          <Select onValueChange={(value) => setValue('grade', value)} defaultValue="1">
                            <SelectTrigger>
                              <SelectValue placeholder="Select grade level" />
                            </SelectTrigger>
                            <SelectContent>
                              {userGrades.map(grade => (
                                <SelectItem key={grade} value={grade}>
                                  {grade}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="p-4 border border-dashed border-muted-foreground/25 rounded-md text-center">
                            <p className="text-sm text-muted-foreground">No grades assigned to your account</p>
                            <p className="text-xs text-muted-foreground mt-1">Contact your administrator to assign grades</p>
                          </div>
                        )}
                        {errors.grade && (
                          <p className="text-sm text-red-500">{errors.grade.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="difficulty">Difficulty *</Label>
                        <Select onValueChange={(value) => setValue('difficulty', value)} defaultValue="Medium">
                          <SelectTrigger>
                            <SelectValue placeholder="Select difficulty" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Easy">Easy</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.difficulty && (
                          <p className="text-sm text-red-500">{errors.difficulty.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="language">Language *</Label>
                        <Select onValueChange={(value) => setValue('language', value)} defaultValue="English">
                          <SelectTrigger>
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                          <SelectContent>
                            {language.map(language => (
                              <SelectItem key={language} value={language}>
                                {language}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.language && (
                          <p className="text-sm text-red-500">{errors.language.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="topic">Topic *</Label>
                        <Input
                          id="topic"
                          {...register('topic', { required: 'Topic is required' })}
                          placeholder="e.g., Key Battles of the Revolutionary War in American History"
                        />
                        {errors.topic && (
                          <p className="text-sm text-red-500">{errors.topic.message}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="duration">Duration (min) *</Label>
                        <Input
                          id="duration"
                          type="number"
                          min="5"
                          max="180"
                          {...register('duration', { 
                            required: 'Duration is required',
                            min: { value: 5, message: 'Minimum duration is 5 minutes' },
                            max: { value: 180, message: 'Maximum duration is 180 minutes' }
                          })}
                        />
                        {errors.duration && (
                          <p className="text-sm text-red-500">{errors.duration.message}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Question Types */}
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Question Types *</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { key: 'mcq', label: 'Multiple Choice', description: 'Questions with multiple answer options' },
                        { key: 'true_false', label: 'True/False', description: 'Binary choice questions' },
                        { key: 'short_answer', label: 'Short Answer', description: 'Open-ended text responses' }
                      ].map(({ key, label, description }) => (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={key}
                              checked={questionTypes[key]}
                              onCheckedChange={(checked) => handleQuestionTypeChange(key, checked)}
                            />
                            <Label htmlFor={key} className="font-medium text-sm">{label}</Label>
                          </div>
                          <p className="text-xs text-gray-600 ml-6">{description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Question Distribution */}
                  {selectedTypes.length > 0 && (
                    <div className="space-y-4">
                      <Label className="text-base font-semibold">Question Distribution</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {selectedTypes.map(type => (
                          <div key={type} className="space-y-2">
                            <Label htmlFor={`dist-${type}`} className="text-sm">
                              {type === 'mcq' ? 'MCQ Questions' : 
                               type === 'true_false' ? 'True/False Questions' : 
                               'Short Answer Questions'}
                            </Label>
                            <Input
                              id={`dist-${type}`}
                              type="number"
                              min="0"
                              max="50"
                              value={questionDistribution[type] || 0}
                              onChange={(e) => handleQuestionDistributionChange(type, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  

                  <Separator />

                  {/* Additional Fields */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="learningObjectives">Learning Objectives</Label>
                      <Textarea
                        id="learningObjectives"
                        {...register('learningObjectives')}
                        placeholder="Describe what students should learn from this assessment..."
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="anxietyTriggers">Anxiety Considerations</Label>
                      <Textarea
                        id="anxietyTriggers"
                        {...register('anxietyTriggers')}
                        placeholder="Consider any anxiety factors or special accommodations needed..."
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customPrompt">Custom Instructions (Optional)</Label>
                      <Textarea
                        id="customPrompt"
                        {...register('customPrompt')}
                        placeholder="Any specific instructions for the AI when generating questions..."
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || selectedTypes.length === 0}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    {isLoading ? 'Generating...' : 'Generate Assessment'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Preview Section - Show below form after generation */}
          {(isLoading || selectedAssessment) && !editingAssessment && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Generated Assessment
                </CardTitle>
                <CardDescription>
                  {isLoading ? 'Generating your assessment...' : 'Review your generated assessment and save it to your database'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                      <p className="text-gray-600">Generating assessment...</p>
                    </div>
                  </div>
                ) : (
                  <AssessmentPreview 
                    assessment={selectedAssessment}
                    isEditable={true}
                    isPreviewMode={true}  // Changed from false to true
                    isReviewMode={false}
                  />
                )}

                {selectedAssessment && (
                  <div className="flex justify-end pt-4 border-t">
                    <Button
                      onClick={handleSaveAssessment}
                      disabled={isSaving}
                      className="min-w-[150px]"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Assessment
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="saved" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Saved Assessments</h2>
            <div className="flex items-center gap-2">
              <Button
                onClick={loadAssessments}
                variant="outline"
                size="sm"
                disabled={loadingAssessments}
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Badge variant="outline" className="text-sm">
                {assessments.length} items
              </Badge>
            </div>
          </div>

          {loadingAssessments ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading assessments...</p>
              </div>
            </div>
          ) : assessments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No saved assessments</h3>
                <p className="text-gray-500 text-center mb-4">
                  Create your first assessment by filling out the form
                </p>
                <Button onClick={() => setActiveTab("create")} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Assessment
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {assessments.map((assessment) => (
                <div key={assessment.id} className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">
                            {assessment.title}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {assessment.subject} • {assessment.grade}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => previewAssessmentHandler(assessment)}
                            title="Preview Assessment"
                            className="cursor-pointer"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddToLesson(assessment)}
                            className="cursor-pointer text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <BookmarkPlus className="h-3 w-3 mr-1" />
                            Add to Lesson
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(assessment)}
                            className="cursor-pointer"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(assessment.id)}
                            className="text-red-600 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {assessment.grade}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {assessment.subject}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {assessment.difficulty}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {assessment.language}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {assessment.duration}min
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {assessment.numQuestions} questions
                        </Badge>
                      </div>
                      {assessment.questionTypes && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(assessment.questionTypes)
                            .filter(([_, selected]) => selected)
                            .map(([type, _]) => (
                              <Badge key={type} variant="secondary" className="text-xs">
                                {type === 'mcq' ? 'MCQ' : 
                                 type === 'true_false' ? 'T/F' : 
                                 'Short Answer'}
                              </Badge>
                            ))}
                        </div>
                      )}
                      {assessment.metadata?.createdAt && (
                        <div className="text-xs text-gray-500 mt-2">
                          Created: {new Date(assessment.metadata.createdAt).toLocaleDateString()}
                        </div>
                      )}
                    </CardHeader>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Assessment Preview Modal */}
      {previewAssessment && (
        <div className="fixed inset-0 bg-black/80  flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-secondary rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold dark:text-white">Assessment Preview</h3>
              <Button variant="outline" size="sm" onClick={closePreview}>
                ✕
              </Button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)] text-black dark:text-white">
              <AssessmentPreview 
                assessment={previewAssessment}
                isEditable={false}
                isPreviewMode={true}  // This is already correct
                isReviewMode={false}
              />
            </div>
          </div>
        </div>
      )}

      <Dialog open={addToLessonDialog} onOpenChange={setAddToLessonDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Assessment to Lesson</DialogTitle>
            <DialogDescription>
              Create a lesson from this assessment for your students.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lessonTitle">Lesson Title</Label>
              <Input
                id="lessonTitle"
                value={lessonFormData.title}
                onChange={(e) => setLessonFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter lesson title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lessonDescription">Lesson Description</Label>
              <Textarea
                id="lessonDescription"
                value={lessonFormData.lessonDescription}
                onChange={(e) => setLessonFormData(prev => ({ ...prev, lessonDescription: e.target.value }))}
                placeholder="Describe what students will learn"
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="learningObjectives">Learning Objectives</Label>
              <Textarea
                id="learningObjectives"
                value={lessonFormData.learningObjectives}
                onChange={(e) => setLessonFormData(prev => ({ ...prev, learningObjectives: e.target.value }))}
                placeholder="What will students achieve?"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddToLessonDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitAddToLesson} disabled={isAddingToLesson}>
              {isAddingToLesson ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-4 w-4 mr-2" />
                  Add to Lesson
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssessmentForm;
