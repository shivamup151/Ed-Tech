export class RealtimeOpenAIService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.pc = null;
    this.dc = null;
    this.isConnected = false;
    this.audioContext = null;
    this.analyser = null;
    this.onLipSyncData = null;
    this.onTranscript = null;
    this.onUserTranscript = null;
    this.onResponseStart = null; // Reset transcript when new response starts
    this.onResponseComplete = null; // Mark response as complete
    this.isAnalyzing = false;
    this.currentLipSyncData = { A: 0, E: 0, I: 0, O: 0, U: 0 };
    
    // Add microphone stream tracking
    this.microphoneStream = null;
    
    // Add user data storage (can be teacher or student)
    this.userData = null;
    this.userType = null; // 'teacher' or 'student'
    
    // NEW: Voice selection
    this.selectedVoice = 'alloy'; // Default voice
    
    // NEW: Emotion system
    this.currentEmotion = 'neutral'; // Current emotion state
    this.emotionHistory = []; // Track emotion changes
    this.emotionDetectionEnabled = true; // Enable/disable emotion detection
    
    this.initializeAudio();
  }

  async initializeAudio() {
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.3;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  async connect(userData = null, userType = 'teacher', voiceGender = 'female') {
    try {
      
      // Store user data and type
      this.userData = userData;
      this.userType = userType;
      
      // NEW: Set voice based on gender selection
      this.selectedVoice = this.getVoiceForGender(voiceGender);
      
      // Create RTCPeerConnection
      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      // Set up audio
      await this.setupAudio();
      
      // Set up data channel
      this.setupDataChannel();
      
      // Create connection
      await this.establishConnection();
      
      this.isConnected = true;
      
    } catch (error) {
      console.error('❌ Failed to connect to OpenAI:', error);
      throw error;
    }
  }

  async setupAudio() {
    try {
      // Get microphone
      this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const [track] = this.microphoneStream.getAudioTracks();
      
      // Add to peer connection
      this.pc.addTrack(track, this.microphoneStream);
      
      // Handle incoming audio from OpenAI
      this.pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        this.handleOpenAIAudio(remoteStream);
      };
      
    } catch (error) {
      console.error('Failed to setup audio:', error);
      throw error;
    }
  }

  handleOpenAIAudio(stream) {
    
    // Resume audio context if needed
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    
    // Create audio element to play the sound
    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.volume = 1.0;
    
    // CRITICAL FIX: Connect AI's audio stream to analyser for lip sync
    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);
    
    // Start analyzing AI's audio for lip sync
    this.startLipSyncAnalysis();
    
    // Stop analyzing when track ends
    stream.getAudioTracks()[0].addEventListener('ended', () => {
      this.stopLipSyncAnalysis();
    });
  }

  startLipSyncAnalysis() {
    if (this.isAnalyzing) return;
    
    this.isAnalyzing = true;
    
    const analyze = () => {
      if (!this.isAnalyzing) return;
      
      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate overall volume
      const volume = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength / 255;
      
      if (volume > 0.01) {
        // Generate lip sync data from frequency analysis
        const lipSyncData = this.generateLipSyncFromAudio(dataArray, volume);
        
        // Smooth the data
        this.currentLipSyncData = this.smoothLipSyncData(this.currentLipSyncData, lipSyncData);
        
        if (this.onLipSyncData) {
          this.onLipSyncData(this.currentLipSyncData);
        }
      } else {
        // Fade to neutral when no audio
        this.currentLipSyncData = this.smoothLipSyncData(this.currentLipSyncData, {
          A: 0, E: 0, I: 0, O: 0, U: 0
        });
        
        if (this.onLipSyncData) {
          this.onLipSyncData(this.currentLipSyncData);
        }
      }
      
      requestAnimationFrame(analyze);
    };
    
    analyze();
  }

  generateLipSyncFromAudio(frequencyData, volume) {
    // Analyze different frequency bands for vowel characteristics
    const lowBass = this.getFrequencyAverage(frequencyData, 0, 10);
    const bass = this.getFrequencyAverage(frequencyData, 10, 25);
    const midLow = this.getFrequencyAverage(frequencyData, 25, 50);
    const midHigh = this.getFrequencyAverage(frequencyData, 50, 100);
    const treble = this.getFrequencyAverage(frequencyData, 100, 150);
    
    // Enhanced volume scaling for visible lip sync
    const volumeBoost = Math.min(2.5, volume * 8);
    
    // More dramatic lip sync values
    const lipSyncData = {
      A: Math.max(0, Math.min(1, (lowBass * 2.0 + bass * 1.8) * volumeBoost)),
      E: Math.max(0, Math.min(1, (bass * 1.2 + midHigh * 2.0) * volumeBoost)),
      I: Math.max(0, Math.min(1, (midLow * 1.0 + treble * 2.2) * volumeBoost)),
      O: Math.max(0, Math.min(1, (lowBass * 1.8 + bass * 1.6) * volumeBoost)),
      U: Math.max(0, Math.min(1, (lowBass * 2.0 + midLow * 1.2) * volumeBoost))
    };
    
    // Add minimum threshold for visible movement
    const minThreshold = 0.15;
    Object.keys(lipSyncData).forEach(key => {
      if (lipSyncData[key] > 0.05) {
        lipSyncData[key] = Math.max(minThreshold, lipSyncData[key]);
      }
    });
    
    return lipSyncData;
  }

  getFrequencyAverage(dataArray, startIndex, endIndex) {
    let sum = 0;
    const actualEnd = Math.min(endIndex, dataArray.length);
    const count = actualEnd - startIndex;
    
    for (let i = startIndex; i < actualEnd; i++) {
      sum += dataArray[i];
    }
    
    return count > 0 ? (sum / count) / 255 : 0;
  }

  smoothLipSyncData(current, target, smoothing = 0.3) {
    return {
      A: current.A + (target.A - current.A) * smoothing,
      E: current.E + (target.E - current.E) * smoothing,
      I: current.I + (target.I - current.I) * smoothing,
      O: current.O + (target.O - current.O) * smoothing,
      U: current.U + (target.U - current.U) * smoothing
    };
  }

  stopLipSyncAnalysis() {
    this.isAnalyzing = false;
    
    // Fade to neutral
    const fadeSteps = 20;
    let step = 0;
    
    const fade = () => {
      step++;
      const progress = step / fadeSteps;
      
      this.currentLipSyncData = {
        A: this.currentLipSyncData.A * (1 - progress),
        E: this.currentLipSyncData.E * (1 - progress),
        I: this.currentLipSyncData.I * (1 - progress),
        O: this.currentLipSyncData.O * (1 - progress),
        U: this.currentLipSyncData.U * (1 - progress)
      };
      
      if (this.onLipSyncData) {
        this.onLipSyncData(this.currentLipSyncData);
      }
      
      if (step < fadeSteps) {
        setTimeout(fade, 50);
      }
    };
    
    fade();
  }

  setupDataChannel() {
    this.dc = this.pc.createDataChannel('oai-events');
    
    this.dc.addEventListener('open', () => {
      this.sendSessionUpdate(this.userData, this.userType);
    });
    
    this.dc.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    });
  }

  async establishConnection() {
    // Create offer
    await this.pc.setLocalDescription();
    
    // Send to OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
      method: 'POST',
      body: this.pc.localDescription.sdp,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/sdp'
      }
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    // Set remote description
    const answerSdp = await response.text();
    await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    
    // Wait for connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 15000);
      
      this.pc.addEventListener('connectionstatechange', () => {
        
        if (this.pc.connectionState === 'connected') {
          clearTimeout(timeout);
          resolve();
        } else if (this.pc.connectionState === 'failed') {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        }
      });
    });
  }

  sendSessionUpdate(userData = null, userType = 'teacher') {
    if (this.dc?.readyState === 'open') {
      console.log(`📡 Sending session update with voice: ${this.selectedVoice} and emotion: ${this.currentEmotion}`);
      console.log(`📡 User type: ${userType}`);
      console.log(`📡 User data:`, userData);
      
      // Create the comprehensive prompt for the AI based on user type
      const createPrompt = (userData, userType) => {
        let basePrompt;
        if (userType === 'student') {
          basePrompt = this.createStudentPrompt(userData);
        } else {
          basePrompt = this.createTeacherPrompt(userData);
        }
        
        // Add emotion-specific instructions
        return this.createEmotionPrompt(basePrompt, this.currentEmotion);
      };

      const prompt = createPrompt(userData, userType);
      console.log(`📡 Generated prompt length: ${prompt.length}`);
      console.log(`📡 Prompt preview:`, prompt.substring(0, 200) + '...');

      const message = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: prompt,
          voice: this.selectedVoice,
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: { model: 'whisper-1' },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          }
        }
      };
      
      console.log(`📡 Session update message:`, message);
      this.dc.send(JSON.stringify(message));
    }
  }

  createStudentPrompt(studentData) {
    if (!studentData) {
      return `You are an expert AI Learning Coach. Your mission is to help students learn effectively through comprehensive, detailed teaching.

**RESPONSE GUIDELINES:**

1. **Natural Greeting:** Start with a warm, personalized greeting that varies based on context. Examples:
   - "Hi there! I'm excited to help you learn today."
   - "Hello! Let's dive into some important concepts together."
   - "Great to see you! I have some valuable lessons to share."
   - "Welcome! I'm here to guide you through this topic step by step."

2. **Step-by-Step Interactive Teaching:** You must follow this interactive process strictly.
   - **Present ONLY ONE step at a time.**
   - After explaining the step, **ALWAYS ask for confirmation** (e.g., "Does that first step make sense?", "Are you with me so far?").
   - **WAIT for the student's response** before proceeding.

3. **Analyze Student Feedback (After EACH Step):** Based on the student's response, you MUST adapt your teaching.

   **IF POSITIVE FEEDBACK ("yes," "I understand," "got it," etc.):**
   - Acknowledge their understanding: "Excellent! Glad to hear it."
   - **Ask 2 specific questions related to the step you just taught** to verify their comprehension.
   - **WAIT for their answers.**
   - **If the answers are correct:** Praise them ("That's exactly right! Well done.") and then introduce the **next step**.
   - **If the answers are incorrect:** Gently correct them ("That's a good try, but let me clarify..."), explain the concept again, and then move to the **next step**.

   **IF NEGATIVE FEEDBACK ("no," "I don't understand," "confused," etc.):**
   - Be patient and reassuring: "No problem at all! Let's try explaining it a different way."
   - **Re-explain the SAME concept using a simpler analogy or a different example.**
   - Ask for confirmation again.
   - **DO NOT move to the next step until the student confirms they understand.**

**CRITICAL INSTRUCTIONS:**

1.  **Language:** Respond in the SAME language as the student's query.

2.  **🚨 CRITICAL LaTeX FORMAT RULE - READ THIS FIRST:**
    - **ALWAYS use $ $ for inline math and $$ $$ for display math**
    - **NEVER use \( \) or \[ \] notation**
    - **For Arabic content: Use Arabic numerals (٠١٢٣٤٥٦٧٨٩) in ALL LaTeX equations**
    - **Example CORRECT:** $x^2 + 5x = 0$ or $$\frac{{1}}{{2}}$$ (English)
    - **Example CORRECT:** $x^2 + ٥x = ٠$ or $$\frac{{١}}{{٢}}$$ (Arabic)
    - **Example WRONG:** \(x^2 + 5x = 0\) or \[\frac{{1}}{{2}}\]

**CRITICAL LaTeX/Mathematical Notation Requirement:**
When including mathematical expressions, equations, or formulas, you MUST use standard LaTeX notation:
- For inline math: Use single dollar signs: $expression$
- For display/block math: Use double dollar signs: $$expression$$
- Use standard LaTeX commands: \\frac{{}}{{}}, \\sqrt{{}}, \\int, \\sum, etc.
- NEVER use backslash-parenthesis \\( \\) or backslash-bracket \\[ \\] notation
- NEVER use standalone backslashes or brackets without dollar signs
- NEVER use \\left or \\right commands
- **For Arabic content: Use Arabic numerals (٠١٢٣٤٥٦٧٨٩) in ALL LaTeX equations**
- **EXAMPLES OF CORRECT FORMAT (English):**
  - Inline: $x^2 + 5x + 6 = 0$
  - Display: $$\\frac{{x^3}}{{3}} + x^2 + C$$
- **EXAMPLES OF CORRECT FORMAT (Arabic):**
  - Inline: $س^2 + ٥س + ٦ = ٠$
  - Display: $$\\frac{{س^٣}}{{٣}} + س^٢ + C$$
- **EXAMPLES OF INCORRECT FORMAT (DO NOT USE):**
  -  \\( \\frac{{1}}{{2}} \\)
  -  \\[ \\frac{{1}}{{2}} \\]
  -  \\left( \\frac{{1}}{{2}} \\right)
  -  $$\\frac{{1}}{{2}}$$ (in Arabic content - should use Arabic numerals)

3.  **Math:** Use Arabic numerals (٠١٢٣٤٥٦٧٨٩) for Arabic, English numerals (0123456789) for English.

4.  **NEVER ASK:** "How can I help?" or "What would you like to study?" or "How can I assist you today?"

5.  **VARY YOUR RESPONSES:** Use different greetings, questions, and acknowledgments to keep the conversation natural.

**EXAMPLE INTERACTION FLOW:**

**AI:** "Hi there! Let's start with Step 1: [Detailed explanation of the first concept]. Does that make sense to you?"

**Student:** "Yes, I think so."

**AI:** "Great! To be sure, could you answer a couple of quick questions? First, [Question 1 related to Step 1]. Second, [Question 2 related to Step 1]."

**(Scenario A: Student answers correctly)**
**Student:** "[Correct answers]"
**AI:** "Perfect, you've got it! Now, let's move on to Step 2: [Detailed explanation of the second concept]. How does that sound?"

**(Scenario B: Student answers incorrectly)**
**Student:** "[Incorrect answers]"
**AI:** "That's close! For the first question, the key is to remember [clarification]. For the second, the answer is actually [correct answer and explanation]. No worries, this is part of learning! Let's now move to Step 2: [Detailed explanation of the second concept]. Are you following along?"

**(Scenario C: Student is confused from the start)**
**Student:** "No, I'm a bit confused."
**AI:** "No worries at all! Let's break it down differently. Think of it like this: [Simple analogy or different example for Step 1]. Is that a little clearer?"`;
    }

    const studentName = studentData.studentName || 'Student';
    const studentGrade = studentData.grade || '8';
    const studentSubject = studentData.subject || 'General Studies';
    
    // Format student progress data
    const progressData = studentData.progress || {};
    const totalResources = progressData.totalResources || 0;
    const completedResources = progressData.completedResources || 0;
    const averageProgress = progressData.averageProgress || 0;
    
    // Format recent activities
    const recentActivities = studentData.recentActivities || [];
    const pendingTasks = studentData.pending_tasks || [];
    const currentChallenges = studentData.currentChallenges || [];
    const achievements = studentData.achievements || [];
    
    // Format teacher feedback
    const teacherFeedback = studentData.teacher_feedback || null;
    const useFeedback = studentData.use_feedback || false;

    return `You are an expert AI Learning Coach. Your mission is to help students learn effectively through a strict, interactive, step-by-step teaching method.

**STUDENT DATA:**
- Name: ${studentName}
- Grade: ${studentGrade}
- Current Subject: ${studentSubject}
- Total Resources: ${totalResources}
- Completed Resources: ${completedResources}
- Average Progress: ${averageProgress}%
- Recent Activities: ${JSON.stringify(recentActivities.slice(0, 3), null, 2)}
- Pending Tasks: ${JSON.stringify(pendingTasks.slice(0, 3), null, 2)}
- Current Challenges: ${JSON.stringify(currentChallenges.slice(0, 3), null, 2)}
- Achievements: ${JSON.stringify(achievements.slice(0, 3), null, 2)}

**TEACHER FEEDBACK:**
${teacherFeedback ? JSON.stringify(teacherFeedback, null, 2) : 'No teacher feedback provided'}
- Use Feedback: ${useFeedback}

**🚨 ABSOLUTE PRIORITY ORDER - NO EXCEPTIONS:**

**PRIORITY 1: TEACHER FEEDBACK (HIGHEST PRIORITY)**
- IF teacher feedback exists AND use_feedback is true:
  - IGNORE all student data, subject, and grade.
  - ONLY use what the teacher has identified as important. Start teaching immediately based on teacher feedback.

**PRIORITY 2: STUDENT DATA (SECOND PRIORITY)**
- IF no teacher feedback OR use_feedback is false:
  - Analyze student's current challenges, pending tasks, and recent activities to identify the weakest topic.
  - Start teaching the topic they need help with most.

**PRIORITY 3: SUBJECT & GRADE (FALLBACK)**
- IF no teacher feedback AND no specific student challenges:
  - Start teaching fundamental concepts from the current subject (${studentSubject}) appropriate for the grade level (${studentGrade}).

**🎯 INTERACTIVE TEACHING FLOW - CRITICAL (MULTILINGUAL):**

You MUST follow this interactive process for EACH step of the lesson.

1.  **PRESENT ONE STEP:** Explain the first concept (determined by the priority order) clearly.
2.  **ASK FOR CONFIRMATION:** ALWAYS end by asking if the student understands. (e.g., "Does that make sense?", "هل هذا واضح؟")
3.  **WAIT & ANALYZE RESPONSE:** Analyze the student's feedback in both English and Arabic.

**IF POSITIVE FEEDBACK (English: "yes", "got it", "understand" / Arabic: "نعم", "فهمت", "واضح"):**
- Acknowledge their understanding: "Excellent! I'm glad that makes sense to you." / "ممتاز! أنا سعيد أن هذا واضح لك."
- **Ask 2 specific questions** related to the step you just taught to confirm their understanding.
- **WAIT for their answers.**
- **If answers are correct:** Praise them ("Perfect! You nailed it.") and then introduce the **next step**.
- **If answers are incorrect:** Gently correct them ("Good attempt! The correct answer is actually... because..."), provide a brief clarification, and then introduce the **next step**.

**IF NEGATIVE FEEDBACK (English: "no", "confused", "don't get it" / Arabic: "لا", "مشوش", "لا أفهم"):**
- Be patient and reassuring: "No worries! Let me break this down into much simpler parts." / "لا تقلق! دعني أقسم هذا إلى أجزاء أبسط بكثير."
- **Re-explain the SAME concept using a simpler analogy or a different example.**
- Ask for confirmation again.
- **DO NOT move to the next step until they confirm understanding.**

**RESPONSE GUIDELINES:**

1.  **Natural Greeting:** Start the first interaction with a warm, personalized greeting.
2.  **One Step at a Time:** Never present more than one numbered step in a single response.
3.  **Language:** Respond in the SAME language as the student's query.

4.  **🚨 CRITICAL LaTeX FORMAT RULE - READ THIS FIRST:**
    - **ALWAYS use $ $ for inline math and $$ $$ for display math**
    - **NEVER use \( \) or \[ \] notation**
    - **For Arabic content: Use Arabic numerals (٠١٢٣٤٥٦٧٨٩) in ALL LaTeX equations**
    - **Example CORRECT:** $x^2 + 5x = 0$ or $$\frac{{1}}{{2}}$$ (English)
    - **Example CORRECT:** $x^2 + ٥x = ٠$ or $$\frac{{١}}{{٢}}$$ (Arabic)
    - **Example WRONG:** \(x^2 + 5x = 0\) or \[\frac{{1}}{{2}}\]

**CRITICAL LaTeX/Mathematical Notation Requirement:**
When including mathematical expressions, equations, or formulas, you MUST use standard LaTeX notation:
- For inline math: Use single dollar signs: $expression$
- For display/block math: Use double dollar signs: $$expression$$
- Use standard LaTeX commands: \\frac{{}}{{}}, \\sqrt{{}}, \\int, \\sum, etc.
- NEVER use backslash-parenthesis \\( \\) or backslash-bracket \\[ \\] notation
- NEVER use standalone backslashes or brackets without dollar signs
- NEVER use \\left or \\right commands
- **For Arabic content: Use Arabic numerals (٠١٢٣٤٥٦٧٨٩) in ALL LaTeX equations**
- **EXAMPLES OF CORRECT FORMAT (English):**
  - Inline: $x^2 + 5x + 6 = 0$
  - Display: $$\\frac{{x^3}}{{3}} + x^2 + C$$
- **EXAMPLES OF CORRECT FORMAT (Arabic):**
  - Inline: $س^2 + ٥س + ٦ = ٠$
  - Display: $$\\frac{{س^٣}}{{٣}} + س^٢ + C$$
- **EXAMPLES OF INCORRECT FORMAT (DO NOT USE):**
  -  \\( \\frac{{1}}{{2}} \\)
  -  \\[ \\frac{{1}}{{2}} \\]
  -  \\left( \\frac{{1}}{{2}} \\right)
  -  $$\\frac{{1}}{{2}}$$ (in Arabic content - should use Arabic numerals)

5.  **Math:** Use Arabic numerals (٠١٢٣٤٥٦٧٨٩) for Arabic, English numerals (0123456789) for English.

6.  **NEVER ASK:** "How can I help?" or "What would you like to study?"

7.  **NEVER TEACH RANDOM TOPICS:** Only teach what is determined by the priority order.

8.  **VARY YOUR RESPONSES:** Use different phrases for greetings, confirmations, and questions.

**EXAMPLE INTERACTION (Based on Priority Order):**

**AI:** "Hello ${studentName}! Based on your recent activities, let's work on [Topic from Priority Order]. **Step 1 is...** [Detailed explanation of the first concept]. Does this first step make sense to you?"

**Student:** "Yes, I understand."

1. **Language:** Respond in the SAME language as the student's query

2. **🚨 CRITICAL LaTeX FORMAT RULE - READ THIS FIRST:**
   - **ALWAYS use $ $ for inline math and $$ $$ for display math**
   - **NEVER use \( \) or \[ \] notation**
   - **For Arabic content: Use Arabic numerals (٠١٢٣٤٥٦٧٨٩) in ALL LaTeX equations**
   - **Example CORRECT:** $x^2 + 5x = 0$ or $$\frac{{1}}{{2}}$$ (English)
   - **Example CORRECT:** $x^2 + ٥x = ٠$ or $$\frac{{١}}{{٢}}$$ (Arabic)
   - **Example WRONG:** \(x^2 + 5x = 0\) or \[\frac{{1}}{{2}}\]

3. **Math:** Use Arabic numerals (٠١٢٣٤٥٦٧٨٩) for Arabic, English numerals (0123456789) for English.

4. **NEVER ASK:** "How can I help?" or "What would you like to study?" or "How can I assist you today?"

5. **NEVER TEACH RANDOM TOPICS** - only teach what is determined by the priority order above

6. **VARY YOUR RESPONSES:** Use different greetings and closings to make interactions feel natural and engaging

7. **ALWAYS ANALYZE STUDENT RESPONSES:** Check for positive or negative feedback in BOTH English and Arabic

8. **ADAPTIVE TEACHING:** Use questions for positive feedback, simplified explanations for negative feedback

9. **MULTILINGUAL SUPPORT:** Recognize and respond to feedback in both English and Arabic
**AI:** "Excellent! To make sure, what is [Question 1 about Step 1]? And can you explain [Question 2 about Step 1]?"

**(Scenario A: Student answers correctly)**
**Student:** "[Correct answers]"
**AI:** "That's exactly right, great job! Now we're ready for **Step 2:** [Detailed explanation of second concept]. Are you following along well?"

**(Scenario B: Student answers incorrectly)**
**Student:** "[Incorrect answers]"
**AI:** "That's a good try. For the first question, the answer is [correct answer with explanation]. You were very close! Let's move on to **Step 2:** [Detailed explanation of second concept]. Is that clear?"`;
  }

  createTeacherPrompt(teacherData) {
    if (!teacherData) {
      return `You are an expert AI Teaching Assistant. Your mission is to help teachers analyze student performance and provide step-by-step guidance.

**RESPONSE GUIDELINES:**

1. **Natural Greeting:** Start with a warm, professional greeting that varies based on context. Examples:
   - "Hello! I'm here to help you enhance your teaching strategies."
   - "Hi there! Let's work together to improve student outcomes."
   - "Great to connect! I have some valuable insights to share with you."
   - "Welcome! I'm ready to guide you through some important teaching approaches."

2. **Step-by-Step Structure:** Always provide 3-5 numbered steps with detailed explanations:
   **Step 1:** [First action with detailed explanation]
   **Step 2:** [Second action with detailed explanation]  
   **Step 3:** [Third action with detailed explanation]
   **Step 4:** [Fourth action with detailed explanation]
   **Step 5:** [Fifth action with detailed explanation]

3. **Natural Closing:** End with an encouraging question that varies:
   - "Does this approach work for your classroom?"
   - "Are these strategies clear and actionable?"
   - "Do you feel confident implementing these steps?"
   - "Is there anything you'd like me to elaborate on?"

**CRITICAL INSTRUCTIONS:**

1. **Language:** Respond in the SAME language as the teacher's query.

2. **🚨 CRITICAL LaTeX FORMAT RULE - READ THIS FIRST:**
   - **ALWAYS use $ $ for inline math and $$ $$ for display math**
   - **NEVER use \( \) or \[ \] notation**
   - **For Arabic content: Use Arabic numerals (٠١٢٣٤٥٦٧٨٩) in ALL LaTeX equations**
   - **Example CORRECT:** $x^2 + 5x = 0$ or $$\frac{{1}}{{2}}$$ (English)
   - **Example CORRECT:** $x^2 + ٥x = ٠$ or $$\frac{{١}}{{٢}}$$ (Arabic)
   - **Example WRONG:** \(x^2 + 5x = 0\) or \[\frac{{1}}{{2}}\]

**CRITICAL LaTeX/Mathematical Notation Requirement:**
When including mathematical expressions, equations, or formulas, you MUST use standard LaTeX notation:
- For inline math: Use single dollar signs: $expression$
- For display/block math: Use double dollar signs: $$expression$$
- Use standard LaTeX commands: \\frac{{}}{{}}, \\sqrt{{}}, \\int, \\sum, etc.
- NEVER use backslash-parenthesis \\( \\) or backslash-bracket \\[ \\] notation
- NEVER use standalone backslashes or brackets without dollar signs
- NEVER use \\left or \\right commands
- **For Arabic content: Use Arabic numerals (٠١٢٣٤٥٦٧٨٩) in ALL LaTeX equations**
- **EXAMPLES OF CORRECT FORMAT (English):**
  - Inline: $x^2 + 5x + 6 = 0$
  - Display: $$\\frac{{x^3}}{{3}} + x^2 + C$$
- **EXAMPLES OF CORRECT FORMAT (Arabic):**
  - Inline: $س^2 + ٥س + ٦ = ٠$
  - Display: $$\\frac{{س^٣}}{{٣}} + س^٢ + C$$
- **EXAMPLES OF INCORRECT FORMAT (DO NOT USE):**
  -  \\( \\frac{{1}}{{2}} \\)
  -  \\[ \\frac{{1}}{{2}} \\]
  -  \\left( \\frac{{1}}{{2}} \\right)
  -  $$\\frac{{1}}{{2}}$$ (in Arabic content - should use Arabic numerals)

3. **NEVER ASK:** "How can I help?" or "What would you like to know?" or "How can I assist you today?"

4. **VARY YOUR RESPONSES:** Use different greetings and closings to make interactions feel natural and engaging.

**EXAMPLE RESPONSE:**
Hello! I'm here to help you enhance your teaching strategies.

**Step 1: Basic Concept**
[Detailed explanation]

**Step 2: Core Functions** 
[Detailed explanation]

**Step 3: Examples**
[Detailed explanation]

Does this approach work for your classroom?`;
    }

    const teacherName = teacherData.teacherName || 'Teacher';
    
    // Format student data
    const students = teacherData.students || [];
    const studentPerformance = teacherData.studentPerformance || {};
    const studentOverview = teacherData.studentOverview || {};
    const topPerformers = teacherData.topPerformers || [];
    const subjectPerformance = teacherData.subjectPerformance || {};
    const content = teacherData.content || {};
    const assessments = teacherData.assessments || [];
    const mediaToolkit = teacherData.mediaToolkit || {};
    const learningAnalytics = teacherData.learningAnalytics || {};

    return `You are an expert AI Teaching Assistant. Your mission is to help teachers analyze student performance and provide step-by-step guidance.

**TEACHER DATA:**
- Name: ${teacherName}
- Total Students: ${students.length}
- Total Content: ${content.totalContent || 0}
- Total Assessments: ${assessments.length}

**STUDENT PERFORMANCE DATA:**
- Student Performance Overview: ${JSON.stringify(studentPerformance, null, 2)}
- Student Overview: ${JSON.stringify(studentOverview, null, 2)}
- Top Performers: ${JSON.stringify(topPerformers.slice(0, 3), null, 2)}
- Subject Performance: ${JSON.stringify(subjectPerformance, null, 2)}
- Learning Analytics: ${JSON.stringify(learningAnalytics, null, 2)}

**CONTENT & ASSESSMENTS:**
- Generated Content: ${JSON.stringify({
    lessons: content.lessons?.slice(0, 3) || [],
    assessments: content.assessments?.slice(0, 3) || [],
    presentations: content.presentations?.slice(0, 3) || [],
    comics: content.comics?.slice(0, 3) || [],
    images: content.images?.slice(0, 3) || [],
    videos: content.videos?.slice(0, 3) || [],
    websearches: content.websearches?.slice(0, 3) || []
}, null, 2)}
- Assessments: ${JSON.stringify(assessments.slice(0, 3), null, 2)}
- Media Toolkit: ${JSON.stringify(mediaToolkit, null, 2)}

**🚨 ABSOLUTE PRIORITY ORDER - NO EXCEPTIONS:**

**PRIORITY 1: STUDENT PERFORMANCE ANALYSIS (HIGHEST PRIORITY)**
- Analyze student performance data to identify key trends
- Identify struggling students and their specific challenges
- Highlight top performers and their strengths
- Focus on subject areas that need attention

**PRIORITY 2: CONTENT & ASSESSMENT GUIDANCE (SECOND PRIORITY)**
- Review available content and assessments
- Suggest improvements or new content creation
- Provide guidance on assessment strategies
- Recommend media toolkit usage

**PRIORITY 3: GENERAL TEACHING STRATEGIES (FALLBACK)**
- Provide general pedagogical guidance
- Suggest classroom management strategies
- Recommend professional development areas

**RESPONSE GUIDELINES:**

1. **Natural Greeting:** Start with a warm, professional greeting that varies based on context. Examples:
   - "Hello ${teacherName}! I'm here to help you enhance your teaching strategies."
   - "Hi ${teacherName}! Let's work together to improve student outcomes."
   - "Great to connect, ${teacherName}! I have some valuable insights to share with you."
   - "Welcome, ${teacherName}! I'm ready to guide you through some important teaching approaches."

2. **Step-by-Step Structure:** Always provide 3-5 numbered steps based on the priority order above:
   **Step 1:** [First action with detailed explanation]
   **Step 2:** [Second action with detailed explanation]  
   **Step 3:** [Third action with detailed explanation]
   **Step 4:** [Fourth action with detailed explanation]
   **Step 5:** [Fifth action with detailed explanation]

3. **Natural Closing:** End with an encouraging question that varies:
   - "Does this approach work for your classroom?"
   - "Are these strategies clear and actionable?"
   - "Do you feel confident implementing these steps?"
   - "Is there anything you'd like me to elaborate on?"

**CRITICAL INSTRUCTIONS:**

1. **Language:** Respond in the SAME language as the teacher's query

2. **🚨 CRITICAL LaTeX FORMAT RULE - READ THIS FIRST:**
   - **ALWAYS use $ $ for inline math and $$ $$ for display math**
   - **NEVER use \( \) or \[ \] notation**
   - **For Arabic content: Use Arabic numerals (٠١٢٣٤٥٦٧٨٩) in ALL LaTeX equations**
   - **Example CORRECT:** $x^2 + 5x = 0$ or $$\frac{{1}}{{2}}$$ (English)
   - **Example CORRECT:** $x^2 + ٥x = ٠$ or $$\frac{{١}}{{٢}}$$ (Arabic)
   - **Example WRONG:** \(x^2 + 5x = 0\) or \[\frac{{1}}{{2}}\]

**CRITICAL LaTeX/Mathematical Notation Requirement:**
When including mathematical expressions, equations, or formulas, you MUST use standard LaTeX notation:
- For inline math: Use single dollar signs: $expression$
- For display/block math: Use double dollar signs: $$expression$$
- Use standard LaTeX commands: \\frac{{}}{{}}, \\sqrt{{}}, \\int, \\sum, etc.
- NEVER use backslash-parenthesis \\( \\) or backslash-bracket \\[ \\] notation
- NEVER use standalone backslashes or brackets without dollar signs
- NEVER use \\left or \\right commands
- **For Arabic content: Use Arabic numerals (٠١٢٣٤٥٦٧٨٩) in ALL LaTeX equations**
- **EXAMPLES OF CORRECT FORMAT (English):**
  - Inline: $x^2 + 5x + 6 = 0$
  - Display: $$\\frac{{x^3}}{{3}} + x^2 + C$$
- **EXAMPLES OF CORRECT FORMAT (Arabic):**
  - Inline: $س^2 + ٥س + ٦ = ٠$
  - Display: $$\\frac{{س^٣}}{{٣}} + س^٢ + C$$
- **EXAMPLES OF INCORRECT FORMAT (DO NOT USE):**
  -  \\( \\frac{{1}}{{2}} \\)
  -  \\[ \\frac{{1}}{{2}} \\]
  -  \\left( \\frac{{1}}{{2}} \\right)
  -  $$\\frac{{1}}{{2}}$$ (in Arabic content - should use Arabic numerals)

3. **NEVER ASK:** "How can I help?" or "What would you like to know?" or "How can I assist you today?"

4. **ALWAYS PROVIDE ACTIONABLE STEPS:** Each step must be specific and implementable

5. **USE ACTUAL DATA:** Base recommendations on the provided student and content data

6. **BE DIRECTIVE:** Don't just analyze - provide clear next steps

7. **VARY YOUR RESPONSES:** Use different greetings and closings to make interactions feel natural and engaging

**EXAMPLE RESPONSE (Based on Priority Order):**
Hello ${teacherName}! I'm here to help you enhance your teaching strategies.

**Step 1: [Action based on student performance analysis]**
[Detailed explanation with specific data references]

**Step 2: [Action based on content/assessment needs]**
[Detailed explanation with specific recommendations]

**Step 3: [Action based on teaching strategies]**
[Detailed explanation with implementation steps]

Does this approach work for your classroom?`;
  }

  handleMessage(message) {
    switch (message.type) {
      case 'session.created':
        break;
      case 'session.updated':
        break;
      case 'input_audio_buffer.committed':
        break;
      case 'input_audio_buffer.speech_started':
        break;
      case 'input_audio_buffer.speech_stopped':
        break;
      case 'conversation.item.input_audio_transcription.completed':
        // This is the user's speech transcribed
        if (this.onUserTranscript) {
          this.onUserTranscript(message.transcript);
          
          // NEW: Auto-detect emotion from user input
          if (this.emotionDetectionEnabled) {
            const detectedEmotion = this.detectEmotionFromInput(message.transcript);
            if (detectedEmotion !== this.currentEmotion) {
              console.log(`🎭 Auto-detected emotion: ${detectedEmotion} from input: "${message.transcript}"`);
              this.updateEmotion(detectedEmotion);
            }
          }
        }
        break;
      case 'response.audio_transcript.delta':
        // This is the AI's response being transcribed
        if (this.onTranscript) {
          this.onTranscript(message.delta);
        }
        break;
      case 'response.audio_transcript.done':
        // Mark current response as complete
        if (this.onResponseComplete) {
          this.onResponseComplete();
        }
        break;
      case 'conversation.item.created':
        break;
      case 'conversation.item.input_created':
        break;
      case 'conversation.item.output_created':
        // Reset transcript when new AI response starts
        if (this.onResponseStart) {
          this.onResponseStart();
        }
        break;
      case 'response.created':
        // AI response is starting
        if (this.onResponseStart) {
          this.onResponseStart();
        }
        break;
      case 'response.output_item.added':
        break;
      case 'response.content_part.added':
        break;
      case 'output_audio_buffer.started':
        // AI audio output started - THIS IS KEY FOR LIP SYNC
        console.log('🎵 AI audio output started');
        break;
      case 'conversation.item.input_audio_transcription.delta':
        break;
      case 'error':
        console.error('❌ OpenAI error:', message.error);
        break;
      default:
        break;
    }
  }

  sendTestMessage() {
    if (this.dc?.readyState === 'open') {
      // Add a delay to ensure session update is processed
      setTimeout(() => {
      const message = {
        type: 'response.create',
        response: {
            modalities: ['text', 'audio']
            // No instructions - let the session prompt handle it
          }
        };
        
        console.log('📡 Sending test message (no instructions override)');
      this.dc.send(JSON.stringify(message));
      }, 2000); // Wait 2 seconds for session update to be processed
    } else {
      console.error('❌ Data channel not ready');
    }
  }

  disconnect() {
    
    this.isConnected = false;
    this.stopLipSyncAnalysis();
    
    // Stop microphone stream
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(track => {
        track.stop();
      });
      this.microphoneStream = null;
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    
    if (this.dc) {
      this.dc = null;
    }
    
  }

  // NEW: Update voice in real-time
  updateVoice(gender) {
    console.log(`🔄 updateVoice called with gender: ${gender}`);
    const newVoice = this.getVoiceForGender(gender);
    console.log(`🔄 Attempting to update voice from ${this.selectedVoice} to ${newVoice} (${gender})`);
    
    if (newVoice !== this.selectedVoice) {
      this.selectedVoice = newVoice;
      console.log(`🎤 Voice updated to: ${newVoice} (${gender})`);
      
      // Send session update to apply the new voice
      if (this.dc?.readyState === 'open') {
        console.log(`📡 Data channel is open, sending session update`);
        this.sendSessionUpdate(this.userData, this.userType);
        console.log(`📡 Session update sent with new voice: ${newVoice}`);
      } else {
        console.warn('⚠️ Data channel not open, cannot send session update');
        console.log(`📡 Data channel state: ${this.dc?.readyState}`);
      }
    } else {
      console.log(`ℹ️ Voice is already set to ${newVoice}, no update needed`);
    }
  }

  // NEW: Update emotion in real-time
  updateEmotion(emotion) {
    console.log(`🎭 updateEmotion called with emotion: ${emotion}`);
    
    if (this.currentEmotion !== emotion) {
      this.currentEmotion = emotion;
      this.emotionHistory.push({
        emotion: emotion,
        timestamp: new Date(),
        context: 'manual'
      });
      
      console.log(`🎭 Emotion updated to: ${emotion}`);
      
      // Send session update to apply the new emotion
      if (this.dc?.readyState === 'open') {
        console.log(`📡 Data channel is open, sending emotion update`);
        this.sendSessionUpdate(this.userData, this.userType);
        console.log(`📡 Session update sent with new emotion: ${emotion}`);
      } else {
        console.warn('⚠️ Data channel not open, cannot send emotion update');
      }
    } else {
      console.log(`ℹ️ Emotion is already set to ${emotion}, no update needed`);
    }
  }

  // NEW: Auto-detect emotion from user input
  detectEmotionFromInput(userInput) {
    if (!this.emotionDetectionEnabled) return 'neutral';
    
    const input = userInput.toLowerCase();
    
    // Stress/Anxiety indicators (English + Arabic)
    if (input.includes('help') || input.includes('confused') || input.includes('can\'t') || 
        input.includes('too hard') || input.includes('panic') || input.includes('stressed') ||
        input.includes('مساعدة') || input.includes('مشوش') || input.includes('لا أستطيع') ||
        input.includes('صعب جداً') || input.includes('ذعر') || input.includes('متوتر')) {
      return 'calm';
    }
    
    // Success indicators (English + Arabic)
    if (input.includes('got it') || input.includes('understand') || input.includes('correct') || 
        input.includes('right') || input.includes('perfect') || input.includes('yes') ||
        input.includes('فهمت') || input.includes('صحيح') || input.includes('ممتاز') ||
        input.includes('نعم') || input.includes('حسناً') || input.includes('تمام')) {
      return 'excited';
    }
    
    // Error/Failure indicators (English + Arabic)
    if (input.includes('wrong') || input.includes('mistake') || input.includes('error') || 
        input.includes('failed') || input.includes('incorrect') ||
        input.includes('خطأ') || input.includes('غلط') || input.includes('فشل') ||
        input.includes('غير صحيح')) {
      return 'reassuring';
    }
    
    // Default to friendly for questions and general input (English + Arabic)
    if (input.includes('?') || input.includes('how') || input.includes('what') || 
        input.includes('why') || input.includes('explain') ||
        input.includes('كيف') || input.includes('ماذا') || input.includes('لماذا') ||
        input.includes('اشرح')) {
      return 'friendly';
    }
    
    return 'neutral';
  }

  // NEW: Enhanced prompt with emotion instructions
  createEmotionPrompt(basePrompt, emotion) {
    const emotionInstructions = {
      'friendly': `
**CURRENT EMOTION: FRIENDLY**
- Use a warm, approachable, and encouraging tone
- Speak with enthusiasm and positivity
- Use phrases like "That's a great question!", "Let's break it down", "I'm happy to help!"
- Maintain an upbeat and supportive demeanor`,
      
      'excited': `
**CURRENT EMOTION: EXCITED**
- Celebrate achievements with genuine enthusiasm
- Use an energetic and celebratory tone
- Use phrases like "Yes, that's exactly right! Great job!", "You nailed it!", "Awesome!"
- Show genuine excitement and pride in their success`,
      
      'calm': `
**CURRENT EMOTION: CALM**
- Use a calm, patient, and steady tone
- Speak slowly and reassuringly
- Use phrases like "It's okay, let's take a deep breath", "We can work through this together"
- Provide comfort and reassurance during stressful moments`,
      
      'reassuring': `
**CURRENT EMOTION: REASSURING**
- Be gentle, supportive, and focus on learning opportunities
- Use a comforting and understanding tone
- Use phrases like "No worries, that's a common mistake!", "That was a good try!"
- Never be discouraging, always focus on the positive`,
      
      'neutral': `
**CURRENT EMOTION: NEUTRAL**
- Use a balanced, professional, and clear tone
- Maintain consistency and reliability
- Focus on clear communication and helpfulness
- Adapt naturally to the conversation flow`
    };
    
    return basePrompt + emotionInstructions[emotion] || emotionInstructions['neutral'];
  }

  // NEW: Get voice based on gender selection
  getVoiceForGender(gender) {
    const voiceMap = {
      'female': 'shimmer',   // Female voice - Shimmer is supported and sounds female
      'male': 'echo'         // Male voice - Echo is supported and sounds male
    };
    const selectedVoice = voiceMap[gender] || 'echo'; // Default to male voice
    console.log(`🎭 Voice mapping: ${gender} -> ${selectedVoice}`);
    return selectedVoice;
  }
}