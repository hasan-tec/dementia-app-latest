import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, ChevronDown, Brain, Video, VideoOff, Glasses, ArrowLeft } from 'lucide-react';
import { getAllPeople, getLatestConversation } from '../db/database';
import type { StoredCandidate } from '../services/faceDetection';
import { useARSession } from '../features/ar/useARSession';
import './ARViewer.css';

export function ARViewer() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isRayBanMode, setIsRayBanMode] = useState(false);
    const [expandedConvos, setExpandedConvos] = useState<Record<string, boolean>>({});

    const toggleConvoExpanded = (personId: string) => {
        setExpandedConvos((prev) => ({
            ...prev,
            [personId]: !prev[personId],
        }));
    };

    /**
     * Loads registered gallery candidates with their latest conversation summaries
     */
    const loadGallery = useCallback(async (): Promise<StoredCandidate[]> => {
        try {
            const people = await getAllPeople();
            const candidates: StoredCandidate[] = [];

            for (const person of people) {
                if (person.id && person.faceDescriptor) {
                    const convo = await getLatestConversation(person.id);
                    candidates.push({
                        id: person.id,
                        name: person.name,
                        relation: person.relation,
                        descriptor: person.faceDescriptor,
                        descriptorModel: 'face-api-v1',
                        latestSummary: convo?.summary || 'No recent conversations recorded.',
                        latestRawText: convo?.rawText || null,
                    });
                }
            }
            return candidates;
        } catch (error) {
            console.error('Error loading gallery for AR session:', error);
            return [];
        }
    }, []);

    // Session hook managing concurrent startup, multi-face tracking, RAF animation, and track cleanup
    const {
        sessionState,
        activeMatches,
        statusMessage,
        isTracking,
        registerOverlayRef,
        startSession,
        stopSession,
    } = useARSession({
        loadGallery,
        videoRef,
    });

    const isCameraActive = sessionState === 'ready' || sessionState === 'preparing';

    const handleCameraToggle = () => {
        if (isCameraActive) {
            stopSession();
        } else {
            startSession();
        }
    };

    const toggleRayBanMode = () => {
        setIsRayBanMode(!isRayBanMode);
    };

    return (
        <div className={`ar-fullscreen ${isRayBanMode ? 'rayban-mode' : ''}`}>
            {/* Camera Feed */}
            <video ref={videoRef} className="ar-camera-feed" autoPlay playsInline muted />

            {/* Back Button - Top Left */}
            <Link to="/" className="ar-back-btn" title="Back to Home" data-tour="ar-home">
                <ArrowLeft size={18} strokeWidth={2.5} />
                <span>Home</span>
            </Link>

            {/* Connection Status Badge */}
            <div className={`connection-status ${isTracking ? 'tracking' : ''}`} data-tour="ar-status">
                <span className="status-dot"></span>
                {statusMessage}
            </div>

            {/* Floating Person Labels - Positioned near each detected face with minimal suitable gap */}
            {activeMatches.map((match) => {
                const personId = String(match.person.id);
                const isExpanded = !!expandedConvos[personId];

                return (
                    <div
                        key={personId}
                        ref={(el) => registerOverlayRef(personId, el)}
                        className="person-overlay"
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            willChange: 'transform',
                            opacity: 0, // Starts invisible, revealed smoothly by RAF when positioned
                        }}
                    >
                        {/* Name Row - Distinct name badge + relation badge */}
                        <div className="name-row">
                            <div className="name-badge">
                                <span className="person-name">{match.person.name}</span>
                            </div>
                            <div className="relation-badge">
                                <span className="person-relation">{match.person.relation}</span>
                            </div>
                        </div>

                        {/* Conversation Summary - Compact card anchored with person, expands on click */}
                        {match.person.latestSummary && (
                            <div
                                className={`convo-bubble ${isExpanded ? 'expanded' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleConvoExpanded(personId);
                                }}
                            >
                                <div className="convo-bubble-header">
                                    <MessageSquare size={14} className="convo-bubble-icon" />
                                    <span className="convo-bubble-label">
                                        {isExpanded ? 'Recent conversation' : 'View conversation'}
                                    </span>
                                    <ChevronDown
                                        size={13}
                                        className={`convo-bubble-chevron ${isExpanded ? 'open' : ''}`}
                                    />
                                </div>
                                {isExpanded && (
                                    <div className="convo-bubble-content">
                                        <p className="convo-bubble-text">
                                            {match.person.latestRawText || match.person.latestSummary}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Bottom Toolbar */}
            <div className="bottom-toolbar">
                <Link to="/" className="logo-btn" title="Back to Dashboard" data-tour="ar-home" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Brain size={20} color="#0071e3" strokeWidth={2.2} />
                </Link>

                <div className="center-controls">
                    <button className="control-btn" onClick={handleCameraToggle} data-tour="ar-camera-toggle">
                        {isCameraActive ? <VideoOff size={18} /> : <Video size={18} />}
                        <span>{isCameraActive ? 'Stop Video' : 'Start Camera'}</span>
                    </button>

                    <button
                        className={`control-btn primary ${isRayBanMode ? 'active' : ''}`}
                        onClick={toggleRayBanMode}
                        title="Display preview simulation"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                        <Glasses size={18} />
                        <span>{isRayBanMode ? 'Exit Glasses View' : 'Glasses Preview (Simulation)'}</span>
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
