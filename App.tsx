
import React, { useState, useCallback } from 'react';
import { AppState, TranscriptEntry, Persona } from './types';
import PersonaSetup from './components/PersonaSetup';
import InterviewScreen from './components/InterviewScreen';
import FeedbackScreen from './components/FeedbackScreen';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.PERSONA_SETUP);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const handlePersonaReady = useCallback((generatedPersona: Persona) => {
    setPersona(generatedPersona);
    setAppState(AppState.INTERVIEW);
  }, []);

  const handleInterviewComplete = useCallback((finalTranscript: TranscriptEntry[]) => {
    setTranscript(finalTranscript);
    setAppState(AppState.FEEDBACK);
  }, []);

  const handleRestart = useCallback(() => {
    setPersona(null);
    setTranscript([]);
    setAppState(AppState.PERSONA_SETUP);
  }, []);

  const renderContent = () => {
    switch (appState) {
      case AppState.PERSONA_SETUP:
        return <PersonaSetup onPersonaReady={handlePersonaReady} />;
      case AppState.INTERVIEW:
        if (!persona) {
            // Should not happen in normal flow, but good practice
            handleRestart();
            return null;
        }
        return <InterviewScreen persona={persona} onInterviewComplete={handleInterviewComplete} />;
      case AppState.FEEDBACK:
        return <FeedbackScreen transcript={transcript} onRestart={handleRestart} />;
      default:
        return <PersonaSetup onPersonaReady={handlePersonaReady} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-6 md:p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
          Recruiter AI <span className="text-blue-500">Practice Room</span>
        </h1>
        <p className="mt-2 text-lg text-gray-400">
          Hone your interviewing skills with a real-time AI candidate.
        </p>
      </header>
      <main>
        {renderContent()}
      </main>
      <footer className="text-center mt-12 text-gray-500 text-sm">
        <p>Powered by Google Gemini</p>
      </footer>
    </div>
  );
};

export default App;
