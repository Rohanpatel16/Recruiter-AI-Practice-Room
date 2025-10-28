
export enum AppState {
  PERSONA_SETUP = 'PERSONA_SETUP',
  INTERVIEW = 'INTERVIEW',
  FEEDBACK = 'FEEDBACK',
}

export interface TranscriptEntry {
  speaker: 'Recruiter' | 'Candidate';
  text: string;
}

export interface Persona {
  basic_info: {
    full_name: string;
    gender: 'Male' | 'Female';
    location: string;
  };
  professional_summary: string;
  first_person_summary_for_system_prompt: string;
  education: {
    university: string;
    degree: string;
    graduation_year: number;
  };
  work_experience: {
    company: string;
    role: string;
    duration: string;
    key_achievements: string[];
  }[];
  skills: {
    technical: string[];
    soft_skills: string[];
  };
  projects: {
    project_name: string;
    description: string;
    technologies_used: string[];
  }[];
  hobbies_and_interests: string[];
  suggested_voice_name: string;
}
