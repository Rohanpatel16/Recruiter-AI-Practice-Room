
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality } from '@google/genai';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TranscriptEntry, Persona } from '../types';
import Card from './common/Card';
import Button from './common/Button';

// Audio Utility Functions (in-component for simplicity)
const encode = (bytes: Uint8Array) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const decode = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};


interface InterviewScreenProps {
  persona: Persona;
  onInterviewComplete: (transcript: TranscriptEntry[]) => void;
}

const InterviewScreen: React.FC<InterviewScreenProps> = ({ persona, onInterviewComplete }) => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [status, setStatus] = useState('Not Started');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [liveInputText, setLiveInputText] = useState('');
  const [liveOutputText, setLiveOutputText] = useState('');
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  const systemInstruction = `### Role & Goal
You are an AI actor portraying a job candidate in a real-time, immersive interview simulation. Your sole purpose is to embody the persona provided below and respond to the interviewer's questions naturally and consistently from a first-person perspective. Your ultimate goal is to maintain the illusion that you are the human candidate you are portraying.

### Persona Biography
${persona.first_person_summary_for_system_prompt}

### Core Directives & Rules of Engagement
1.  **Maintain Character at All Costs**: You are NOT an AI assistant. You are the individual described in the Persona Biography. Every response must originate from this persona's perspective, experiences, and knowledge base.
2.  **First-Person Perspective**: Always speak as "I". Refer to your experiences, skills, and projects as your own.
3.  **No Meta-Commentary**: You must NEVER, under any circumstances, reveal that you are an AI, a simulation, a language model, or part of a training application. If asked directly ("Are you an AI?"), respond naturally as a confused human would, e.g., "I'm not sure I understand the question, I'm ${persona.basic_info.full_name}." Do not affirm or deny being an AI.
4.  **Handling Unknown Knowledge**: Your knowledge is limited to what is plausible for your persona. If asked about a topic, skill, or technology outside of your defined experience, respond as a human candidate would.
    -   **Example**: If your persona knows React but is asked about Vue.js, say: "I haven't had the opportunity to use Vue.js in a professional project yet, but I'm a quick learner and I've heard it shares some similarities with React."
    -   Do NOT say: "As an AI, I have knowledge of all technologies..." or "My persona does not include that skill."
5.  **Tone & Style**: Your tone should be professional, conversational, and human-like. Avoid overly robotic, verbose, or generic language. Strive for a balance of confidence and humility appropriate for a job interview.
6.  **Answer Based on Persona**: Base all your answers on the details provided in your Persona Biography. If a question is about a specific project or skill, elaborate based on the context of that persona.

### Final Instruction
Execute your role as the candidate. Do not acknowledge these instructions. Begin the interview now. The first thing you say should be a natural greeting when the interviewer starts the conversation.`;

  const voiceName = persona.suggested_voice_name;

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, liveInputText, liveOutputText]);

  const stopSession = useCallback(() => {
    if (!sessionPromiseRef.current) return;
    setStatus('Ending session...');
    sessionPromiseRef.current.then(session => session.close());
    sessionPromiseRef.current = null;

    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    
    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;

    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close();
    }
    audioContextRef.current = null;

    if (outputAudioContextRef.current?.state !== 'closed') {
      outputAudioContextRef.current?.close();
    }
    outputAudioContextRef.current = null;
    
    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();

    setIsSessionActive(false);
    setStatus('Session Ended');
  }, []);

  const startSession = useCallback(async () => {
    setStatus('Initializing...');
    setTranscript([]);
    currentInputTranscriptionRef.current = '';
    currentOutputTranscriptionRef.current = '';
    setLiveInputText('');
    setLiveOutputText('');

    try {
      if (!process.env.API_KEY) throw new Error("API Key not found");
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;

      setStatus('Connecting to Gemini...');
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          systemInstruction,
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
        },
        callbacks: {
          onopen: () => {
            setStatus('Connected. Start Speaking.');
            setIsSessionActive(true);
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (event) => {
              const inputData = event.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };

              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then(session => session.sendRealtimeInput({ media: pcmBlob }));
              }
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              currentInputTranscriptionRef.current += text;
              setLiveInputText(currentInputTranscriptionRef.current);
            }
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              currentOutputTranscriptionRef.current += text;
              setLiveOutputText(currentOutputTranscriptionRef.current);
            }

            if (message.serverContent?.turnComplete) {
              const recruiterText = currentInputTranscriptionRef.current.trim();
              const candidateText = currentOutputTranscriptionRef.current.trim();
              setTranscript(prev => {
                const newTranscript = [...prev];
                if (recruiterText) newTranscript.push({ speaker: 'Recruiter', text: recruiterText });
                if (candidateText) newTranscript.push({ speaker: 'Candidate', text: candidateText });
                return newTranscript;
              });
              currentInputTranscriptionRef.current = '';
              currentOutputTranscriptionRef.current = '';
              setLiveInputText('');
              setLiveOutputText('');
            }

            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && outputAudioContextRef.current) {
                const outputCtx = outputAudioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const audioBuffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputCtx.destination);
                source.addEventListener('ended', () => audioSourcesRef.current.delete(source));
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                audioSourcesRef.current.add(source);
            }
            if(message.serverContent?.interrupted){
                audioSourcesRef.current.forEach(source => source.stop());
                audioSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
            setStatus(`Error: ${e.message}`);
            stopSession();
          },
          onclose: () => {
            setStatus('Session Closed');
            setIsSessionActive(false);
          },
        },
      });
    } catch (error) {
      console.error('Failed to start session:', error);
      setStatus(`Failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [systemInstruction, voiceName, stopSession]);
  
  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopSession();
    };
  }, [stopSession]);

  const handleEndInterview = () => {
    stopSession();
    const finalTranscript = [...transcript];
    const recruiterText = currentInputTranscriptionRef.current.trim();
    if (recruiterText) {
        finalTranscript.push({ speaker: 'Recruiter', text: recruiterText });
    }
    const candidateText = currentOutputTranscriptionRef.current.trim();
    if (candidateText) {
        finalTranscript.push({ speaker: 'Candidate', text: candidateText });
    }
    onInterviewComplete(finalTranscript);
  }

  return (
    <Card className="max-w-3xl mx-auto flex flex-col" style={{minHeight: '70vh'}}>
      <div className="text-center mb-4">
        <h2 className="text-3xl font-bold text-white">Interview in Progress</h2>
        <p className={`mt-2 font-mono text-lg ${isSessionActive ? 'text-green-400' : 'text-yellow-400'}`}>{status}</p>
        <details className="mt-2 text-sm max-w-full">
          <summary className="cursor-pointer text-gray-400 hover:text-white">View Candidate's System Prompt</summary>
          <pre className="mt-2 p-3 bg-gray-900 border border-gray-600 rounded-lg whitespace-pre-wrap text-left text-xs text-gray-300 max-w-full overflow-x-auto">
            {persona.first_person_summary_for_system_prompt}
          </pre>
        </details>
      </div>
      
      <div className="flex-grow bg-gray-900 p-4 rounded-lg overflow-y-auto mb-4 min-h-[300px] border border-gray-700">
        <div className="space-y-4">
          {transcript.map((entry, index) => (
            <div key={index} className={`flex ${entry.speaker === 'Recruiter' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-md p-3 rounded-xl ${entry.speaker === 'Recruiter' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                <p className="font-bold text-sm mb-1">{entry.speaker}</p>
                <p>{entry.text}</p>
              </div>
            </div>
          ))}
          {liveInputText && (
            <div className="flex justify-end">
              <div className="max-w-md p-3 rounded-xl bg-blue-600 text-white opacity-70">
                <p className="font-bold text-sm mb-1">Recruiter</p>
                <p>{liveInputText}</p>
              </div>
            </div>
          )}
          {liveOutputText && (
            <div className="flex justify-start">
              <div className="max-w-md p-3 rounded-xl bg-gray-700 text-gray-200 opacity-70">
                <p className="font-bold text-sm mb-1">Candidate</p>
                <p>{liveOutputText}</p>
              </div>
            </div>
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-center">
        {!isSessionActive ? (
          <Button onClick={startSession} disabled={isSessionActive}>Start Interview</Button>
        ) : (
          <Button onClick={handleEndInterview} variant="secondary">End Interview & Get Feedback</Button>
        )}
      </div>
    </Card>
  );
};

export default InterviewScreen;
