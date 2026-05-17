import { useState, useCallback, useRef } from 'react';

interface VoiceTranscriptionOptions {
    lang?: string;
    continuous?: boolean;
    interimResults?: boolean;
    onResult?: (text: string, isFinal: boolean) => void;
    onError?: (error: any) => void;
}

export function useVoiceTranscription({
    lang = 'pt-PT',
    continuous = true,
    interimResults = true,
    onResult,
    onError
}: VoiceTranscriptionOptions = {}) {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [interimTranscript, setInterimTranscript] = useState('');
    const recognitionRef = useRef<any>(null);

    const stopRecording = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsRecording(false);
            setIsPaused(false);
        }
    }, []);

    const startRecording = useCallback(() => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            const error = new Error('Speech Recognition API not supported in this browser');
            if (onError) onError(error);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.lang = lang;

        recognition.onstart = () => {
            setIsRecording(true);
            setIsPaused(false);
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error);
            if (onError) onError(event);
            setIsRecording(false);
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            let currentInterimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    currentInterimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                setTranscript(prev => prev + (prev ? ' ' : '') + finalTranscript);
                if (onResult) onResult(finalTranscript, true);
            }
            
            setInterimTranscript(currentInterimTranscript);
            if (currentInterimTranscript && onResult) {
                onResult(currentInterimTranscript, false);
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
    }, [lang, continuous, interimResults, onResult, onError]);

    const toggleRecording = useCallback(() => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }, [isRecording, startRecording, stopRecording]);

    const resetTranscript = useCallback(() => {
        setTranscript('');
        setInterimTranscript('');
    }, []);

    return {
        isRecording,
        isPaused,
        transcript,
        interimTranscript,
        startRecording,
        stopRecording,
        toggleRecording,
        resetTranscript,
        isSupported: !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    };
}
