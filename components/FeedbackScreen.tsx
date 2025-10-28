
import React, { useState, useEffect } from 'react';
import { TranscriptEntry } from '../types';
import { getInterviewFeedback } from '../services/geminiService';
import Card from './common/Card';
import Button from './common/Button';

// Simple Markdown-like renderer
const SimpleMarkdown: React.FC<{ content: string }> = ({ content }) => {
    const lines = content.split('\n');
    return (
        <div className="prose prose-invert prose-sm md:prose-base text-gray-300">
            {lines.map((line, index) => {
                if (line.startsWith('**') && line.endsWith('**')) {
                    return <h3 key={index} className="font-bold mt-4 mb-2 text-lg text-blue-400">{line.slice(2, -2)}</h3>;
                }
                if (line.startsWith('* ')) {
                    return <li key={index} className="ml-4 list-disc">{line.slice(2)}</li>;
                }
                if (line.match(/^\d+\./)) {
                    return <li key={index} className="ml-4 list-decimal">{line.slice(line.indexOf('.') + 1).trim()}</li>;
                }
                return <p key={index} className="my-1">{line}</p>;
            })}
        </div>
    );
};

interface FeedbackScreenProps {
  transcript: TranscriptEntry[];
  onRestart: () => void;
}

const FeedbackScreen: React.FC<FeedbackScreenProps> = ({ transcript, onRestart }) => {
  const [feedback, setFeedback] = useState<string>('');
  const [feedbackPrompt, setFeedbackPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchFeedback = async () => {
      setIsLoading(true);
      const { feedback: result, prompt } = await getInterviewFeedback(transcript);
      setFeedback(result);
      setFeedbackPrompt(prompt);
      setIsLoading(false);
    };
    fetchFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Card>
        <h2 className="text-3xl font-bold text-center mb-6 text-white">Interview Feedback</h2>
        {isLoading ? (
          <div className="text-center p-8">
            <p className="text-gray-400">Analyzing your performance and generating feedback...</p>
          </div>
        ) : (
          <>
            <div className="p-4 bg-gray-900 rounded-lg">
              <SimpleMarkdown content={feedback} />
            </div>
            {feedbackPrompt && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer text-gray-400 hover:text-white">View Feedback Generation Prompt</summary>
                <pre className="mt-2 p-3 bg-gray-900 border border-gray-600 rounded-lg whitespace-pre-wrap text-xs text-gray-300 max-w-full overflow-x-auto">
                  {feedbackPrompt}
                </pre>
              </details>
            )}
          </>
        )}
      </Card>
      
      <Card>
        <h3 className="text-2xl font-bold mb-4 text-white">Interview Transcript</h3>
        <div className="max-h-96 overflow-y-auto bg-gray-900 p-4 rounded-lg space-y-3">
          {transcript.map((entry, index) => (
            <div key={index}>
              <span className={`font-bold ${entry.speaker === 'Recruiter' ? 'text-blue-400' : 'text-green-400'}`}>{entry.speaker}: </span>
              <span>{entry.text}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="text-center">
        <Button onClick={onRestart}>Practice Again</Button>
      </div>
    </div>
  );
};

export default FeedbackScreen;
