import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Smart string comparison function for fallback evaluation
function smartStringComparison(studentAnswer, correctAnswer) {
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
}

// Check if OpenAI API key is available - try both possible variable names
const apiKey = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
if (!apiKey) {
  console.warn('OpenAI API key not found. AI evaluation will be disabled.');
  console.warn('Checked for: OPENAI_API_KEY and NEXT_PUBLIC_OPENAI_API_KEY');
} else {
  console.log('OpenAI API key found, semantic evaluation enabled');
}

const openai = apiKey ? new OpenAI({ apiKey }) : null;

export async function POST(request) {
  try {
    const { question, correctAnswer, studentAnswer, language = 'English' } = await request.json();
    

    // Validate required fields
    if (!question || !correctAnswer || !studentAnswer) {
      return NextResponse.json(
        { error: 'Missing required fields: question, correctAnswer, studentAnswer' },
        { status: 400 }
      );
    }

    // Skip evaluation if student answer is empty
    if (!studentAnswer.trim()) {
      return NextResponse.json({
        isCorrect: false,
        explanation: 'No answer provided'
      });
    }

    // If OpenAI is not available, fall back to smart string comparison
    if (!openai) {
      const isCorrect = smartStringComparison(studentAnswer, correctAnswer);
      return NextResponse.json({
        isCorrect,
        explanation: isCorrect 
          ? 'Answer matches the correct answer' 
          : 'Answer does not match the correct answer',
        fallback: true,
        method: 'smart_string_comparison'
      });
    }

    // Create the evaluation prompt
    const prompt = `You are an expert educational evaluator. Your task is to determine if a student's answer has the same meaning as the correct answer for a given question.

Question: ${question}
Correct Answer: ${correctAnswer}
Student Answer: ${studentAnswer}
Language: ${language}

Instructions:
1. Compare the semantic meaning of the student's answer with the correct answer
2. Consider synonyms, different phrasings, and equivalent expressions
3. For mathematical answers, ensure numerical values and concepts match
4. For factual answers, check if the core information is the same
5. Ignore minor spelling errors unless they change the meaning
6. Be lenient with grammar and sentence structure as long as meaning is preserved

Respond with ONLY "true" or "false" based on whether the answers have the same meaning.

Examples:
- Correct: "Photosynthesis" vs Student: "The process where plants make food using sunlight" → true
- Correct: "42" vs Student: "forty-two" → true  
- Correct: "Paris" vs Student: "London" → false
- Correct: "The capital of France" vs Student: "France's main city" → true

Your evaluation:`;

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert educational evaluator. Always respond with only 'true' or 'false' based on semantic similarity."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 10
    });

    const response = completion.choices[0]?.message?.content?.trim().toLowerCase();
    const isCorrect = response === 'true';

    // Generate explanation
    const explanation = isCorrect 
      ? 'Your answer has the same meaning as the correct answer.'
      : 'Your answer does not match the correct answer. Please review the question and try again.';

    return NextResponse.json({
      isCorrect,
      explanation,
      rawResponse: response,
      usedOpenAI: true,
      comparedValues: { question, correctAnswer, studentAnswer },
      method: 'openai_semantic_evaluation'
    });

  } catch (error) {
    console.error('Error in evaluate-answer API:', error);
    
    // Fallback to smart string comparison if OpenAI fails
    // Note: We can't re-read the request body, so we'll use a simple fallback
    return NextResponse.json({
      isCorrect: false,
      explanation: 'Evaluation service temporarily unavailable. Using basic comparison.',
      fallback: true,
      error: error.message,
      method: 'error_fallback'
    });
  }
}
