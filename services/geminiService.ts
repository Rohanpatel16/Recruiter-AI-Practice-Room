
import { GoogleGenAI, Type } from "@google/genai";
import { TranscriptEntry, Persona } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generatePersona = async (jobDescription: string, experience: 'fresher' | 'experienced', gender: 'male' | 'female'): Promise<{ persona: Persona | null; prompt: string }> => {
  const prompt = `### Role & Goal
You are a professional Persona Architect specializing in creating realistic, high-fidelity candidate profiles for advanced interview training simulations. Your primary goal is to generate a detailed and coherent fictional candidate who is a strong and positive fit for the provided job description. The output must be a clean, structured JSON object.

### Context
- **Job Description**: "${jobDescription}"
- **Experience Level**: "${experience}"
- **Gender**: "${gender}"

### Instructions
1.  **Analyze the Context**: Thoroughly analyze the provided \`Job Description\`, \`Experience Level\`, and \`Gender\`.
2.  **Construct the Persona**: Create a fictional persona that convincingly embodies the required qualifications and experience. All details (education, experience, projects) must align logically.
3.  **Craft the System Prompt**: Write the \`first_person_summary_for_system_prompt\` as a concise, first-person narrative. This text will be used to instruct another AI, so it must clearly define the character's background, core skills, and professional demeanor. It should sound like a natural, confident introduction.
4.  **Generate JSON Output**: Populate all fields in the specified JSON structure. Ensure every field is filled with realistic and relevant data.

### Constraints & Guardrails
- **Positive Framing**: The persona must be competent and well-suited for the role. Do NOT introduce negative attributes such as career gaps, job hopping, poor performance, or personal challenges.
- **Realism**: Use plausible, real-world names for universities, companies, and locations.
- **Strict JSON Format**: The final output must be ONLY the JSON object, with no introductory text or explanations.
- **Voice Selection**: Set \`suggested_voice_name\` to 'Puck' for Male and 'Kore' for Female.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            basic_info: {
              type: Type.OBJECT,
              properties: {
                full_name: { type: Type.STRING },
                gender: { type: Type.STRING },
                location: { type: Type.STRING },
              },
              required: ['full_name', 'gender', 'location'],
            },
            professional_summary: { type: Type.STRING },
            first_person_summary_for_system_prompt: { type: Type.STRING },
            education: {
              type: Type.OBJECT,
              properties: {
                university: { type: Type.STRING },
                degree: { type: Type.STRING },
                graduation_year: { type: Type.INTEGER },
              },
              required: ['university', 'degree', 'graduation_year'],
            },
            work_experience: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  company: { type: Type.STRING },
                  role: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  key_achievements: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['company', 'role', 'duration', 'key_achievements'],
              },
            },
            skills: {
              type: Type.OBJECT,
              properties: {
                technical: { type: Type.ARRAY, items: { type: Type.STRING } },
                soft_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['technical', 'soft_skills'],
            },
            projects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  project_name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  technologies_used: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['project_name', 'description', 'technologies_used'],
              },
            },
            hobbies_and_interests: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggested_voice_name: { type: Type.STRING },
          },
          required: [
            'basic_info', 'professional_summary', 'first_person_summary_for_system_prompt', 'education',
            'work_experience', 'skills', 'projects', 'hobbies_and_interests', 'suggested_voice_name',
          ],
        },
      },
    });
    
    const persona = JSON.parse(response.text) as Persona;
    return { persona, prompt };
  } catch (error) {
    console.error("Error generating persona:", error);
    return { 
      persona: null,
      prompt: `// The following prompt failed to generate a response.\n\n${prompt}`
    };
  }
};

export const getInterviewFeedback = async (transcript: TranscriptEntry[]): Promise<{ feedback: string; prompt: string }> => {
    if (transcript.length === 0) {
        return {
          feedback: "The interview was too short to provide feedback. Please try again.",
          prompt: "// No transcript was provided, so no feedback could be generated."
        };
    }

    const formattedTranscript = transcript.map(entry => `${entry.speaker}: ${entry.text}`).join('\n');

    const prompt = `You are an expert recruitment coach. Analyze the following interview transcript between a recruiter and an AI candidate. Provide constructive, actionable feedback for the recruiter in Markdown format. 

Your feedback should cover:
1.  **Questioning Technique**: Were the questions open-ended? Did they probe for details?
2.  **Clarity and Structure**: Was the interview well-structured? Was the recruiter clear in their communication?
3.  **Rapport Building**: Did the recruiter attempt to build rapport with the candidate?
4.  **Candidate Assessment**: How effectively did the recruiter evaluate the candidate's skills and fit based on the persona?

Provide specific examples from the transcript to support your points and suggest alternative questions or approaches. End with a summary of key strengths and areas for improvement.

**Transcript:**
${formattedTranscript}`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return { feedback: response.text, prompt };
    } catch (error) {
        console.error("Error getting interview feedback:", error);
        return {
          feedback: "Error: Could not generate feedback. Please try again.",
          prompt: `// The following prompt failed to generate a response.\n\n${prompt}`
        };
    }
}
