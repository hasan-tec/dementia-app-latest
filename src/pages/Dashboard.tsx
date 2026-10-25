import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Users,
    MessageSquare,
    Bot,
    Glasses,
    UserPlus,
    Rocket,
    ArrowRight
} from 'lucide-react';
import { getStats, getAllPeople, type Person, type Conversation } from '../db/database';
import { checkGeminiConnection } from '../services/gemini';
import './Dashboard.css';

interface Stats {
    totalPeople: number;
    totalConversations: number;
    recentConversations: Conversation[];
}

export function Dashboard() {
    const [stats, setStats] = useState<Stats>({
        totalPeople: 0,
        totalConversations: 0,
        recentConversations: []
    });
    const [people, setPeople] = useState<Person[]>([]);
    const [aiConnected, setAiConnected] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                // Load dashboard stats and people immediately without blocking on remote AI
                const [statsData, peopleData] = await Promise.all([
                    getStats(),
                    getAllPeople()
                ]);
                setStats(statsData);
                setPeople(peopleData);
            } catch (error) {
                console.error('Error loading dashboard data:', error);
            } finally {
                setLoading(false);
            }

            // Non-blocking check for AI connectivity
            checkGeminiConnection()
                .then(setAiConnected)
                .catch(() => setAiConnected(false));
        }
        loadData();
    }, []);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <header className="page-header">
                <div className="page-header-text">
                    <h1 className="page-title">Dashboard</h1>
                    <p className="page-subtitle">Overview of your memory assistance system</p>
                </div>
            </header>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card glass-card">
                    <div className="stat-icon">
                        <Users size={28} color="#0071e3" strokeWidth={2.2} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.totalPeople}</span>
                        <span className="stat-label">People Registered</span>
                    </div>
                </div>

                <div className="stat-card glass-card">
                    <div className="stat-icon">
                        <MessageSquare size={28} color="#34c759" strokeWidth={2.2} />
                    </div>
                    <div className="stat-content">
                        <span className="stat-value">{stats.totalConversations}</span>
                        <span className="stat-label">Conversations Logged</span>
                    </div>
                </div>

                <div className="stat-card glass-card">
                    <div className="stat-icon">
                        <Bot size={28} color="#af52de" strokeWidth={2.2} />
                    </div>
                    <div className="stat-content">
                        <span className={`stat-status ${aiConnected ? 'connected' : 'disconnected'}`}>
                            {aiConnected === null ? 'Checking...' : aiConnected ? 'Connected' : 'Not Configured'}
                        </span>
                        <span className="stat-label">Gemini AI Status</span>
                    </div>
                </div>

                <div className="stat-card glass-card">
                    <div className="stat-icon">
                        <Glasses size={28} color="#ff9500" strokeWidth={2.2} />
                    </div>
                    <div className="stat-content">
                        <Link to="/ar" className="stat-link">Launch AR View</Link>
                        <span className="stat-label">AR Viewer</span>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <section className="dashboard-section">
                <h2 className="section-title">Quick Actions</h2>
                <div className="quick-actions">
                    <Link to="/people" className="action-card glass-card">
                        <span className="action-icon">
                            <UserPlus size={20} color="#0071e3" />
                        </span>
                        <span className="action-text">Add New Person</span>
                    </Link>
                    <Link to="/ar" className="action-card glass-card">
                        <span className="action-icon">
                            <Glasses size={20} color="#ff9500" />
                        </span>
                        <span className="action-text">Open AR Viewer</span>
                    </Link>
                </div>
            </section>

            {/* Recent People */}
            {people.length > 0 && (
                <section className="dashboard-section">
                    <div className="section-header">
                        <h2 className="section-title">Registered People</h2>
                        <Link to="/people" className="section-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span>View All</span>
                            <ArrowRight size={14} />
                        </Link>
                    </div>
                    <div className="people-preview">
                        {people.slice(0, 4).map((person) => (
                            <Link
                                key={person.id}
                                to={`/people/${person.id}`}
                                className="person-preview-card glass-card"
                            >
                                <img
                                    src={person.photoUrl}
                                    alt={person.name}
                                    className="person-preview-photo"
                                />
                                <div className="person-preview-info">
                                    <span className="person-preview-name">{person.name}</span>
                                    <span className="person-preview-relation">{person.relation}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Getting Started */}
            {people.length === 0 && (
                <section className="dashboard-section">
                    <div className="getting-started glass-card">
                        <div className="getting-started-icon">
                            <Rocket size={44} color="#0071e3" strokeWidth={2} />
                        </div>
                        <h3>Get Started</h3>
                        <p>Add your first person to begin using the memory assistance system.</p>
                        <Link to="/people" className="btn btn-primary btn-lg">
                            Add Your First Person
                        </Link>
                    </div>
                </section>
            )}
        </div>
    );
}
