import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, X, Trash2, Check, User, Camera, Users, CheckCircle2, AlertTriangle, AlertOctagon, XCircle } from 'lucide-react';
import { getAllPeople, addPerson, deletePerson, type Person } from '../db/database';
import { EnrollmentController, type EnrollmentState } from '../features/people/enrollment';
import { tourEvents } from '../features/onboarding/events';
import { useTour } from '../components/tour/TourProvider';
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
    const [deleteConfirm, setDeleteConfirm] = useState<string | number | null>(null);
    const [deleting, setDeleting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const enrollmentControllerRef = useRef<EnrollmentController | null>(null);
    const { status, currentStep } = useTour();

    // Auto-open modal when tour guides through the add-person form
    useEffect(() => {
        if (status !== 'active' || !currentStep) return;

        const isFormStep =
            currentStep.id === 'step-person-photo' ||
            currentStep.id === 'step-person-name' ||
            currentStep.id === 'step-person-relation' ||
            currentStep.id === 'step-person-save';

        if (isFormStep) {
            setShowModal(true);
        } else if (currentStep.id === 'step-people-add' || currentStep.id === 'step-person-view') {
            setShowModal(false);
        }
    }, [currentStep?.id, status]);

    // Ensure at least one person card is available to showcase in Step 7
    useEffect(() => {
        if (status === 'active' && currentStep?.id === 'step-person-view' && !loading && people.length === 0) {
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#0071e3';
                ctx.beginPath();
                ctx.arc(50, 50, 50, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 44px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('S', 50, 52);
            }
            canvas.toBlob((blob) => {
                if (blob) {
                    addPerson('Sarah', 'Daughter', blob).then(() => loadPeople());
                }
            }, 'image/png');
        }
    }, [status, currentStep?.id, loading, people.length]);

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

    async function handleDelete(id: string | number) {
        setDeleting(true);
        try {
            await deletePerson(id);
            await loadPeople();
            setDeleteConfirm(null);
        } catch (error) {
            console.error('Error deleting person:', error);
        } finally {
            setDeleting(false);
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

    const personToDelete = people.find(p => p.id === deleteConfirm);

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
                <div className="page-header-text">
                    <h1 className="page-title">People</h1>
                    <p className="page-subtitle">Manage registered faces and their details</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => {
                        setShowModal(true);
                        tourEvents.emit('modal:open', { modalId: 'add-person' });
                    }}
                    data-tour="people-add"
                >
                    <Plus size={18} />
                    <span>Add Person</span>
                </button>
            </header>

            {/* Search Bar */}
            <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search by name or relation..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button className="search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
                        <X size={15} />
                    </button>
                )}
            </div>

            {/* People Grid */}
            {filteredPeople.length > 0 ? (
                <div className="people-grid">
                    {filteredPeople.map((person, index) => (
                        <div key={person.id} className="person-card">
                            <button
                                type="button"
                                className="delete-btn"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDeleteConfirm(person.id!);
                                }}
                                title={`Delete ${person.name}`}
                                aria-label={`Delete ${person.name}`}
                            >
                                <Trash2 size={15} />
                            </button>

                            <Link
                                to={`/people/${person.id}`}
                                className="person-card-content"
                                data-tour={index === 0 ? 'person-view' : undefined}
                            >
                                <div className="person-avatar">
                                    {person.photoUrl ? (
                                        <img src={person.photoUrl} alt={person.name} className="person-avatar-img" />
                                    ) : (
                                        <div className="person-avatar-placeholder">
                                            {person.name ? person.name.charAt(0).toUpperCase() : <User size={36} />}
                                        </div>
                                    )}
                                    {person.faceDescriptor && (
                                        <span className="face-badge" title="Face recognition enabled">
                                            <Check size={13} strokeWidth={3} />
                                        </span>
                                    )}
                                </div>
                                <div className="person-info">
                                    <h3 className="person-name">{person.name}</h3>
                                    <span className="person-relation">{person.relation}</span>
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                        <Users size={48} color="#86868b" strokeWidth={1.75} />
                    </div>
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
                <div
                    className="modal-overlay"
                    onClick={() => {
                        resetForm();
                        setShowModal(false);
                        tourEvents.emit('modal:close', { modalId: 'add-person' });
                    }}
                >
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Add New Person</h2>
                            <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => {
                                    resetForm();
                                    setShowModal(false);
                                    tourEvents.emit('modal:close', { modalId: 'add-person' });
                                }}
                                aria-label="Close modal"
                            >
                                <X size={20} />
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
                                            <Camera size={28} className="photo-icon" />
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
                                                <CheckCircle2 size={16} color="#34c759" className="status-icon" />
                                                <span>Face detected and verified! Ready for AR recognition.</span>
                                            </>
                                        )}
                                        {enrollmentState.step === 'error_zero_faces' && (
                                            <>
                                                <AlertTriangle size={16} color="#ff9500" className="status-icon" />
                                                <span>No face detected. You may save photo without recognition or try another photo.</span>
                                            </>
                                        )}
                                        {enrollmentState.step === 'error_multiple_faces' && (
                                            <>
                                                <AlertOctagon size={16} color="#ff3b30" className="status-icon" />
                                                <span>Multiple faces detected. Please upload a photo with only one person.</span>
                                            </>
                                        )}
                                        {(enrollmentState.step === 'error_model_failed' || enrollmentState.step === 'error_decode_failed') && (
                                            <>
                                                <XCircle size={16} color="#ff3b30" className="status-icon" />
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
                                        tourEvents.emit('modal:close', { modalId: 'add-person' });
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

            {/* Delete Confirmation Modal (Popup) */}
            {personToDelete && (
                <div className="modal-overlay" onClick={() => !deleting && setDeleteConfirm(null)}>
                    <div className="modal delete-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="delete-modal-icon-wrap">
                            <Trash2 size={26} />
                        </div>
                        <h2 className="delete-modal-title">Delete {personToDelete.name}?</h2>
                        <p className="delete-modal-desc">
                            Are you sure you want to delete <strong>{personToDelete.name}</strong>? This will permanently remove their face recognition profile and all associated conversation history.
                        </p>
                        <div className="delete-modal-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setDeleteConfirm(null)}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={() => handleDelete(personToDelete.id!)}
                                disabled={deleting}
                            >
                                {deleting ? (
                                    <>
                                        <div className="spinner" style={{ width: 14, height: 14, borderTopColor: 'white' }}></div>
                                        <span>Deleting...</span>
                                    </>
                                ) : (
                                    'Delete Person'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
