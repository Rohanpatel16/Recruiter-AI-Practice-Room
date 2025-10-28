
import React, { useState } from 'react';
import { generatePersona } from '../services/geminiService';
import { Persona } from '../types';
import Card from './common/Card';
import Button from './common/Button';

// A simple, styled radio button group component
const RadioGroup: React.FC<{
  label: string;
  name: string;
  options: { value: string; label: string }[];
  selected: string;
  onChange: (value: any) => void;
}> = ({ label, name, options, selected, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
    <div className="flex gap-2 rounded-lg bg-gray-900 p-1 border border-gray-600 w-min">
      {options.map(option => (
        <button
          key={option.value}
          name={name}
          onClick={() => onChange(option.value)}
          className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${selected === option.value ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-300 hover:bg-gray-700'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

// A component to display the structured persona details
const PersonaDisplay: React.FC<{ persona: Persona }> = ({ persona }) => (
  <div className="space-y-6 pt-6 border-t border-gray-700">
    <h3 className="text-2xl font-bold text-white text-center">Generated Persona: {persona.basic_info.full_name}</h3>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
      <div className="md:col-span-2 p-4 bg-gray-900 rounded-lg border border-gray-700">
        <h4 className="font-semibold text-blue-400 mb-2 text-base">Professional Summary</h4>
        <p className="text-gray-300">{persona.professional_summary}</p>
      </div>

      <div className="p-4 bg-gray-900 rounded-lg border border-gray-700 space-y-2">
         <p><strong>Location:</strong> {persona.basic_info.location}</p>
         <p><strong>Education:</strong> {persona.education.degree} from {persona.education.university} ({persona.education.graduation_year})</p>
         <p><strong>Hobbies:</strong> {persona.hobbies_and_interests.join(', ')}</p>
      </div>

      <div className="p-4 bg-gray-900 rounded-lg border border-gray-700 space-y-2">
         <h4 className="font-semibold text-blue-400 mb-2 text-base">Skills</h4>
         <p><strong>Technical:</strong> {persona.skills.technical.join(', ')}</p>
         <p><strong>Soft Skills:</strong> {persona.skills.soft_skills.join(', ')}</p>
      </div>
      
      <div className="md:col-span-2 p-4 bg-gray-900 rounded-lg border border-gray-700">
         <h4 className="font-semibold text-blue-400 mb-2 text-base">Work Experience</h4>
         <div className="space-y-4">
            {persona.work_experience.map((job, index) => (
              <div key={index} className={index > 0 ? "pt-4 border-t border-gray-800" : ""}>
                <p className="font-bold">{job.role} at {job.company} <span className="font-normal text-gray-400">({job.duration})</span></p>
                <ul className="list-disc list-inside text-gray-300 pl-2 mt-1">
                  {job.key_achievements.map((ach, i) => <li key={i}>{ach}</li>)}
                </ul>
              </div>
            ))}
         </div>
      </div>
      
       <div className="md:col-span-2 p-4 bg-gray-900 rounded-lg border border-gray-700">
         <h4 className="font-semibold text-blue-400 mb-2 text-base">Projects</h4>
         <div className="space-y-4">
            {persona.projects.map((project, index) => (
              <div key={index} className={index > 0 ? "pt-4 border-t border-gray-800" : ""}>
                <p className="font-bold">{project.project_name}</p>
                <p className="text-gray-300">{project.description}</p>
                <p className="text-xs text-gray-400 mt-1"><strong>Tech used:</strong> {project.technologies_used.join(', ')}</p>
              </div>
            ))}
         </div>
       </div>
    </div>
  </div>
);


interface PersonaSetupProps {
  onPersonaReady: (persona: Persona) => void;
}

const PersonaSetup: React.FC<PersonaSetupProps> = ({ onPersonaReady }) => {
  const [jobDescription, setJobDescription] = useState<string>('');
  const [experience, setExperience] = useState<'fresher' | 'experienced'>('experienced');
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [persona, setPersona] = useState<Persona | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [personaPrompt, setPersonaPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleGeneratePersona = async () => {
    if (!jobDescription.trim()) return;
    setIsLoading(true);
    setPersona(null);
    setErrorMessage('');
    setPersonaPrompt('');
    try {
      const { persona: generated, prompt } = await generatePersona(jobDescription, experience, gender);
      if (generated) {
        setPersona(generated);
      } else {
        setErrorMessage('Failed to generate persona. The API returned an empty response. Please try again.');
      }
      setPersonaPrompt(prompt);
    } catch (error) {
      console.error(error);
      setErrorMessage('Failed to generate persona. Please check the console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white">Create Candidate Persona</h2>
        <p className="text-gray-400 mt-2">Describe the job role, and we'll generate an AI candidate for you to interview.</p>
      </div>
      
      <div className="space-y-4">
        <label htmlFor="jobDescription" className="block text-sm font-medium text-gray-300">Job Description or Role</label>
        <textarea
          id="jobDescription"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="e.g., Senior React Developer with 5 years of experience in e-commerce..."
          className="w-full h-32 p-3 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          rows={5}
        />
        <div className="flex flex-col md:flex-row gap-4">
          <RadioGroup 
            label="Experience Level"
            name="experience"
            options={[{value: 'fresher', label: 'Fresher'}, {value: 'experienced', label: 'Experienced'}]}
            selected={experience}
            onChange={setExperience}
          />
          <RadioGroup 
            label="Voice / Gender"
            name="gender"
            options={[{value: 'female', label: 'Female'}, {value: 'male', label: 'Male'}]}
            selected={gender}
            onChange={setGender}
          />
        </div>
        <Button onClick={handleGeneratePersona} isLoading={isLoading} disabled={!jobDescription.trim()}>
          {isLoading ? 'Generating...' : 'Generate Persona'}
        </Button>
      </div>

      {isLoading && (
        <div className="text-center p-4 border-t border-gray-700">
          <p className="text-gray-400">Generating candidate persona...</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300">
          {errorMessage}
        </div>
      )}

      {persona && !isLoading && (
        <PersonaDisplay persona={persona} />
      )}

      {personaPrompt && !isLoading && (
         <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-gray-400 hover:text-white">View Generation Prompt</summary>
            <pre className="mt-2 p-3 bg-gray-900 border border-gray-600 rounded-lg whitespace-pre-wrap text-xs text-gray-300 max-w-full overflow-x-auto">
              {personaPrompt}
            </pre>
          </details>
      )}

      {persona && !isLoading && (
        <div className="text-center pt-6">
          <Button onClick={() => onPersonaReady(persona)} className="w-full md:w-auto">
            Start Interview
          </Button>
        </div>
      )}
    </Card>
  );
};

export default PersonaSetup;
