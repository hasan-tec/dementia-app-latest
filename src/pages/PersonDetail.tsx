import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Plus,
    Glasses,
    Trash2,
    Sparkles,
    MessageSquare,
    X
} from 'lucide-react';
import {
    getPersonById,
    getConversationsForPerson,
    addConversation,
    deleteConversation,
    deletePerson,
    type Person,
    type Conversation
} from '../db/database';
import { tourEvents } from '../features/onboarding/events';
import { useTour } from '../components/tour/TourProvider';
import { summarizeConversation } from '../services/gemini';
import './PersonDetail.css';

export function PersonDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [person, setPerson] = useState<Person | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddConvo, setShowAddConvo] = useState(false);
    const [convoText, setConvoText] = useState('');
    const [useAI, setUseAI] = useState(true);
    const [saving, setSaving] = useState(false);
    const [summarizing, setSummarizing] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const { status, currentStep } = useTour();

    // Auto-open conversation modal when tour reaches conversation form steps
    useEffect(() => {
        if (status !== 'active' || !currentStep) return;

        if (
            currentStep.id === 'step-conversation-text' ||
            currentStep.id === 'step-conversation-save'
        ) {
            setShowAddConvo(true);
        } else if (currentStep.id === 'step-conversation-add' || currentStep.id === 'step-nav-ar') {
            setShowAddConvo(false);
        }
    }, [currentStep?.id, status]);

    useEffect(() => {
        loadData();
    }, [id]);

    async function loadData() {
        if (!id) return;
        try {
            const [personData, convosData] = await Promise.all([
                getPersonById(id),
                getConversationsForPerson(id)
            ]);
            setPerson(personData || null);
            setConversations(convosData);
        } catch (error) {
            console.error('Error loading person data:', error);
        } finally {
            setLoading(false);
        }
    }

    /**
     * Creates a simple fallback summary from the raw conversation text.
     */
    function createFallbackSummary(text: string): string {
        const words = text.trim().split(/\s+/).slice(0, 10);
        if (words.length < 3) {
            return 'Had a conversation recently';
        }
        return `${words.join(' ')}...`;
    }

    async function handleAddConversation(e: React.FormEvent) {
        e.preventDefault();
        if (!convoText.trim() || !person?.id) return;

        setSaving(true);

        try {
            let summary: string;

            if (useAI) {
                setSummarizing(true);
                summary = await summarizeConversation(convoText);
                setSummarizing(false);
            } else {
                // Auto-generate a fallback summary from the raw text
                summary = createFallbackSummary(convoText);
            }

            // Save conversation
            const convoId = await addConversation(person.id, convoText, summary);
            await loadData();
            setConvoText('');
            setShowAddConvo(false);

            // Emit tour event
            tourEvents.emit('conversation:save-success', { id: convoId });
        } catch (error) {
            console.error('Error adding conversation:', error);
        } finally {
            setSaving(false);
            setSummarizing(false);
        }
    }

    async function handleDeleteConversation(convoId: string | number) {
        try {
            await deleteConversation(convoId);
            await loadData();
        } catch (error) {
            console.error('Error deleting conversation:', error);
        }
    }

    async function handleDeletePerson() {
        if (!person?.id) return;
        try {
            await deletePerson(person.id);
            navigate('/people');
        } catch (error) {
            console.error('Error deleting person:', error);
        }
    }

    function formatDate(date: Date) {
        return new Date(date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    if (!person) {
        return (
            <div className="not-found">
                <h2>Person not found</h2>
                <Link to="/people" className="btn btn-primary">Back to People</Link>
            </div>
        );
    }

    return (
        <div className="person-detail">
            {/* Back Link */}
            <Link to="/people" className="back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ArrowLeft size={16} />
                <span>Back to People</span>
            </Link>

            {/* Person Header */}
            <header className="person-header glass-card">
                <img src={person.photoUrl} alt={person.name} className="person-avatar" />
                <div className="person-header-info">
                    <h1 className="person-header-name">{person.name}</h1>
                    <span className="person-header-relation">{person.relation}</span>
                </div>
                <div className="person-header-actions">
                    <button
                        className="btn btn-danger"
                        onClick={() => setDeleteConfirm(true)}
                    >
                        Delete Person
                    </button>
                </div>
            </header>

            {/* Conversations Section */}
            <section className="conversations-section">
                <div className="section-header">
                    <h2 className="section-title">Conversations</h2>
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            setShowAddConvo(true);
                            tourEvents.emit('modal:open', { modalId: 'add-conversation' });
                        }}
                        data-tour="conversation-add"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Plus size={16} />
                        <span>Add Conversation</span>
                    </button>
                </div>

                {/* Latest Conversation Summary (for AR display) */}
                {conversations.length > 0 && (
                    <div className="latest-convo glass-card">
                        <div className="latest-convo-label">
                            <span className="label-icon">
                                <Glasses size={15} />
                            </span>
                            <span>Shown in AR View</span>
                        </div>
                        <p className="latest-convo-summary">{conversations[0].summary}</p>
                        <span className="latest-convo-date">{formatDate(conversations[0].date)}</span>
                    </div>
                )}

                {/* Conversation List */}
                {conversations.length > 0 ? (
                    <div className="conversations-list">
                        {conversations.map((convo) => (
                            <div key={convo.id} className="conversation-item glass-card">
                                <div className="convo-header">
                                    <span className="convo-date">{formatDate(convo.date)}</span>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => handleDeleteConversation(convo.id!)}
                                        aria-label="Delete conversation"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                                <div className="convo-summary">
                                    <span className="summary-icon">
                                        <Sparkles size={16} color="#0071e3" />
                                    </span>
                                    <p>{convo.summary}</p>
                                </div>
                                <details className="convo-details">
                                    <summary>View full conversation</summary>
                                    <p className="convo-raw">{convo.rawText}</p>
                                </details>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-conversations glass-card">
                        <span className="empty-icon" style={{ display: 'flex', justifyContent: 'center' }}>
                            <MessageSquare size={36} color="#86868b" />
                        </span>
                        <p>No conversations logged yet</p>
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                setShowAddConvo(true);
                                tourEvents.emit('modal:open', { modalId: 'add-conversation' });
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                            <Plus size={16} />
                            <span>Add First Conversation</span>
                        </button>
                    </div>
                )}
            </section>

            {/* Add Conversation Modal */}
            {showAddConvo && (
                <div
                    className="modal-overlay"
                    onClick={() => {
                        setConvoText('');
                        setShowAddConvo(false);
                        tourEvents.emit('modal:close', { modalId: 'add-conversation' });
                    }}
                >
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Add Conversation</h2>
                            <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => {
                                    setConvoText('');
                                    setShowAddConvo(false);
                                    tourEvents.emit('modal:close', { modalId: 'add-conversation' });
                                }}
                                aria-label="Close modal"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleAddConversation} className="modal-body">
                            <p className="modal-description">
                                Describe your conversation with {person.name}.
                            </p>

                            <div className="input-group">
                                <label className="input-label">Conversation Details</label>
                                <textarea
                                    className="input textarea"
                                    placeholder="e.g., We talked about Sarah's hackathon project. She was really excited about her team winning first place..."
                                    value={convoText}
                                    onChange={(e) => setConvoText(e.target.value)}
                                    rows={4}
                                    required
                                    data-tour="conversation-text"
                                />
                            </div>

                            {/* AI Toggle */}
                            <div className="ai-toggle">
                                <label className="toggle-label">
                                    <input
                                        type="checkbox"
                                        checked={useAI}
                                        onChange={(e) => setUseAI(e.target.checked)}
                                    />
                                    <span className="toggle-text">Use AI to summarize</span>
                                </label>
                                {!useAI && (
                                    <p className="ai-toggle-hint">A summary will be auto-generated from the conversation text.</p>
                                )}
                            </div>

                            {summarizing && (
                                <div className="summarizing-indicator">
                                    <div className="spinner"></div>
                                    <span>AI is summarizing...</span>
                                </div>
                            )}

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        setConvoText('');
                                        setShowAddConvo(false);
                                        tourEvents.emit('modal:close', { modalId: 'add-conversation' });
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={saving || !convoText.trim()}
                                    data-tour="conversation-save"
                                >
                                    {saving ? 'Saving...' : 'Add Conversation'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="modal-overlay" onClick={() => setDeleteConfirm(false)}>
                    <div className="modal modal-danger" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Delete {person.name}?</h2>
                        </div>
                        <div className="modal-body">
                            <p>This will permanently delete {person.name} and all their conversations. This action cannot be undone.</p>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setDeleteConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={handleDeletePerson}
                            >
                                Delete Forever
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
