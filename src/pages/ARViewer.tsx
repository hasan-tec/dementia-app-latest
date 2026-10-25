import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getAllPeople, getLatestConversation } from '../db/database';
import type { StoredCandidate } from '../services/faceDetection';
import { useARSession } from '../features/ar/useARSession';
import './ARViewer.css';

export function ARViewer() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const [isRayBanMode, setIsRayBanMode] = useState(false);
    const [isConvoExpanded, setIsConvoExpanded] = useState(false);

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

    // Session hook managing concurrent startup, scheduled inference, RAF animation, and track cleanup
    const {
        sessionState,
        activeMatch,
        statusMessage,
        isTracking,
        startSession,
        stopSession,
    } = useARSession({
        loadGallery,
        videoRef,
        overlayRef,
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5" />
                    <path d="M12 19l-7-7 7-7" />
                </svg>
                <span>Home</span>
            </Link>

            {/* Connection Status Badge */}
            <div className={`connection-status ${isTracking ? 'tracking' : ''}`} data-tour="ar-status">
                <span className="status-dot"></span>
                {statusMessage}
            </div>

            {/* Floating Person Info - Driven smoothly via overlayRef without component-wide rerenders */}
            <div
                ref={overlayRef}
                className="person-overlay"
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    display: activeMatch ? 'flex' : 'none',
                    willChange: 'transform',
                }}
            >
                {activeMatch && (
                    <>
                        {/* Name Row - Separate badges */}
                        <div className="name-row">
                            <div className="name-badge">
                                <span className="person-name">{activeMatch.person.name}</span>
                            </div>
                            <div className="relation-badge">
                                <span className="person-relation">{activeMatch.person.relation}</span>
                            </div>
                        </div>

                        {/* Conversation Summary - Compact card, expands on click */}
                        <div
                            className={`convo-bubble ${isConvoExpanded ? 'expanded' : ''}`}
                            onClick={() => setIsConvoExpanded(prev => !prev)}
                        >
                            <div className="convo-bubble-header">
                                <span className="convo-bubble-icon">💬</span>
                                <span className="convo-bubble-label">
                                    {isConvoExpanded ? 'Recent conversation' : 'View conversation'}
                                </span>
                                <span className={`convo-bubble-chevron ${isConvoExpanded ? 'open' : ''}`}>▾</span>
                            </div>
                            {isConvoExpanded && (
                                <div className="convo-bubble-content">
                                    <p className="convo-bubble-text">
                                        {activeMatch.person.latestRawText || activeMatch.person.latestSummary}
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Bottom Toolbar */}
            <div className="bottom-toolbar">
                <Link to="/" className="logo-btn" title="Back to Dashboard" data-tour="ar-home">
                    N
                </Link>

                <div className="center-controls">
                    <button className="control-btn" onClick={handleCameraToggle} data-tour="ar-camera-toggle">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M23 7l-7 5 7 5V7z" />
                            <rect x="1" y="5" width="15" height="14" rx="2" />
                            {!isCameraActive && (
                                <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" />
                            )}
                        </svg>
                        <span>{isCameraActive ? 'Stop Video' : 'Start Camera'}</span>
                    </button>

                    <button
                        className={`control-btn primary ${isRayBanMode ? 'active' : ''}`}
                        onClick={toggleRayBanMode}
                        title="Display preview simulation"
                    >
                        {isRayBanMode ? 'Exit Glasses View' : 'Glasses Preview (Simulation)'}
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
