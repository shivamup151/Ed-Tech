"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { 
  Eye, 
  X, 
  FileText, 
  Presentation, 
  Image, 
  Video, 
  BookOpen, 
  Search, 
  FileCheck,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Clock,
  Trophy,
  Star,
  Loader2
} from "lucide-react";
import ContentPreview from "@/components/ui/content-preview";
import AssessmentPreview from "@/components/assessment-preview";
import PPTXViewer from "@/components/pptx-viewer";
import VideoPreview from "@/components/ui/video-preview";
import { CarouselWithControls } from "@/components/ui/carousel";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { MarkdownStyles } from "../Markdown";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateStudentProgress } from '@/app/(home)/student/learning-library/action';

// Add the same content type configuration as LibraryDialog
const contentTypes = {
  content: { label: "Content", icon: FileText, color: "bg-blue-100" },
  slides: { label: "Slides", icon: Presentation, color: "bg-purple-100" },
  comic: { label: "Comics", icon: BookOpen, color: "bg-green-100" },
  image: { label: "Images", icon: Image, color: "bg-pink-100" },
  video: { label: "Videos", icon: Video, color: "bg-red-100" },
  assessment: { label: "Assessments", icon: FileCheck, color: "bg-yellow-100" },
  websearch: { label: "Web Search", icon: Search, color: "bg-indigo-100" }
};

// Sanitize evaluation results to remove large unnecessary data before saving to DB
const sanitizeEvaluationResults = (results) => {
  const sanitized = {};
  Object.keys(results).forEach(key => {
    sanitized[key] = {
      isCorrect: results[key].isCorrect,
      evaluationDetails: {
        method: results[key].evaluationDetails?.method,
        explanation: results[key].evaluationDetails?.explanation,
        fallback: results[key].evaluationDetails?.fallback
      }
      // Exclude correctAnswer, studentAnswer, and comparedValues to reduce size
    };
  });
  return sanitized;
};

// Smart string comparison function for fallback evaluation
const smartStringComparison = (studentAnswer, correctAnswer) => {
  if (!studentAnswer || !correctAnswer) return false;
  
  // Normalize both answers
  const normalize = (text) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };
  
  const studentNormalized = normalize(studentAnswer);
  const correctNormalized = normalize(correctAnswer);
  
  // Exact match
  if (studentNormalized === correctNormalized) {
    return true;
  }
  
  // Check if student answer contains all key words from correct answer
  const correctWords = correctNormalized.split(' ').filter(word => word.length > 2);
  const studentWords = studentNormalized.split(' ');
  
  if (correctWords.length > 0) {
    const matchingWords = correctWords.filter(word => 
      studentWords.some(studentWord => 
        studentWord.includes(word) || word.includes(studentWord)
      )
    );
    
    // If 80% or more of key words match, consider it correct
    const matchPercentage = matchingWords.length / correctWords.length;
    if (matchPercentage >= 0.8) {
      return true;
    }
  }
  
  // Check if correct answer contains student answer (for partial answers)
  if (correctNormalized.includes(studentNormalized) && studentNormalized.length > 3) {
    return true;
  }
  
  // Check if student answer contains correct answer (for more detailed answers)
  if (studentNormalized.includes(correctNormalized) && correctNormalized.length > 3) {
    return true;
  }
  
  return false;
};

// Add this new interactive assessment component
const InteractiveAssessment = ({ assessment, onAnswerChange, studentAnswers, onSubmit, hideSolutions = true }) => {
  // Parse assessment content to separate questions and solutions
  const parseAssessmentContent = (content) => {
    if (!content) return { questions: [], solutions: [] };

    const lines = content.split('\n');
    const questions = [];
    const solutions = [];
    let currentQuestion = null;
    let inSolutionsSection = false;
    let questionCounter = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if we're entering solutions section
      if (line === '---' || line.includes('**Solutions**') || line.includes('**الحلول**')) {
        inSolutionsSection = true;
        continue;
      }

      if (inSolutionsSection) {
        // Parse solution lines
        if (line.match(/^\d+\./)) {
          solutions.push(line);
        }
      } else {
        // Look for question patterns - both numbered and unnumbered
        const isQuestionStart = line.match(/^\d+\./) || 
                               line.match(/^[A-Z]\./) ||
                               line.match(/^[أ-ي]\./) || // Arabic letters
                               (line.includes('؟') && line.length > 10) || // Arabic question mark
                               (line.includes('?') && line.length > 10) || // English question mark
                               line.match(/^السؤال/) || // Arabic "Question"
                               line.match(/^Question/) || // English "Question"
                               line.match(/^\*\*\d+\./) || // **1. Question format
                               line.match(/^\*\*[A-Z]\./) || // **A. Question format
                               line.match(/^\*\*[أ-ي]\./) || // **Arabic. Question format
                               line.match(/^MCQ\s*$/) || // MCQ header
                               line.match(/^اختيار\s*من\s*متعدد\s*$/); // Arabic MCQ header

        if (isQuestionStart) {
          // Save previous question if exists
          if (currentQuestion) {
            questions.push(currentQuestion);
            console.log(`Saved question ${currentQuestion.number} with ${currentQuestion.options.length} options`);
          }
          
          // Start new question - handle markdown bold format
          let questionText = line;
          
          // Remove markdown bold formatting
          if (line.startsWith('**') && line.endsWith('**')) {
            questionText = line.slice(2, -2); // Remove ** from start and end
          } else if (line.startsWith('**')) {
            questionText = line.slice(2); // Remove ** from start
          }
          
          // Extract question number and text
          const numberMatch = questionText.match(/^(\d+)\./);
          const letterMatch = questionText.match(/^([A-Z])\./);
          const arabicMatch = questionText.match(/^([أ-ي])\./);
          
          let questionNumber = questionCounter.toString();
          let cleanQuestionText = questionText;
          
          if (numberMatch) {
            questionNumber = numberMatch[1];
            cleanQuestionText = questionText.replace(/^\d+\.\s*/, '');
          } else if (letterMatch) {
            questionNumber = letterMatch[1];
            cleanQuestionText = questionText.replace(/^[A-Z]\.\s*/, '');
          } else if (arabicMatch) {
            questionNumber = arabicMatch[1];
            cleanQuestionText = questionText.replace(/^[أ-ي]\.\s*/, '');
          } else {
            cleanQuestionText = questionText.replace(/^(السؤال\s*\d*:?\s*|Question\s*\d*:?\s*)/, '');
          }
          
          currentQuestion = {
            number: questionNumber,
            text: cleanQuestionText,
            type: 'unknown',
            options: []
          };
          questionCounter++;
          
          console.log(`Started new question ${questionNumber}: "${cleanQuestionText}"`);

          // Check for True/False immediately (no options to collect)
          if (cleanQuestionText.toLowerCase().includes('true or false') || 
              cleanQuestionText.toLowerCase().includes('true/false') ||
              cleanQuestionText.includes('صح أم خطأ') ||
              cleanQuestionText.includes('صحيح أم خاطئ')) {
            currentQuestion.type = 'true_false';
            currentQuestion.options = ['True', 'False'];
          }
        } else if (currentQuestion) {
          // FIXED: Handle multiple option formats - Enhanced patterns with better debugging
          const optionPatterns = [
            /^[A-D]\)/,           // A), B), C), D)
            /^[A-D]\./,           // A., B., C., D.
            /^[A-D]\s/,           // A , B , C , D 
            /^[A-D]:/,            // A:, B:, C:, D:
            /^[1-4]\)/,           // 1), 2), 3), 4)
            /^[1-4]\./,           // 1., 2., 3., 4.
            /^[1-4]\s/,           // 1 , 2 , 3 , 4 
            /^[1-4]:/,            // 1:, 2:, 3:, 4:
            /^[أ-ي]\)/,           // Arabic letters with )
            /^[أ-ي]\./,           // Arabic letters with .
            /^[أ-ي]\s/,           // Arabic letters with space
            /^[أ-ي]:/,            // Arabic letters with :
            /^-\s/,               // - (dash with space)
            /^\*\s/,              // * (asterisk with space)
            /^•\s/,               // • (bullet with space)
            /^أ\)/,               // Arabic أ)
            /^ب\)/,               // Arabic ب)
            /^ج\)/,               // Arabic ج)
            /^د\)/,               // Arabic د)
            /^أ\./,               // Arabic أ.
            /^ب\./,               // Arabic ب.
            /^ج\./,               // Arabic ج.
            /^د\./,               // Arabic د.
            /^a\)/i,              // a), b), c), d) (case insensitive)
            /^b\)/i,              // b)
            /^c\)/i,              // c)
            /^d\)/i,              // d)
            /^a\./i,              // a., b., c., d. (case insensitive)
            /^b\./i,              // b.
            /^c\./i,              // c.
            /^d\./i,              // d.
          ];

          const isOption = optionPatterns.some(pattern => pattern.test(line));
          
          // Debug logging for option detection
          if (currentQuestion.type === 'mcq' && line.trim()) {
            console.log(`Checking line for MCQ options: "${line}"`);
            console.log(`Is option: ${isOption}`);
            console.log(`Current question options count: ${currentQuestion.options.length}`);
          }
          
          if (isOption) {
            // This is an option for the current MCQ question
            currentQuestion.options.push(line);
            console.log(`Added option: "${line}" to question ${currentQuestion.number}`);
          } else if (currentQuestion.type === 'short_answer' && line && !line.match(/^(\d+\.|[A-Z]\.|[أ-ي]\.|السؤال|Question)/)) {
            // This might be additional text for the short answer question
            currentQuestion.text += ' ' + line;
          } else if (currentQuestion.type === 'mcq' && line.trim() && !line.match(/^(\d+\.|[A-Z]\.|[أ-ي]\.|السؤال|Question|MCQ|اختيار)/)) {
            // If it's an MCQ question and we haven't found options yet, this might be an option without standard formatting
            // Try to detect if this looks like an option (starts with common option indicators)
            const looksLikeOption = /^[a-zA-Zأ-ي]\s/.test(line) || 
                                   /^[a-zA-Zأ-ي]:/.test(line) ||
                                   /^[a-zA-Zأ-ي]\./.test(line) ||
                                   /^[a-zA-Zأ-ي]\)/.test(line) ||
                                   line.trim().length < 100; // Short lines might be options
            
            if (looksLikeOption && currentQuestion.options.length < 4) {
              currentQuestion.options.push(line);
              console.log(`Added potential option: "${line}" to question ${currentQuestion.number}`);
            }
          }
        }
      }
    }

    // Don't forget the last question
    if (currentQuestion) {
      questions.push(currentQuestion);
      console.log(`Saved final question ${currentQuestion.number} with ${currentQuestion.options.length} options`);
    }

    // Determine question types based on parsed options
    questions.forEach(q => {
      if (q.type === 'true_false') {
        // Already set, skip
        return;
      }
      
      if (q.options.length >= 2) {
        // Has multiple choice options
        q.type = 'mcq';
      } else {
        // No options, treat as short answer
        q.type = 'short_answer';
      }
    });

    // Debug: Log all parsed questions
    console.log('=== FINAL PARSED QUESTIONS ===');
    questions.forEach((q, index) => {
      console.log(`Question ${q.number}: "${q.text}" (${q.type}) - ${q.options.length} options`);
      if (q.options.length > 0) {
        console.log(`  Options:`, q.options);
      }
    });

    // If no questions were found with the above logic, try to extract content as a single question
    if (questions.length === 0 && content.trim()) {
      // Check if this is a lesson plan rather than an assessment
      if (content.includes('**عنوان الاختبار**') || content.includes('**Test Title**')) {
        // This is an assessment header, but no questions found
        return { questions: [], solutions: [] };
      } else {
        // Treat the entire content as a single question for completion
        questions.push({
          number: '1',
          text: 'Review the content and mark as complete',
          type: 'content_review',
          options: []
        });
      }
    }

    return { questions, solutions };
  };

  // Try multiple possible content fields - same as library-dialog.jsx
  const assessmentContent = assessment?.content || 
                           assessment?.generatedContent || 
                           assessment?.assessmentContent || 
                           assessment?.instruction || '';

  const { questions, solutions } = parseAssessmentContent(assessmentContent);
  
  // Debug logging
  console.log('=== InteractiveAssessment Debug ===');
  console.log('Assessment object:', assessment);
  console.log('Assessment content found:', assessmentContent?.substring(0, 200));
  console.log('Content fields:', {
    content: assessment?.content,
    generatedContent: assessment?.generatedContent,
    assessmentContent: assessment?.assessmentContent,
    instruction: assessment?.instruction,
    topic: assessment?.topic
  });
  console.log('Parsed questions:', questions);
  console.log('Student answers:', studentAnswers);

  const handleAnswerChange = (questionNumber, answer) => {
    console.log('Answer changed:', questionNumber, answer);
    // Only update if questionNumber is a valid string/number
    if (questionNumber && typeof questionNumber === 'string' && questionNumber !== '[object Object]') {
      const newAnswers = { ...studentAnswers, [questionNumber]: answer };
      console.log('New answers object:', newAnswers);
      onAnswerChange(questionNumber, answer);
    }
  };

  const handleSubmit = async () => {
    if (!questions || questions.length === 0) {
      console.error('No questions found in assessment');
      return;
    }

    let correctAnswers = 0;
    const totalQuestions = questions.length;
    const evaluationResults = {}; // Store evaluation results for each question

    console.log('Submitting assessment with answers:', studentAnswers);

    // Process each question and evaluate answers
    for (const question of questions) {
      const studentAnswer = studentAnswers[question.number];
      const solutionLine = solutions.find(s => s.startsWith(`${question.number}.`));
      

      if (!solutionLine) {
        console.warn(`No solution found for question ${question.number}`);
        continue;
      }

      const correctAnswer = solutionLine.replace(/^\d+\.\s*/, '').trim();
      let isCorrect = false;
      let evaluationDetails = null;

      if (question.type === 'mcq') {
        // For MCQ, extract the option letter from student answer and compare with correct answer
        let studentOptionLetter = '';
        if (studentAnswer) {
          // Enhanced letter extraction with more patterns
          const letterPatterns = [
            /^([A-D])\./,           // A. text
            /^([A-D])\s/,           // A text
            /^([A-D])\)/,           // A) text
            /^([A-D]):/,            // A: text
            /\(([A-D])\)/,          // text (A)
            /^([A-D])$/,            // just A
            /^([A-D])\.\s*$/,       // A. (with optional spaces)
            /^([A-D])\s*$/,         // A (with optional spaces)
          ];
          
          for (const pattern of letterPatterns) {
            const match = studentAnswer.match(pattern);
            if (match) {
              studentOptionLetter = match[1];
              break;
            }
          }
          
          // If no letter found, try to match the actual text content with options
          if (!studentOptionLetter && question.options) {
            const matchingOption = question.options.find(option => {
              const optionText = option.replace(/^[A-D][\.\)\:\s]*/, '').trim();
              return optionText.toLowerCase() === studentAnswer.trim().toLowerCase();
            });
            if (matchingOption) {
              const optionLetterMatch = matchingOption.match(/^([A-D])/);
              if (optionLetterMatch) {
                studentOptionLetter = optionLetterMatch[1];
              }
            }
          }
        }
        
        // Normalize correct answer - remove any extra formatting
        const normalizedCorrectAnswer = correctAnswer.replace(/[^\w]/g, '').toUpperCase();
        const normalizedStudentAnswer = studentOptionLetter ? studentOptionLetter.toUpperCase() : '';
        
        // Debug logging
        console.log(`MCQ Debug - Question ${question.number}:`, {
          studentAnswer,
          studentOptionLetter,
          correctAnswer,
          normalizedCorrectAnswer,
          normalizedStudentAnswer,
          questionOptions: question.options
        });
        
        isCorrect = normalizedStudentAnswer && normalizedStudentAnswer === normalizedCorrectAnswer;
        evaluationDetails = { 
          method: 'exact_match', 
          studentOptionLetter: normalizedStudentAnswer, 
          correctAnswer: normalizedCorrectAnswer,
          originalStudentAnswer: studentAnswer,
          originalCorrectAnswer: correctAnswer
        };
      } else if (question.type === 'true_false') {
        // For True/False, compare with multiple variations
        const normalizeTF = (answer) => {
          if (!answer) return '';
          return answer.toLowerCase().trim().replace(/[^\w]/g, '');
        };
        
        const studentNormalized = normalizeTF(studentAnswer);
        const correctNormalized = normalizeTF(correctAnswer);
        
        // Handle multiple variations
        const trueVariations = ['true', 't', 'yes', 'y', 'correct', 'right', 'صحيح', 'صح'];
        const falseVariations = ['false', 'f', 'no', 'n', 'incorrect', 'wrong', 'خاطئ', 'خطأ'];
        
        let studentBool = null;
        let correctBool = null;
        
        if (trueVariations.includes(studentNormalized)) studentBool = true;
        else if (falseVariations.includes(studentNormalized)) studentBool = false;
        
        if (trueVariations.includes(correctNormalized)) correctBool = true;
        else if (falseVariations.includes(correctNormalized)) correctBool = false;
        
        isCorrect = studentBool !== null && correctBool !== null && studentBool === correctBool;
        
        // Fallback to direct comparison if boolean conversion failed
        if (!isCorrect && studentBool === null && correctBool === null) {
          isCorrect = studentNormalized === correctNormalized;
        }
        
        evaluationDetails = { 
          method: 'exact_match', 
          studentNormalized, 
          correctNormalized,
          studentBool,
          correctBool
        };
      } else if (question.type === 'short_answer') {
        // For short answer, use semantic evaluation API
        try {
          const response = await fetch('/api/student/evaluate-answer', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              question: question.text,
              correctAnswer: correctAnswer,
              studentAnswer: studentAnswer || '',
              language: 'English' // Could be dynamic based on content language
            }),
          });

          if (response.ok) {
            const result = await response.json();
            isCorrect = result.isCorrect;
            evaluationDetails = { 
              method: 'semantic_evaluation', 
              explanation: result.explanation,
              fallback: result.fallback || false
            };
          } else {
            console.warn(`API evaluation failed for question ${question.number}, falling back to string comparison`);
            // Fallback to smart string comparison
            isCorrect = smartStringComparison(studentAnswer || '', correctAnswer);
            evaluationDetails = { method: 'fallback_string_match' };
          }
        } catch (error) {
          console.error(`Error evaluating question ${question.number}:`, error);
          // Fallback to smart string comparison
          isCorrect = smartStringComparison(studentAnswer || '', correctAnswer);
          evaluationDetails = { method: 'fallback_string_match', error: error.message };
        }
      }
     
      // Store evaluation result for this question
      evaluationResults[question.number] = {
        isCorrect,
        correctAnswer,
        studentAnswer,
        evaluationDetails
      };
     
      
      if (isCorrect) {
        correctAnswers++;
      }
    }

    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    
    // Enhanced debug logging for score calculation
    console.log('=== ASSESSMENT SCORE CALCULATION DEBUG ===');
    console.log('Total Questions:', totalQuestions);
    console.log('Correct Answers:', correctAnswers);
    console.log('Calculated Score:', score);
    console.log('Score Formula:', `(${correctAnswers} / ${totalQuestions}) * 100 = ${score}%`);
    console.log('Evaluation Results:', evaluationResults);
    console.log('==========================================');
    
    // Call the parent's onSubmit function with the calculated score
    if (onSubmit) {
      await onSubmit(score, correctAnswers, totalQuestions, studentAnswers, evaluationResults);
    }
  };

  const renderQuestion = (question, index) => {
    const studentAnswer = studentAnswers[question.number] || '';

    return (
      <div key={index} className="border rounded-lg p-6 bg-white dark:bg-gray-800 shadow-sm mb-6">
        <div className="flex items-start gap-3 mb-4">
          <Badge variant="outline" className="mt-1">
            {question.number}
          </Badge>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Badge 
                variant={question.type === 'mcq' ? 'default' : 
                        question.type === 'true_false' ? 'secondary' : 'outline'}
                className="text-xs"
              >
                {question.type === 'mcq' ? 'MCQ' : 
                 question.type === 'true_false' ? 'True/False' : 'Short Answer'}
              </Badge>
            </div>
            <p className="text-foreground mb-4 font-medium">{question.text}</p>
            
            {question.type === 'mcq' && question.options.length > 0 && (
              <RadioGroup
                value={studentAnswer}
                onValueChange={(value) => handleAnswerChange(question.number, value)}
                className="space-y-2"
              >
                {question.options.map((option, optIndex) => (
                  <div key={optIndex} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`q${question.number}-opt${optIndex}`} />
                    <Label htmlFor={`q${question.number}-opt${optIndex}`} className="text-sm cursor-pointer text-foreground">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {question.type === 'mcq' && question.options.length === 0 && (
              <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md">
                <p>This question appears to be missing options. Please contact your teacher.</p>
              </div>
            )}

            {question.type === 'true_false' && (() => {
              // Detect language from assessment content
              const isArabic = assessmentContent && (
                assessmentContent.includes('**الحلول**') || 
                assessmentContent.includes('صح أم خطأ') ||
                assessmentContent.includes('صحيح أم خاطئ') ||
                /[\u0600-\u06FF]/.test(assessmentContent)
              );
              
              const trueLabel = isArabic ? 'صح' : 'True';
              const falseLabel = isArabic ? 'خطأ' : 'False';
              
              return (
                <RadioGroup
                  value={studentAnswer}
                  onValueChange={(value) => handleAnswerChange(question.number, value)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="True" id={`q${question.number}-true`} />
                    <Label htmlFor={`q${question.number}-true`} className="text-sm cursor-pointer text-foreground">
                      {trueLabel}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="False" id={`q${question.number}-false`} />
                    <Label htmlFor={`q${question.number}-false`} className="text-sm cursor-pointer text-foreground">
                      {falseLabel}
                    </Label>
                  </div>
                </RadioGroup>
              );
            })()}

            {question.type === 'short_answer' && (
              <Textarea
                placeholder="Type your answer here..."
                value={studentAnswer}
                onChange={(e) => handleAnswerChange(question.number, e.target.value)}
                className="min-h-[100px]"
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6 flex-shrink-0">
        <h3 className="text-lg font-semibold text-foreground">{assessment.title}</h3>
        <p className="text-sm text-muted-foreground">{assessment.topic}</p>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
          <Badge variant="outline">{assessment.subject}</Badge>
          <Badge variant="secondary">{assessment.grade}</Badge>
          <Badge variant="outline">{assessment.difficulty}</Badge>
        </div>
      </div>
      
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="space-y-4">
          {questions.length > 0 ? questions.map((question, index) => renderQuestion(question, index)) : (
            <div className="text-center py-8 text-muted-foreground">
              <div>
                <FileCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-sm">No assessment questions found</p>
                <p className="text-xs text-muted-foreground mt-2">
                  This appears to be a lesson plan rather than an assessment.
                </p>
                
                {/* Show available content from description and topic */}
                {(assessment.description || assessment.topic) && (
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg text-left max-w-2xl mx-auto">
                    <h4 className="font-medium mb-2 text-foreground">Content:</h4>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {assessment.description && (
                        <p className="text-sm text-foreground mb-2">
                          <strong>Description:</strong> {assessment.description}
                        </p>
                      )}
                      {assessment.topic && (
                        <p className="text-sm text-foreground">
                          <strong>Topic:</strong> {assessment.topic}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="mt-6">
                  <p className="text-xs text-muted-foreground">
                    Since no questions are available, you can mark this content as completed.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {questions.length > 0 && (
        <div className="mt-6 flex justify-center flex-shrink-0">
          <Button 
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 px-8"
            disabled={Object.keys(studentAnswers).length < questions.length}
          >
            <FileCheck className="mr-2 h-4 w-4" />
            Submit Assessment
          </Button>
        </div>
      )}
      
      {/* Show "Mark as Complete" button when no questions are found */}
      {questions.length === 0 && (
        <div className="mt-6 flex justify-center flex-shrink-0">
          <Button 
            onClick={() => {
              // Call the parent's completion handler with a default score
              if (onSubmit) {
                onSubmit(100, 1, 1, {}); // 100% score for content-only completion
              }
            }}
            className="bg-green-600 hover:bg-green-700 px-8"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Mark as Complete
          </Button>
        </div>
      )}
    </div>
  );
};

// Add this new component before the InteractiveAssessment component
const AssessmentReview = ({ assessment, studentAnswers, score, correctAnswers, totalQuestions, evaluationResults = {}, onClose }) => {
  // Parse assessment content to separate questions and solutions
  const parseAssessmentContent = (content) => {
    if (!content) return { questions: [], solutions: [] };

    const lines = content.split('\n');
    const questions = [];
    const solutions = [];
    let currentQuestion = null;
    let inSolutionsSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if we're entering solutions section
      if (line === '---') {
        inSolutionsSection = true;
        continue;
      }

      if (inSolutionsSection) {
        // Skip the "Solutions" header
        if (line.includes('**Solutions**') || line.includes('**الحلول**')) {
          continue;
        }
        
        // Parse solution lines
        if (line.match(/^\d+\./)) {
          solutions.push(line);
        }
      } else {
        // Parse question lines
        if (line.match(/^\d+\./) && !line.includes('A)') && !line.includes('B)') && !line.includes('C)') && !line.includes('D)')) {
          // Save previous question if exists
          if (currentQuestion) {
            questions.push(currentQuestion);
          }
          
          // Start new question
          const questionText = line.replace(/^\d+\.\s*/, '');
          currentQuestion = {
            number: line.match(/^(\d+)\./)[1],
            text: questionText,
            type: 'unknown',
            options: []
          };

          if (questionText.toLowerCase().includes('true or false') || 
              questionText.toLowerCase().includes('true/false')) {
            currentQuestion.type = 'true_false';
            currentQuestion.options = ['True', 'False'];
          }
        } else if (currentQuestion && line.match(/^[A-D]\)/)) {
          currentQuestion.options.push(line);
        } else if (currentQuestion && currentQuestion.type === 'unknown' && line && !line.match(/^\d+\./)) {
          currentQuestion.text += ' ' + line;
        }
      }
    }

    // Don't forget the last question
    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    // Determine question types based on parsed options
    questions.forEach(q => {
      if (q.type === 'true_false') {
        // Already set, skip
        return;
      }
      
      if (q.options.length >= 2) {
        // Has multiple choice options
        q.type = 'mcq';
      } else {
        // No options, treat as short answer
        q.type = 'short_answer';
      }
    });

    return { questions, solutions };
  };

  const { questions, solutions } = parseAssessmentContent(assessment?.content || assessment?.generatedContent || assessment?.assessmentContent);
  
  // Debug logging for AssessmentReview component
  console.log('AssessmentReview initialized with:', {
    assessment: assessment?.title || 'No title',
    studentAnswers,
    score,
    correctAnswers,
    totalQuestions,
    evaluationResults,
    questionsCount: questions.length,
    solutionsCount: solutions.length,
    hasStudentAnswers: Object.keys(studentAnswers).length > 0,
    studentAnswersKeys: Object.keys(studentAnswers)
  });

  const renderQuestionReview = (question, index) => {
    const studentAnswer = studentAnswers[question.number] || '';
    const solutionLine = solutions.find(s => s.startsWith(`${question.number}.`));
    const correctAnswer = solutionLine ? solutionLine.replace(/^\d+\.\s*/, '').trim() : '';
    
    // Debug logging
    console.log(`Review - Question ${question.number}:`, {
      studentAnswer,
      correctAnswer,
      studentAnswers,
      evaluationResults: evaluationResults[question.number],
      questionType: question.type,
      hasStudentAnswer: !!studentAnswer,
      studentAnswerLength: studentAnswer?.length || 0
    });
    
    // Use stored evaluation results if available, otherwise fall back to basic comparison
    let isCorrect = false;
    let evaluationDetails = null;
    
    if (evaluationResults[question.number]) {
      // Use the stored evaluation result from submission
      isCorrect = evaluationResults[question.number].isCorrect;
      evaluationDetails = evaluationResults[question.number].evaluationDetails;
    } else {
      // Fallback to basic comparison (for backward compatibility)
      if (question.type === 'mcq') {
        // For MCQ, extract the option letter from student answer and compare with correct answer
        let studentOptionLetter = '';
        if (studentAnswer) {
          // Extract letter from format like "A. text" or "text (A)" or just "A" or "الخلايا" (Arabic text)
          const letterMatch = studentAnswer.match(/^([A-D])\.|\(([A-D])\)$|^([A-D])$|^([A-D])\.\s*[^\s]|^[^\s]*\s*\(([A-D])\)$/);
          if (letterMatch) {
            studentOptionLetter = letterMatch[1] || letterMatch[2] || letterMatch[3] || letterMatch[4] || letterMatch[5];
          }
          
          // If no letter found, try to match the actual text content with options
          if (!studentOptionLetter && question.options) {
            const matchingOption = question.options.find(option => {
              const optionText = option.replace(/^[A-D]\.\s*/, '').trim();
              return optionText === studentAnswer.trim();
            });
            if (matchingOption) {
              const optionLetterMatch = matchingOption.match(/^([A-D])\./);
              if (optionLetterMatch) {
                studentOptionLetter = optionLetterMatch[1];
              }
            }
          }
        }
        
        isCorrect = studentOptionLetter && studentOptionLetter.toUpperCase() === correctAnswer.toUpperCase();
        evaluationDetails = { method: 'exact_match_fallback', studentOptionLetter, correctAnswer };
      } else if (question.type === 'true_false') {
        isCorrect = studentAnswer && studentAnswer.toLowerCase() === correctAnswer.toLowerCase();
        evaluationDetails = { method: 'exact_match_fallback' };
      } else if (question.type === 'short_answer') {
        const studentLower = (studentAnswer || '').toLowerCase().trim();
        const correctLower = correctAnswer.toLowerCase().trim();
        isCorrect = studentLower === correctLower || correctLower.includes(studentLower);
        evaluationDetails = { method: 'string_match_fallback' };
      }
    }

    return (
      <div key={index} className={`border rounded-lg p-6 shadow-sm mb-6 ${
        isCorrect ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      }`}>
        <div className="flex items-start gap-3 mb-4">
          <Badge variant="outline" className="mt-1">
            {question.number}
          </Badge>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <Badge 
                variant={question.type === 'mcq' ? 'default' : 
                        question.type === 'true_false' ? 'secondary' : 'outline'}
                className="text-xs"
              >
                {question.type === 'mcq' ? 'MCQ' : 
                 question.type === 'true_false' ? 'True/False' : 'Short Answer'}
              </Badge>
              <Badge 
                variant={isCorrect ? 'default' : 'destructive'}
                className={`text-xs ${isCorrect ? 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200'}`}
              >
                {isCorrect ? '✓ Correct' : '✗ Incorrect'}
              </Badge>
            </div>
            <p className="text-foreground mb-4 font-medium">{question.text}</p>
            
            {/* Show student's answer */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">Your Answer:</p>
              </div>
              <div className={`w-full min-h-[2rem] p-3 rounded border font-medium ${
                isCorrect 
                  ? 'bg-green-50 dark:bg-green-900/30 border-green-500 text-green-900 dark:text-green-100' 
                  : 'bg-red-50 dark:bg-red-900/30 border-red-500 text-red-900 dark:text-red-100'
              }`}>
                <div className="flex items-start gap-3">
                {isCorrect ? (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                  ) : (
                    <X className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
                  )}
                  <div className="flex-1">
                    {studentAnswer ? (
                      <div 
                        dir={/[\u0600-\u06FF\u0750-\u077F]/.test(studentAnswer) ? 'rtl' : 'ltr'}
                        style={/[\u0600-\u06FF\u0750-\u077F]/.test(studentAnswer) ? { 
                          direction: 'rtl', 
                          textAlign: 'right', 
                          unicodeBidi: 'embed',
                          fontFamily: 'Arial, sans-serif',
                          fontSize: '16px',
                          lineHeight: '1.6'
                        } : {
                          fontFamily: 'Arial, sans-serif',
                          fontSize: '16px',
                          lineHeight: '1.6'
                        }}
                      >
                        {/[\u0600-\u06FF\u0750-\u077F]/.test(studentAnswer) ? (
                          // For Arabic content, render as plain text to avoid LaTeX processing issues
                          <div 
                            className="text-base font-medium"
                            style={{ 
                              wordBreak: 'break-word', 
                              overflowWrap: 'anywhere',
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'Arial, sans-serif',
                              fontSize: '16px',
                              lineHeight: '1.6'
                            }}
                          >
                            {studentAnswer.replace(/\$\$?([^$]+)\$\$?/g, '$1').replace(/\\frac\{[^}]*\}\{[^}]*\}/g, (match) => {
                              // Extract numerator and denominator from \frac{numerator}{denominator}
                              const fracMatch = match.match(/\\frac\{([^}]*)\}\{([^}]*)\}/);
                              if (fracMatch) {
                                const numerator = fracMatch[1];
                                const denominator = fracMatch[2];
                                return `${numerator}/${denominator}`;
                              }
                              return match;
                            }).replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '')}
                          </div>
                        ) : (
                          // For non-Arabic content, use ReactMarkdown with LaTeX support
                          <div className="prose prose-sm max-w-none dark:prose-invert" style={{ 
                            wordBreak: 'break-word', 
                            overflowWrap: 'anywhere',
                            whiteSpace: 'pre-wrap'
                          }}>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeKatex, rehypeRaw]}
                              components={MarkdownStyles}
                            >
                              {studentAnswer}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">No answer provided</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Show correct answer */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-foreground">Correct Answer:</p>
              </div>
              <div className="w-full min-h-[2rem] p-3 bg-white dark:bg-gray-800 rounded border border-blue-200 dark:border-blue-700">
                <div 
                  dir={/[\u0600-\u06FF\u0750-\u077F]/.test(correctAnswer) ? 'rtl' : 'ltr'}
                  style={/[\u0600-\u06FF\u0750-\u077F]/.test(correctAnswer) ? { 
                    direction: 'rtl', 
                    textAlign: 'right', 
                    unicodeBidi: 'embed',
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '16px',
                    lineHeight: '1.6'
                  } : {
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '16px',
                    lineHeight: '1.6'
                  }}
                >
                  {/[\u0600-\u06FF\u0750-\u077F]/.test(correctAnswer) ? (
                    // For Arabic content, render as plain text to avoid LaTeX processing issues
                    <div 
                      className="text-base font-medium"
                      style={{ 
                        wordBreak: 'break-word', 
                        overflowWrap: 'anywhere',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '16px',
                        lineHeight: '1.6'
                      }}
                    >
                      {correctAnswer.replace(/\$\$?([^$]+)\$\$?/g, '$1').replace(/\\frac\{[^}]*\}\{[^}]*\}/g, (match) => {
                        // Extract numerator and denominator from \frac{numerator}{denominator}
                        const fracMatch = match.match(/\\frac\{([^}]*)\}\{([^}]*)\}/);
                        if (fracMatch) {
                          const numerator = fracMatch[1];
                          const denominator = fracMatch[2];
                          return `${numerator}/${denominator}`;
                        }
                        return match;
                      }).replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '')}
                    </div>
                  ) : (
                    // For non-Arabic content, use ReactMarkdown with LaTeX support
                    <div className="prose prose-sm max-w-none dark:prose-invert" style={{ 
                      wordBreak: 'break-word', 
                      overflowWrap: 'anywhere',
                      whiteSpace: 'pre-wrap'
                    }}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex, rehypeRaw]}
                        components={MarkdownStyles}
                      >
                        {correctAnswer}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Show options for MCQ */}
            {question.type === 'mcq' && question.options.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-foreground mb-2">Options:</p>
                <div className="space-y-1">
                  {question.options.map((option, optIndex) => (
                    <div 
                      key={optIndex} 
                      className={`text-sm p-2 rounded ${
                      option === correctAnswer ? 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 font-medium' :
                      option === studentAnswer && !isCorrect ? 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                      }`}
                      dir={/[\u0600-\u06FF\u0750-\u077F]/.test(option) ? 'rtl' : 'ltr'}
                      style={/[\u0600-\u06FF\u0750-\u077F]/.test(option) ? { 
                        direction: 'rtl', 
                        textAlign: 'right', 
                        unicodeBidi: 'embed',
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '14px',
                        lineHeight: '1.5'
                      } : {
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '14px',
                        lineHeight: '1.5'
                      }}
                    >
                      {/[\u0600-\u06FF\u0750-\u077F]/.test(option) ? (
                        // For Arabic content, render as plain text to avoid LaTeX processing issues
                        <div 
                          className="text-sm font-medium"
                          style={{ 
                            wordBreak: 'break-word', 
                            overflowWrap: 'anywhere',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'Arial, sans-serif',
                            fontSize: '14px',
                            lineHeight: '1.5'
                          }}
                        >
                          {option.replace(/\$\$?([^$]+)\$\$?/g, '$1').replace(/\\frac\{[^}]*\}\{[^}]*\}/g, (match) => {
                            // Extract numerator and denominator from \frac{numerator}{denominator}
                            const fracMatch = match.match(/\\frac\{([^}]*)\}\{([^}]*)\}/);
                            if (fracMatch) {
                              const numerator = fracMatch[1];
                              const denominator = fracMatch[2];
                              return `${numerator}/${denominator}`;
                            }
                            return match;
                          }).replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '')}
                        </div>
                      ) : (
                        // For non-Arabic content, render as plain text
                        <div 
                          className="text-sm font-medium"
                          style={{ 
                            wordBreak: 'break-word', 
                            overflowWrap: 'anywhere',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'Arial, sans-serif',
                            fontSize: '14px',
                            lineHeight: '1.5'
                          }}
                        >
                      {option}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with score */}
      <div className="text-center mb-6 flex-shrink-0">
        <div className="mb-4">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
            score >= 80 ? 'bg-green-100 dark:bg-green-800' : 
            score >= 60 ? 'bg-yellow-100 dark:bg-yellow-800' : 'bg-red-100 dark:bg-red-800'
          }`}>
            <Trophy className={`h-10 w-10 ${
              score >= 80 ? 'text-green-600 dark:text-green-400' : 
              score >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
            }`} />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-2">Assessment Review</h3>
          <p className="text-3xl font-bold text-foreground mb-2">{score}%</p>
          <p className="text-foreground mb-4">
            {score >= 80 ? 'Excellent work!' : 
             score >= 60 ? 'Good job!' : 'Keep practicing!'}
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-foreground">
            <Badge variant="outline">{assessment.subject}</Badge>
            <Badge variant="secondary">{assessment.grade}</Badge>
            <Badge variant="outline">{assessment.difficulty}</Badge>
          </div>
        </div>
      </div>
      
      {/* Questions review */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="space-y-4">
          {questions.length > 0 ? questions.map((question, index) => renderQuestionReview(question, index)) : (
            <div className="text-center py-8 text-muted-foreground">
              <div>
                <FileCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-sm">No questions found in assessment content</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Close button */}
      <div className="mt-6 flex justify-center flex-shrink-0">
        <Button onClick={onClose} variant="outline" className="px-8">
          Close Review
        </Button>
      </div>
    </div>
  );
};

// Add this component before the main StartLearning component
const QuizWithInputs = ({ content, onAnswerChange, studentAnswers }) => {
  const [answers, setAnswers] = useState(studentAnswers || {});
  
  const handleInputChange = (questionId, value) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    if (onAnswerChange) {
      onAnswerChange(questionId, value);
    }
  };

  // Process content to replace [Provide your answer here] with input fields
  const processContent = (content) => {
    const lines = content.split('\n');
    let questionCounter = 0;
    let processedContent = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('[Provide your answer here]')) {
        questionCounter++;
        const questionId = `question_${questionCounter}`;
        
        // Add the line without the placeholder
        processedContent += line.replace('[Provide your answer here]', '') + '\n';
        
        // Add a special marker for input field
        processedContent += `<!--INPUT_FIELD_${questionId}-->` + '\n';
      } else {
        processedContent += line + '\n';
      }
    }
    
    return { processedContent, questionCounter };
  };

  const { processedContent, questionCounter } = processContent(content);

  // Custom markdown component that handles input fields
  const CustomMarkdown = ({ content }) => {
    const parts = content.split(/(<!--INPUT_FIELD_question_\d+-->)/g);
    const isArabic = /[\u0600-\u06FF\u0750-\u077F]/.test(content);
    
    return (
      <div 
        className="space-y-4"
        dir={isArabic ? 'rtl' : 'ltr'}
        style={isArabic ? { direction: 'rtl', textAlign: 'right', unicodeBidi: 'embed' } : {}}
      >
        {parts.map((part, index) => {
          if (part.match(/<!--INPUT_FIELD_question_(\d+)-->/)) {
            const questionId = part.match(/<!--INPUT_FIELD_question_(\d+)-->/)[1];
            const fullQuestionId = `question_${questionId}`;
            
            return (
              <div key={index} className="my-4">
                <Textarea
                  placeholder="Type your answer here..."
                  value={answers[fullQuestionId] || ''}
                  onChange={(e) => handleInputChange(fullQuestionId, e.target.value)}
                  className="min-h-[100px] w-full"
                  dir={isArabic ? 'rtl' : 'ltr'}
                  style={isArabic ? { direction: 'rtl', textAlign: 'right' } : {}}
                />
              </div>
            );
          } else if (part.trim()) {
            return (
              <ReactMarkdown 
                key={index} 
                remarkPlugins={[remarkGfm, remarkMath]} 
                rehypePlugins={[rehypeKatex, rehypeRaw]}
                components={MarkdownStyles}
              >
                {part}
              </ReactMarkdown>
            );
          }
          return null;
        })}
      </div>
    );
  };

  return <CustomMarkdown content={processedContent} />;
};

export default function StartLearning({ 
  isOpen, 
  onClose, 
  content, 
  onComplete,
  studentProgress = null
}) {
  
  
  const contentId = content?.id || content?._id;
  const contentType = content?.resourceType || content?.type || content?.contentType;
  


  // Show loading state if no content but dialog is open
  if (!content) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-black dark:text-white">Loading content...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!contentId || !contentType) {
    console.error('Missing required fields:', { contentId, contentType, content });
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <p className="text-red-600">Missing content ID or type. Please try again.</p>
            <p className="text-xs text-black dark:text-white mt-2">
              ContentId: {contentId || 'undefined'}<br/>
              ContentType: {contentType || 'undefined'}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState({
    currentStep: 0,
    totalSteps: 1,
    percentage: 0,
    timeSpent: 0,
    lastAccessedAt: new Date()
  });
  const [studentAnswers, setStudentAnswers] = useState({});
  const [assessmentAnswers, setAssessmentAnswers] = useState({});
  const [assessmentScore, setAssessmentScore] = useState(null);
  const [showScore, setShowScore] = useState(false);
  const [assessmentResults, setAssessmentResults] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (content && isOpen && contentId && contentType) {
    
      
      setStartTime(Date.now());
      calculateTotalSteps();
      
      // Check completion status from multiple sources
      const isContentCompleted = studentProgress?.status === 'completed' || 
                               content?.progress?.status === 'completed' ||
                               content?.progress?.completedAt ||
                               studentProgress?.completedAt ||
                               (content?.progress && content.progress.status === 'completed');
      
    
      
      setIsCompleted(isContentCompleted);
      
      if (studentProgress && studentProgress.progress) {
        setProgress(studentProgress.progress);
        setCurrentStep(studentProgress.progress.currentStep);
        
        // Load stored answers for completed assessments
        if (isContentCompleted && studentProgress.completionData?.answers) {
          console.log('Loading stored answers for review:', studentProgress.completionData.answers);
          setStudentAnswers(studentProgress.completionData.answers);
          
          // Set assessment results for review
          if (studentProgress.completionData.score !== undefined) {
            setAssessmentResults({
              score: studentProgress.completionData.score,
              correctAnswers: studentProgress.completionData.correctAnswers || 0,
              totalQuestions: studentProgress.completionData.totalQuestions || 0,
              answers: studentProgress.completionData.answers || {},
              evaluationResults: studentProgress.completionData.evaluationResults || {}
            });
            setShowScore(true);
          }
        }
      } else if (content.progress) {
        setProgress(content.progress);
        setCurrentStep(content.progress?.currentStep || 0);
      }
    }
  }, [content, isOpen, studentProgress, contentId, contentType]);

  const calculateTotalSteps = () => {
    if (!content) return;
    
    switch (content.type) {
      case 'comic':
        setProgress(prev => ({
          ...prev,
          totalSteps: content.panels?.length || content.imageUrls?.length || content.images?.length || 1
        }));
        break;
      case 'assessment':
        // Parse assessment questions to get total count
        try {
          const assessmentData = JSON.parse(content.generatedContent || '{}');
          const questions = assessmentData.questions || [];
          setProgress(prev => ({
            ...prev,
            totalSteps: questions.length || 1
          }));
        } catch {
          setProgress(prev => ({ ...prev, totalSteps: 1 }));
        }
        break;
      default:
        setProgress(prev => ({ ...prev, totalSteps: 1 }));
    }
  };

  const updateProgress = async (step, completed = false) => {
    if (!content || (!content.id && !content._id)) {
      console.error('Content missing ID field:', content);
      return;
    }

    const contentId = content.id || content._id;
    const contentType = content.type;
    
    // Calculate time spent in this session
    const sessionTimeSpent = Math.round((Date.now() - startTime) / 60000); // minutes
    
    // Get existing time spent from previous sessions
    const existingTimeSpent = progress.timeSpent || 0;
    
    const newProgress = {
      currentStep: step,
      totalSteps: progress.totalSteps,
      percentage: Math.round((step / progress.totalSteps) * 100),
      timeSpent: existingTimeSpent + sessionTimeSpent,
      lastAccessedAt: new Date()
    };

    setProgress(newProgress);

    // Update progress in database - Use server action instead of direct fetch
    try {
      await updateStudentProgress(contentId, {
        contentType: contentType,
        contentTitle: content.title,
        subject: content.subject,
        grade: content.grade,
        timeSpent: newProgress.timeSpent,
        timeToComplete: sessionTimeSpent,
        status: completed ? 'completed' : 'in_progress'
      });
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const handleNext = () => {
    if (currentStep < progress.totalSteps - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      updateProgress(nextStep);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      updateProgress(prevStep);
    }
  };

  const handleComplete = async () => {
    if (!content || (!content.id && !content._id)) {
      console.error('No content ID available for completion');
      return;
    }

    setIsLoading(true);
    try {
      const timeSpent = Math.round((Date.now() - startTime) / 60000); // minutes
      const contentId = content.id || content._id;
      
      // Use the action.js function directly instead of API call
      await updateStudentProgress(contentId, {
        contentType: content.type || content.contentType,
        contentTitle: content.title,
        subject: content.subject,
        grade: content.grade,
        timeSpent: timeSpent,
        timeToComplete: timeSpent
      });

      setIsCompleted(true);
      
      // Show success message
      toast.success('Content completed successfully! 🎉', {
        description: `You spent ${timeSpent} minutes learning about ${content.title}`
      });

      // Close dialog after a short delay
      setTimeout(() => {
        onClose();
        onComplete && onComplete({ 
          contentId, 
          timeSpent, 
          contentType: content.type || content.contentType 
        });
      }, 1500);

    } catch (error) {
      console.error('Error completing content:', error);
      toast.error('Failed to mark content as complete. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = (questionNumber, answer) => {
    setStudentAnswers(prev => ({
      ...prev,
      [questionNumber]: answer
    }));
  };

  const handleAssessmentSubmit = async (score, correctAnswers, totalQuestions, answers, evaluationResults = {}) => {
    
    setAssessmentScore(score);
    setAssessmentResults({ score, correctAnswers, totalQuestions, answers, evaluationResults });
    setShowScore(true);
    setIsCompleted(true);

    try {
      const timeSpent = Math.round((Date.now() - startTime) / 60000);
      
      // Create a clean, serializable completion data object
      const completionData = {
        contentType: content.type || content.contentType,
        contentTitle: content.title,
        subject: content.subject,
        grade: content.grade,
        timeSpent: timeSpent,
        timeToComplete: timeSpent,
        score: score,
        correctAnswers: correctAnswers,
        totalQuestions: totalQuestions,
        answers: answers ? JSON.parse(JSON.stringify(answers)) : {}, // Deep clone to ensure serializability
        evaluationResults: evaluationResults ? sanitizeEvaluationResults(evaluationResults) : {} // Store sanitized evaluation results
      };

      // Use the action.js function directly instead of API call
      await updateStudentProgress(content.id || content._id, completionData);

      // Show success message
      toast.success(`Assessment completed! Your score: ${score}% 🎉`, {
        description: `You answered ${correctAnswers} out of ${totalQuestions} questions correctly`
      });

      // Close dialog after showing score for a few seconds
      setTimeout(() => {
        onClose();
        // Don't call onComplete here since we already saved progress above
        // onComplete && onComplete({ score, correctAnswers, totalQuestions });
      }, 3000);

    } catch (error) {
      console.error('Error saving assessment progress:', error);
      toast.error('Failed to save assessment results. Please try again.');
    }
  };

  const renderContentPreview = () => {
    // Show review screen for completed assessments
    if (content.resourceType === 'assessment' && showScore && assessmentResults && showReview) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-semibold">Assessment Review</h3>
            <Button 
              onClick={() => setShowReview(false)} 
              variant="outline" 
              size="sm"
            >
              Back to Score
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <AssessmentReview
              assessment={content}
              studentAnswers={assessmentResults.answers || {}}
              score={assessmentResults.score}
              correctAnswers={assessmentResults.correctAnswers}
              totalQuestions={assessmentResults.totalQuestions}
              evaluationResults={assessmentResults.evaluationResults || {}}
              onClose={() => setShowReview(false)}
            />
          </div>
        </div>
      );
    }

    // Show score screen for completed assessments
    if (content.resourceType === 'assessment' && showScore && assessmentResults) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center">
          <div className="mb-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
              assessmentResults.score >= 80 ? 'bg-green-100 dark:bg-green-800' : 
              assessmentResults.score >= 60 ? 'bg-yellow-100 dark:bg-yellow-800' : 'bg-red-100 dark:bg-red-800'
            }`}>
              <Trophy className={`h-10 w-10 ${
                assessmentResults.score >= 80 ? 'text-green-600 dark:text-green-400' : 
                assessmentResults.score >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
              }`} />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-2">Assessment Complete!</h3>
            <p className="text-3xl font-bold text-foreground mb-2">{assessmentResults.score}%</p>
            <p className="text-foreground mb-4">
              {assessmentResults.score >= 80 ? 'Excellent work!' : 
               assessmentResults.score >= 60 ? 'Good job!' : 'Keep practicing!'}
            </p>
            <div className="text-sm text-muted-foreground mb-4">
              <p>Correct: {assessmentResults.correctAnswers} / {assessmentResults.totalQuestions}</p>
            </div>
            <div className="flex items-center justify-center gap-4 text-sm text-foreground">
              <Badge variant="outline">{content.subject}</Badge>
              <Badge variant="secondary">{content.grade}</Badge>
              <Badge variant="outline">{content.difficulty}</Badge>
            </div>
          </div>
          <div className="flex gap-4">
            <Button 
              onClick={() => setShowReview(true)} 
              variant="outline" 
              className="px-6"
            >
              Review Answers
            </Button>
            <Button onClick={onClose} variant="outline" className="px-8">
              Close
            </Button>
          </div>
        </div>
      );
    }

    // Show completion screen for other content types
    if (isCompleted && content.resourceType !== 'assessment') {
      return (
        <div className="h-full flex flex-col items-center justify-center text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">Completed!</h3>
            <p className="text-foreground">You have successfully completed this content.</p>
          </div>
          <Button onClick={onClose} variant="outline" className="px-8">
            Close
          </Button>
        </div>
      );
    }

    // Use resourceType instead of type for the switch statement
    const contentType = content.resourceType || content.type;
    
    switch (contentType) {
      case 'content':
      case 'lesson plan':
        return (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              <ContentPreview
                content={content.generatedContent || content.contentData || content.content}
                metadata={content}
                isEditable={false}
              />
            </div>
            <div className="mt-4 flex justify-center flex-shrink-0">
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Complete
                  </>
                )}
              </Button>
            </div>
          </div>
        );
        
      case 'slides':
        return (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              <PPTXViewer
                presentationUrl={content.presentationUrl || content.url}
                downloadUrl={content.downloadUrl}
                title={content.title}
                slideCount={content.slideCount || content.slidesCount}
                status={content.status || 'SUCCESS'}
                errorMessage={content.errorMessage}
                onSave={() => {
                  // Optional: Add save functionality if needed
                  toast.success('Presentation saved to library!');
                }}
                isSaving={false}
              />
            </div>
            <div className="mt-4 flex justify-center flex-shrink-0">
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Complete
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      
      case 'video':
        return (
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden">
              <VideoPreview
                videoUrl={content.videoUrl || content.url}
                title={content.title}
                slidesCount={content.slidesCount}
                status="completed"
                voiceName={content.voiceName}
                avatarName={content.talkingPhotoName}
                videoId={content.videoId}
                isEditable={false}
              />
            </div>
            <div className="mt-4 flex justify-center flex-shrink-0">
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Complete
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      
      case 'comic':
        console.log('=== COMIC CASE ENTERED ===');
        console.log('Content:', content);
        
        // Check if this is a comic lesson
        if (content.resourceType === 'comic' || content.contentType === 'comic') {
          console.log('=== COMIC CONDITION PASSED ===');
          
          // Extract comic data based on the exact database schema
          let comicImages = [];
          let comicTexts = [];
          
          // Extract images from imageUrls array (from database schema)
          if (content.imageUrls && Array.isArray(content.imageUrls) && content.imageUrls.length > 0) {
            comicImages = content.imageUrls.filter(Boolean);
            console.log('Extracted from imageUrls:', comicImages);
          }
          
          // Extract texts from panelTexts array (from database schema)
          if (content.panelTexts && Array.isArray(content.panelTexts) && content.panelTexts.length > 0) {
            comicTexts = content.panelTexts.map((panelText, index) => {
              // Handle the exact database schema: {index: 1, text: "..."}
              if (panelText && panelText.text) {
                return panelText.text;
              }
              return `Panel ${index + 1} text not available`;
            });
            console.log('Extracted comicTexts:', comicTexts);
          }
          
          // Fallback: try cloudinaryPublicIds if imageUrls is empty
          if (comicImages.length === 0 && content.cloudinaryPublicIds && Array.isArray(content.cloudinaryPublicIds) && content.cloudinaryPublicIds.length > 0) {
            comicImages = content.cloudinaryPublicIds
              .filter(Boolean)
              .map(id => {
                if (id.startsWith('http')) {
                  return id;
                }
                return `https://res.cloudinary.com/demo/image/upload/${id}`;
              });
            console.log('Extracted from cloudinaryPublicIds:', comicImages);
          }
          
          console.log('Final comicImages:', comicImages);
          console.log('Final comicTexts:', comicTexts);
          
          if (comicImages.length === 0) {
            console.log('No comic images found, showing fallback');
            return (
              <div className="text-center py-8 text-foreground h-full flex items-center justify-center">
                <div>
                  <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-sm">No comic panels available</p>
                </div>
              </div>
            );
          }

          console.log('Rendering comic with', comicImages.length, 'images');
          return (
            <div className="h-full flex flex-col">
              <div className="text-center mb-4 flex-shrink-0">
                <h3 className="text-lg font-semibold">{content.title}</h3>
                <p className="text-sm text-muted-foreground">{content.topic || content.instruction || content.lessonDescription}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {comicImages.length} panel{comicImages.length !== 1 ? 's' : ''}
                </p>
                {content.comicType && (
                  <Badge variant="outline" className="mt-2">
                    {content.comicType}
                  </Badge>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <CarouselWithControls
                  items={comicImages.map((url, i) => ({ 
                    url, 
                    index: i + 1,
                    text: comicTexts[i] || content.instruction || content.lessonDescription || content.topic || `Panel ${i + 1} - No description available`
                  }))}
                  className="h-full"
                  renderItem={(panel) => (
                    <div className="rounded-lg border overflow-hidden bg-gradient-to-br from-background to-muted/10 flex flex-col h-full">
                      {/* Panel Image */}
                      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
                        <img 
                          src={panel.url} 
                          alt={`Panel ${panel.index}`} 
                          className="max-h-full max-w-full object-contain rounded-lg shadow-sm" 
                          loading="lazy"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const fallbackDiv = document.createElement('div');
                            fallbackDiv.className = 'text-center py-8 text-foreground';
                            fallbackDiv.innerHTML = `
                              <div>
                                <svg class="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                <p class="text-sm">Panel ${panel.index} failed to load</p>
                              </div>
                            `;
                            e.target.parentNode.appendChild(fallbackDiv);
                          }}
                        />
                      </div>
                      
                      {/* Panel Text - Using the exact database schema */}
                      <div className="bg-muted/50 border-t p-4 flex-shrink-0">
                        <div className="text-center mb-3">
                          <Badge variant="secondary" className="text-sm px-3 py-1">
                            Panel {panel.index}
                          </Badge>
                        </div>
                        <p className="text-base text-foreground leading-relaxed text-center">
                          {panel.text}
                        </p>
                      </div>
                    </div>
                  )}
                />
              </div>
              <div className="mt-4 flex justify-center flex-shrink-0">
                <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark as Complete
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        } else {
          console.log('=== COMIC CONDITION FAILED ===');
        }
        
        // Fallback for non-comic content
        return (
          <div className="text-center py-8 text-foreground h-full flex items-center justify-center">
            <div>
              <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-sm">Comic content not available</p>
            </div>
          </div>
        );
      
      case 'image':
        // Check if this is an image lesson
        if (content.resourceType === 'image' || content.contentType === 'image') {
          // Find the best available image source
          let imageUrl = null;
          
          // Priority order: imageUrl > cloudinaryPublicId > imageBase64 > content base64
          if (content.imageUrl) {
            imageUrl = content.imageUrl;
          } else if (content.cloudinaryPublicId) {
            if (content.cloudinaryPublicId.startsWith('http')) {
              imageUrl = content.cloudinaryPublicId;
            } else {
              imageUrl = `https://res.cloudinary.com/demo/image/upload/${content.cloudinaryPublicId}`;
            }
          } else if (content.imageBase64) {
            imageUrl = `data:image/png;base64,${content.imageBase64}`;
          } else if (content.content && typeof content.content === 'string' && content.content.includes('data:image')) {
            const base64Match = content.content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/);
            if (base64Match) {
              imageUrl = base64Match[0];
            }
          }

          return (
            <div className="h-full flex flex-col">
              <div className="text-center mb-4 flex-shrink-0">
                <h3 className="text-lg font-semibold">{content.title}</h3>
                <p className="text-sm text-muted-foreground">{content.topic || content.instruction || content.description}</p>
                {content.visualType && (
                  <Badge variant="outline" className="mt-2">
                    {content.visualType}
                  </Badge>
                )}
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <div className="flex flex-col h-full">
                  <div className="flex-1 min-h-0 flex items-center justify-center p-4">
                    <div className="relative max-w-full max-h-full">
                      {imageUrl ? (
                        <img 
                          src={imageUrl} 
                          alt={content.title}
                          className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                          loading="lazy"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const fallbackDiv = document.createElement('div');
                            fallbackDiv.className = 'text-center py-8 text-foreground';
                            fallbackDiv.innerHTML = `
                              <div>
                                <svg class="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                                <p class="text-sm">Image failed to load</p>
                                <p class="text-xs text-muted-foreground mt-2">
                                  URL: ${imageUrl ? imageUrl.substring(0, 50) + '...' : 'Not provided'}
                                </p>
                              </div>
                            `;
                            e.target.parentNode.appendChild(fallbackDiv);
                          }}
                        />
                      ) : (
                        <div className="text-center py-8 text-foreground">
                          <Image className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                          <p className="text-sm">No image data available</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {content.instructions && (
                    <div className="p-4 bg-muted/50 border-t">
                      <p className="text-sm text-muted-foreground">{content.instructions}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 flex justify-center flex-shrink-0">
                <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark as Complete
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        }
      
        // Fallback for non-image content
        return (
          <div className="text-center py-8 text-foreground h-full flex items-center justify-center">
            <div>
              <Image className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-sm">Image content not available</p>
            </div>
          </div>
        );
      
      case 'assessment':
        return (
          <div className="h-full overflow-hidden">
            <InteractiveAssessment
              assessment={content}
              onAnswerChange={handleAnswerChange}
              studentAnswers={studentAnswers}
              onSubmit={handleAssessmentSubmit}
              hideSolutions={true}
            />
          </div>
        );
      
      case 'worksheet':
      case 'quiz':
        // Check if this is a proper interactive worksheet/quiz or just content
        const hasInteractiveQuestions = (content) => {
          if (!content) return false;
          
          console.log('=== CHECKING INTERACTIVE QUESTIONS ===');
          console.log('Content to check:', content.substring(0, 500));
          
          // Look for question patterns - including markdown bold format
          const questionPatterns = [
            /^\d+\./,                    // 1. Question
            /^[A-Z]\./,                  // A. Question  
            /^Question\s*\d*:?/i,        // Question 1:
            /^السؤال\s*\d*:?/i,          // Arabic Question
            /^\*\*\d+\./,                // **1. Question format
            /^\*\*[A-Z]\./,              // **A. Question format
            /^\*\*[أ-ي]\./,              // **Arabic. Question format
          ];
          
          // Look for MULTIPLE CHOICE option patterns (A), B), C), D) format)
          const optionPatterns = [
            /^[A-D]\)/,                  // A), B), C), D)
            /^[A-D]\./,                  // A., B., C., D.
            /^[أ-ي]\)/,                  // Arabic letters with )
            /^[أ-ي]\./,                  // Arabic letters with .
          ];
          
          const lines = content.split('\n');
          let hasQuestions = false;
          let hasMultipleChoiceOptions = false;
          let hasAnswerKey = false;
          
          console.log('Total lines to check:', lines.length);
          
          for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].trim();
            console.log(`Line ${i}:`, trimmedLine);
            
            if (questionPatterns.some(pattern => pattern.test(trimmedLine))) {
              hasQuestions = true;
              console.log('Found question at line', i, ':', trimmedLine);
            }
            
            // Only count as options if they're actual multiple choice options (A), B), C), D))
            if (optionPatterns.some(pattern => pattern.test(trimmedLine))) {
              hasMultipleChoiceOptions = true;
              console.log('Found multiple choice option at line', i, ':', trimmedLine);
            }
            
            // Check for answer key sections - if present, treat as traditional quiz content
            if (trimmedLine.includes('Answer Key') || 
                trimmedLine.includes('**Answer Key**') || 
                trimmedLine.includes('**Answers**') || 
                trimmedLine.includes('**Solutions**') ||
                trimmedLine.includes('**Multiple Choice Answers**') ||
                trimmedLine.includes('**Short Answer Explanations**') ||
                trimmedLine.includes('**Problem Solving Explanations**') ||
                trimmedLine.includes('### Answer Key') ||
                trimmedLine.includes('## Answer Key') ||
                trimmedLine.includes('# Answer Key')) {
              hasAnswerKey = true;
              console.log('Found answer key section at line', i, ':', trimmedLine);
            }
          }
          
          console.log('Has questions:', hasQuestions);
          console.log('Has multiple choice options:', hasMultipleChoiceOptions);
          console.log('Has answer key:', hasAnswerKey);
          console.log('Is interactive (has both questions AND multiple choice options AND no answer key):', hasQuestions && hasMultipleChoiceOptions && !hasAnswerKey);
          
          // Only treat as interactive if it has BOTH questions AND multiple choice options AND NO answer key
          // If it has an answer key, it's a traditional quiz that should be displayed as content
          return hasQuestions && hasMultipleChoiceOptions && !hasAnswerKey;
        };
        
        const contentToCheck = content.content || content.generatedContent || content.assessmentContent || '';
        
        if (hasInteractiveQuestions(contentToCheck)) {
          console.log('Treating as interactive assessment');
          // Handle as interactive assessment
          return (
            <div className="h-full overflow-hidden">
              <InteractiveAssessment
                assessment={content}
                onAnswerChange={handleAnswerChange}
                studentAnswers={studentAnswers}
                onSubmit={handleAssessmentSubmit}
                hideSolutions={true}
              />
            </div>
          );
        } else {
          console.log('Treating as content with markdown (traditional quiz format)');
          // Handle as content with markdown rendering and input fields
          return (
            <div className="h-full flex flex-col">
              <div className="text-center mb-4 flex-shrink-0">
                <h3 className="text-lg font-semibold">{content.title}</h3>
                <p className="text-sm text-muted-foreground">{content.topic}</p>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                  <div 
                    dir={/[\u0600-\u06FF\u0750-\u077F]/.test(content.content || content.generatedContent || content.assessmentContent || '') ? 'rtl' : 'ltr'}
                    style={/[\u0600-\u06FF\u0750-\u077F]/.test(content.content || content.generatedContent || content.assessmentContent || '') ? { direction: 'rtl', textAlign: 'right', unicodeBidi: 'embed' } : {}}
                  >
                    <QuizWithInputs 
                      content={content.content || content.generatedContent || content.assessmentContent || ''}
                      onAnswerChange={handleAnswerChange}
                      studentAnswers={studentAnswers}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-center flex-shrink-0">
                <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark as Complete
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        }
      
      case 'external':
      case 'websearch':
        return (
          <div className="h-full flex flex-col">
            <div className="text-center mb-4 flex-shrink-0">
              <h3 className="text-lg font-semibold">{content.title}</h3>
              <p className="text-sm text-muted-foreground">{content.topic}</p>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="prose prose-sm dark:prose-invert max-w-none pr-4">
                <div 
                  dir={/[\u0600-\u06FF\u0750-\u077F]/.test(content.searchResults || content.generatedContent || content.content || '') ? 'rtl' : 'ltr'}
                  style={/[\u0600-\u06FF\u0750-\u077F]/.test(content.searchResults || content.generatedContent || content.content || '') ? { direction: 'rtl', textAlign: 'right', unicodeBidi: 'embed' } : {}}
                >
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkMath]} 
                    rehypePlugins={[rehypeKatex, rehypeRaw]} 
                    components={MarkdownStyles}
                  >
                    {content.searchResults || content.generatedContent || content.content || ''}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-center flex-shrink-0">
              <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Complete
                  </>
                )}
              </Button>
            </div>
          </div>
        );
      
      default:
        return (
          <div className="text-center py-8 text-foreground h-full flex items-center justify-center">
            <div>
              <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-sm">Content type not supported: {contentType}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Available content: {content?.content?.substring(0, 100)}...
              </p>
            </div>
          </div>
        );
    }
  };

  const renderNavigation = () => {
    if (isCompleted || content.resourceType === 'assessment') {
      return null;
    }

    return (
      <div className="flex items-center justify-between p-4 border-t">
        <Button 
          variant="outline" 
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          Previous
        </Button>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {progress.totalSteps}
          </span>
          <Badge variant="outline" className="ml-2">
            {contentTypes[content.resourceType || content.type]?.label}
          </Badge>
        </div>
        
        <Button 
          onClick={handleNext}
          disabled={currentStep >= progress.totalSteps - 1}
        >
          Next
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[80vw] md:max-w-[1024px] max-h-[90vh] p-2 overflow-y-auto">
        <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span className="text-foreground">{isCompleted ? 'Review Content' : 'Learning Mode'}</span>
              <Badge variant="outline" className="ml-2">
                {contentTypes[content.resourceType || content.type]?.label}
              </Badge>
              {isCompleted && (
                <Badge className="bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Completed
                </Badge>
              )}
            </div>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {isCompleted ? 'Review your completed learning content' : 'Learn and interact with the content below'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 p-6">
          <div className="h-full flex flex-col">
            <div className="flex-1 min-h-0">
              {renderContentPreview()}
            </div>
          </div>
        </div>
        
        {renderNavigation()}
      </DialogContent>
    </Dialog>
  );
}
