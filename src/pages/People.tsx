import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getAllPeople, addPerson, deletePerson, type Person } from '../db/database';
import { EnrollmentController, type EnrollmentState } from '../features/people/enrollment';
import { tourEvents } from '../features/onboarding/events';
import './People.css';

export function People() {
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        relation: ''
    });
    const [enrollmentState, setEnrollmentState] = useState<EnrollmentState>({
        step: 'idle',
        generation: 0,
        imageBlob: null,
        previewUrl: null,
        descriptor: null,
        descriptorModel: null,
        errorMessage: null,
        allowManualSaveWithoutFace: false,
    });
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const enrollmentControllerRef = useRef<EnrollmentController | null>(null);

    useEffect(() => {
        loadPeople();
        const controller = new EnrollmentController((state) => {
            setEnrollmentState(state);
        });
        enrollmentControllerRef.current = controller;

        return () => {
            controller.destroy();
        };
    }, []);

    async function loadPeople() {
        try {
            const data = await getAllPeople();
            setPeople(data);
        } catch (error) {
            console.error('Error loading people:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file && enrollmentControllerRef.current) {
            enrollmentControllerRef.current.handleFileSelected(file);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.name || !formData.relation || !enrollmentState.imageBlob) return;

        // Block normal save if inference is in-flight or if multiple faces detected
        if (
            enrollmentState.step === 'processing_image' ||
            enrollmentState.step === 'extracting_face' ||
            enrollmentState.step === 'error_multiple_faces'
        ) {
            return;
        }

        setSaving(true);
        try {
            const newId = await addPerson(
                formData.name,
                formData.relation,
                enrollmentState.imageBlob,
                enrollmentState.descriptor ?? undefined
            );
            await loadPeople();
            resetForm();
            setShowModal(false);

            // Notify onboarding tour
            tourEvents.emit('person:save-success', { id: newId, name: formData.name });
        } catch (error) {
            console.error('Error adding person:', error);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: number) {
        try {
            await deletePerson(id);
            await loadPeople();
            setDeleteConfirm(null);
        } catch (error) {
            console.error('Error deleting person:', error);
        }
    }

    function resetForm() {
        setFormData({ name: '', relation: '' });
        enrollmentControllerRef.current?.reset();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    const filteredPeople = people.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.relation.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isSaveDisabled =
        saving ||
        !formData.name ||
        !formData.relation ||
        !enrollmentState.imageBlob ||
        enrollmentState.step === 'processing_image' ||
        enrollmentState.step === 'extracting_face' ||
        enrollmentState.step === 'error_multiple_faces' ||
        (enrollmentState.step === 'error_zero_faces' && !enrollmentState.allowManualSaveWithoutFace) ||
        (enrollmentState.step === 'error_decode_failed');

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading people...</p>
            </div>
        );
    }

    return (
        <div className="people-page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">People</h1>
                    <p className="page-subtitle">Manage registered faces and their details</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)} data-tour="people-add">
                    + Add Person
                </button>
            </header>

            {/* Search Bar */}
            <div className="search-bar">
                <span className="search-icon">🔍</span>
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search by name or relation..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>
                )}
            </div>

            {/* People Grid */}
            {filteredPeople.length > 0 ? (
                <div className="people-grid">
                    {filteredPeople.map((person) => (
                        <div key={person.id} className="person-card">
                            <Link to={`/person/${person.id}`} className="person-card-content" data-tour="person-view">
                                <div className="person-avatar">
                                    {person.photoUrl ? (
                                        <img src={person.photoUrl} alt={person.name} />
                                    ) : (
                                        <div className="person-avatar-placeholder">
                                            {person.name.charAt(0)}
                                        </div>
                                    )}
                                    {person.faceDescriptor && (
                                        <span className="face-badge" title="Face recognition enabled">✓</span>
                                    )}
                                </div>
                                <div className="person-info">
                                    <h3 className="person-name">{person.name}</h3>
                                    <p className="person-relation">{person.relation}</p>
                                </div>
                            </Link>

                            <button
                                className="delete-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirm(person.id!);
                                }}
                                title="Delete person"
                            >
                                🗑️
                            </button>

                            {/* Delete Confirmation Modal */}
                            {deleteConfirm === person.id && (
                                <div className="delete-confirm-overlay" onClick={() => setDeleteConfirm(null)}>
                                    <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
                                        <h4>Delete {person.name}?</h4>
                                        <p>This will also delete all conversation history with this person.</p>
                                        <div className="delete-confirm-actions">
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleDelete(person.id!)}
                                            >
                                                Delete
                                            </button>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => setDeleteConfirm(null)}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state-icon">👥</div>
                    <h3 className="empty-state-title">
                        {searchQuery ? 'No results found' : 'No people registered yet'}
                    </h3>
                    <p className="empty-state-description">
                        {searchQuery
                            ? 'Try adjusting your search terms'
                            : 'Add your first person to get started with face recognition'}
                    </p>
                    {!searchQuery && (
                        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                            Add Your First Person
                        </button>
                    )}
                </div>
            )}

            {/* Add Person Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Add New Person</h2>
                            <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => {
                                    resetForm();
                                    setShowModal(false);
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-body">
                            {/* Photo Upload */}
                            <div className="photo-upload">
                                <div
                                    className={`photo-preview ${enrollmentState.previewUrl ? 'has-photo' : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                    data-tour="person-photo"
                                >
                                    {enrollmentState.previewUrl ? (
                                        <img src={enrollmentState.previewUrl} alt="Preview" />
                                    ) : (
                                        <div className="photo-placeholder">
                                            <span className="photo-icon">📷</span>
                                            <span className="photo-text">Click to upload photo</span>
                                        </div>
                                    )}
                                </div>

                                {/* Face Detection Status */}
                                {enrollmentState.step !== 'idle' && (
                                    <div className={`face-status ${enrollmentState.step}`}>
                                        {(enrollmentState.step === 'processing_image' || enrollmentState.step === 'extracting_face') && (
                                            <>
                                                <div className="spinner" style={{ width: 14, height: 14 }}></div>
                                                <span>
                                                    {enrollmentState.step === 'processing_image'
                                                        ? 'Resizing & preparing photo...'
                                                        : 'Detecting face & extracting embedding...'}
                                                </span>
                                            </>
                                        )}
                                        {enrollmentState.step === 'ready' && (
                                            <>
                                                <span className="status-icon">✅</span>
                                                <span>Face detected and verified! Ready for AR recognition.</span>
                                            </>
                                        )}
                                        {enrollmentState.step === 'error_zero_faces' && (
                                            <>
                                                <span className="status-icon">⚠️</span>
                                                <span>No face detected. You may save photo without recognition or try another photo.</span>
                                            </>
                                        )}
                                        {enrollmentState.step === 'error_multiple_faces' && (
                                            <>
                                                <span className="status-icon">🚫</span>
                                                <span>Multiple faces detected. Please upload a photo with only one person.</span>
                                            </>
                                        )}
                                        {(enrollmentState.step === 'error_model_failed' || enrollmentState.step === 'error_decode_failed') && (
                                            <>
                                                <span className="status-icon">❌</span>
                                                <span>{enrollmentState.errorMessage || 'Photo processing error.'}</span>
                                            </>
                                        )}
                                    </div>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                    style={{ display: 'none' }}
                                />
                            </div>

                            {/* Name Input */}
                            <div className="input-group">
                                <label className="input-label">Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., Sarah"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    data-tour="person-name"
                                />
                            </div>

                            {/* Relation Input */}
                            <div className="input-group">
                                <label className="input-label">Relation</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., Daughter, Caregiver, Friend"
                                    value={formData.relation}
                                    onChange={(e) => setFormData({ ...formData, relation: e.target.value })}
                                    required
                                    data-tour="person-relation"
                                />
                            </div>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                        resetForm();
                                        setShowModal(false);
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isSaveDisabled}
                                    data-tour="person-save"
                                >
                                    {saving ? (
                                        <>
                                            <div className="spinner" style={{ width: 16, height: 16 }}></div>
                                            Saving...
                                        </>
                                    ) : (
                                        enrollmentState.step === 'error_zero_faces'
                                            ? 'Save Without Face Data'
                                            : 'Add Person'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
