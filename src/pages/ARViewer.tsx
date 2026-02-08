import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getAllPeople, getLatestConversation, type Person } from '../db/database';
import { loadFaceDetectionModels, detectFaceWithDescriptor, findBestMatch } from '../services/faceDetection';
import './ARViewer.css';

interface DetectedPerson extends Person {
    lastConvo?: string;
}

interface StoredPersonWithDescriptor {
    id: number;
    descriptor: number[];
}

export function ARViewer() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [detectedPerson, setDetectedPerson] = useState<DetectedPerson | null>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [isRayBanMode, setIsRayBanMode] = useState(false);
    const [isTracking, setIsTracking] = useState(false);
    const [recognitionStatus, setRecognitionStatus] = useState('Loading AI...');

    // Use refs for animation to avoid stale closure issues
    const targetPosRef = useRef({ x: 75, y: 30 });
    const smoothPosRef = useRef({ x: 75, y: 30 });
    const [overlayPos, setOverlayPos] = useState({ x: 75, y: 30 });
    const animationRef = useRef<number | undefined>(undefined);
    const lastMatchedIdRef = useRef<number | null>(null);
    const recognitionLoopRef = useRef(false);
    const modelsReadyRef = useRef(false);
    const storedDescriptorsRef = useRef<StoredPersonWithDescriptor[]>([]);
    const allPeopleRef = useRef<Person[]>([]);

    useEffect(() => {
        const isMounted = { current: true };
        initializeAR(isMounted);

        return () => {
            isMounted.current = false;
            if (videoRef.current?.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            recognitionLoopRef.current = false;
        };
    }, []);

    const initializeAR = async (isMounted: { current: boolean }) => {
        // Load all people and their face descriptors
        const people = await getAllPeople();
        if (!isMounted.current) return;

        if (!isMounted.current) return;

        allPeopleRef.current = people;
        console.log('All people loaded from DB:', people);


        // Build descriptor lookup
        const descriptors: StoredPersonWithDescriptor[] = [];
        for (const person of people) {
            if (person.id && person.faceDescriptor) {
                descriptors.push({ id: person.id, descriptor: person.faceDescriptor });
            }
        }
        storedDescriptorsRef.current = descriptors;

        console.log(`Loaded ${descriptors.length} face descriptors for recognition`);

        // Load face detection/recognition models
        if (!isMounted.current) return;
        setRecognitionStatus('Loading AI models...');

        try {
            const loaded = await loadFaceDetectionModels();
            if (!isMounted.current) return;

            if (!isMounted.current) return;

            modelsReadyRef.current = loaded;
            setRecognitionStatus(loaded ? 'Scanning...' : 'AI failed to load');

            // Start camera
            await startCamera(isMounted);

            // Start animation loop
            if (isMounted.current) startAnimationLoop();
        } catch (error) {
            console.error('Initialization error:', error);
            if (isMounted.current) setRecognitionStatus('Error loading AI');
        }
    };

    const startCamera = async (isMounted: { current: boolean }) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
            });

            if (videoRef.current && isMounted.current) {
                videoRef.current.srcObject = stream;

                // Play and handle potential interruption errors
                try {
                    await videoRef.current.play();
                    setCameraActive(true);

                    // Start detection only after successful play
                    startFaceRecognition();
                } catch (playError) {
                    // Ignore AbortError which happens when play is interrupted (e.g. by new load)
                    if (playError instanceof Error && playError.name === 'AbortError') {
                        console.log('Video play interrupted, likely due to fast reload/remount');
                        // We still consider camera active if we have the stream, 
                        // as the next play() call (from potential remount) will handle it
                        return;
                    }
                    throw playError;
                }
            }
        } catch (err) {
            console.error('Camera error:', err);
            if (!isMounted.current) return;

            // Only show access denied for specific errors
            if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'NotFoundError')) {
                setRecognitionStatus('Camera access denied');
            } else {
                setRecognitionStatus('Camera error');
            }
        }
    };

    const startFaceRecognition = () => {
        if (recognitionLoopRef.current) return; // Prevent multiple loops
        console.log('Starting face recognition loop...');
        recognitionLoopRef.current = true;

        const recognize = async () => {
            if (!recognitionLoopRef.current) {
                console.log('Stopping face recognition loop (ref is false)');
                return;
            }

            if (!videoRef.current || !modelsReadyRef.current) {
                console.log('Waiting for models/video...');
                setTimeout(recognize, 500);
                return;
            }

            console.log('Detecting face...');
            const result = await detectFaceWithDescriptor(videoRef.current);


            if (result) {
                // Update overlay position
                targetPosRef.current = {
                    x: Math.min(result.position.x + 8, 85),
                    y: Math.max(result.position.y - 5, 10)
                };
                setIsTracking(true);

                // Try to recognize the face
                if (result.descriptor && storedDescriptorsRef.current.length > 0) {
                    const match = findBestMatch(result.descriptor, storedDescriptorsRef.current);

                    if (match) {
                        // Found a match!
                        if (match.personId !== lastMatchedIdRef.current) {
                            // New person recognized
                            lastMatchedIdRef.current = match.personId;
                            const matchedPerson = allPeopleRef.current.find(p => p.id === match.personId);

                            if (matchedPerson) {
                                const convo = await getLatestConversation(matchedPerson.id!);
                                setDetectedPerson({
                                    ...matchedPerson,
                                    lastConvo: convo?.summary || 'No recent conversations recorded.'
                                });
                                setRecognitionStatus(`Recognized (${Math.round(match.similarity * 100)}%)`);
                            }
                        }
                    } else {
                        // Face detected but not recognized
                        setRecognitionStatus('Unknown face');
                        if (lastMatchedIdRef.current !== null) {
                            lastMatchedIdRef.current = null;
                            setDetectedPerson(null);
                        }
                    }
                } else if (storedDescriptorsRef.current.length === 0) {
                    setRecognitionStatus('No faces registered');
                } else {
                    setRecognitionStatus('Analyzing face...');
                }
            } else {
                setIsTracking(false);
                setRecognitionStatus('Scanning...');
            }

            // Continue recognition loop (slower for recognition to reduce CPU)
            setTimeout(recognize, 200);
        };

        recognize();
    };

    // Smooth animation loop (runs every frame)
    const startAnimationLoop = () => {
        const animate = () => {
            smoothPosRef.current.x += (targetPosRef.current.x - smoothPosRef.current.x) * 0.12;
            smoothPosRef.current.y += (targetPosRef.current.y - smoothPosRef.current.y) * 0.12;
            setOverlayPos({ ...smoothPosRef.current });
            animationRef.current = requestAnimationFrame(animate);
        };

        animationRef.current = requestAnimationFrame(animate);
    };

    const stopVideo = () => {
        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            setCameraActive(false);
            setIsTracking(false);
            recognitionLoopRef.current = false;
        }
    };

    const toggleRayBanMode = () => {
        setIsRayBanMode(!isRayBanMode);
    };

    return (
        <div className={`ar-fullscreen ${isRayBanMode ? 'rayban-mode' : ''}`}>
            {/* Camera Feed */}
            <video ref={videoRef} className="ar-camera-feed" autoPlay playsInline muted />

            {/* Connection Status */}
            <div className={`connection-status ${isTracking ? 'tracking' : ''}`}>
                <span className="status-dot"></span>
                {recognitionStatus}
            </div>

            {/* Floating Person Info - Follows Face Position */}
            {detectedPerson && (
                <div
                    className="person-overlay"
                    style={{
                        left: `${overlayPos.x}%`,
                        top: `${overlayPos.y}%`,
                    }}
                >
                    {/* Name Row - Separate badges */}
                    <div className="name-row">
                        <div className="name-badge">
                            <span className="person-name">{detectedPerson.name}</span>
                        </div>
                        <div className="relation-badge">
                            <span className="person-relation">{detectedPerson.relation}</span>
                        </div>
                    </div>

                    {/* Conversation Summary */}
                    <div className="convo-bubble">
                        <p>{detectedPerson.lastConvo}</p>
                    </div>
                </div>
            )}

            {/* Bottom Toolbar */}
            <div className="bottom-toolbar">
                <Link to="/" className="logo-btn">N</Link>

                <div className="center-controls">
                    <button className="control-btn" onClick={stopVideo}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M23 7l-7 5 7 5V7z" />
                            <rect x="1" y="5" width="15" height="14" rx="2" />
                            {!cameraActive && <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" />}
                        </svg>
                        <span>Stop Video</span>
                    </button>

                    <button className={`control-btn primary ${isRayBanMode ? 'active' : ''}`} onClick={toggleRayBanMode}>
                        Enter Ray-Ban Mode
                    </button>
                </div>

                <div className="spacer"></div>
            </div>

            {/* Ray-Ban Frame Overlay */}
            {isRayBanMode && (
                <div className="rayban-frame">
                    <div className="frame-edge left"></div>
                    <div className="frame-edge right"></div>
                </div>
            )}
        </div>
    );
}
