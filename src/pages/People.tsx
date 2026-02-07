import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getAllPeople, addPerson, deletePerson, type Person } from '../db/database';
import { extractFaceDescriptor, loadFaceDetectionModels } from '../services/faceDetection';
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
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
    const [faceStatus, setFaceStatus] = useState<'none' | 'extracting' | 'found' | 'not_found'>('none');
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const photoImgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        loadPeople();
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
        if (file) {
            setPhotoFile(file);
            setFaceDescriptor(null);
            setFaceStatus('none');

            const reader = new FileReader();
            reader.onloadend = async () => {
                const dataUrl = reader.result as string;
                setPhotoPreview(dataUrl);

                // Extract face descriptor from the image
                setFaceStatus('extracting');

                try {
                    // Load models first if needed
                    await loadFaceDetectionModels();

                    // Create image element for face extraction
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = async () => {
                        const descriptor = await extractFaceDescriptor(img);

                        if (descriptor) {
                            setFaceDescriptor(descriptor);
                            setFaceStatus('found');
                            console.log('Face descriptor extracted successfully');
                        } else {
                            setFaceStatus('not_found');
                            console.warn('No face found in image');
                        }
                    };
                    img.src = dataUrl;
                } catch (error) {
                    console.error('Error extracting face:', error);
                    setFaceStatus('not_found');
                }
            };
            reader.readAsDataURL(file);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.name || !formData.relation || !photoFile) return;

        setSaving(true);
        try {
            // Pass face descriptor to addPerson (may be null if face not detected)
            await addPerson(formData.name, formData.relation, photoFile, faceDescriptor ?? undefined);
            await loadPeople();
            resetForm();
            setShowModal(false);
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
        setPhotoFile(null);
        setPhotoPreview(null);
        setFaceDescriptor(null);
        setFaceStatus('none');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    const filteredPeople = people.filter(person =>
        person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        person.relation.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                    <p className="page-subtitle">Manage registered people for face recognition</p>
                </div>
            </header>

            {/* Actions Bar */}
            <div className="actions-bar">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search by name or relation..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <span>➕</span> Add Person
                </button>
            </div>

            {/* People Grid */}
            {filteredPeople.length > 0 ? (
                <div className="people-grid">
                    {filteredPeople.map((person) => (
                        <div key={person.id} className="person-card glass-card">
                            <Link to={`/people/${person.id}`} className="person-card-link">
                                <img
                                    src={person.photoUrl}
                                    alt={person.name}
                                    className="person-photo"
                                />
                                <div className="person-info">
                                    <h3 className="person-name">{person.name}</h3>
                                    <span className="person-relation">{person.relation}</span>
                                </div>
                            </Link>
                            <div className="person-actions">
                                <Link to={`/people/${person.id}`} className="btn btn-ghost btn-sm">
                                    View
                                </Link>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => setDeleteConfirm(person.id!)}
                                >
                                    🗑️
                                </button>
                            </div>

                            {/* Delete Confirmation */}
                            {deleteConfirm === person.id && (
                                <div className="delete-confirm">
                                    <p>Delete {person.name}?</p>
                                    <div className="delete-actions">
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
                                onClick={() => setShowModal(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-body">
                            {/* Photo Upload */}
                            <div className="photo-upload">
                                <div
                                    className={`photo-preview ${photoPreview ? 'has-photo' : ''}`}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {photoPreview ? (
                                        <img ref={photoImgRef} src={photoPreview} alt="Preview" />
                                    ) : (
                                        <div className="photo-placeholder">
                                            <span className="photo-icon">📷</span>
                                            <span className="photo-text">Click to upload photo</span>
                                        </div>
                                    )}
                                </div>

                                {/* Face Detection Status */}
                                {faceStatus !== 'none' && (
                                    <div className={`face-status ${faceStatus}`}>
                                        {faceStatus === 'extracting' && (
                                            <>
                                                <div className="spinner" style={{ width: 14, height: 14 }}></div>
                                                <span>Detecting face...</span>
                                            </>
                                        )}
                                        {faceStatus === 'found' && (
                                            <>
                                                <span className="status-icon">✅</span>
                                                <span>Face detected! Ready for recognition.</span>
                                            </>
                                        )}
                                        {faceStatus === 'not_found' && (
                                            <>
                                                <span className="status-icon">⚠️</span>
                                                <span>No face detected. Try a clearer photo.</span>
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
                                    disabled={saving || !formData.name || !formData.relation || !photoFile}
                                >
                                    {saving ? (
                                        <>
                                            <div className="spinner" style={{ width: 16, height: 16 }}></div>
                                            Saving...
                                        </>
                                    ) : (
                                        'Add Person'
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
