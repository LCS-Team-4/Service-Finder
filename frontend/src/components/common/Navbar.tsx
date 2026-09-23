import { Link, useNavigate } from 'react-router-dom';
import { MapPinned, Menu, X } from 'lucide-react';
import { useState } from 'react';

function Navbar() {
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const token = localStorage.getItem('servicefinder_access_token');

    return (
        <nav className="navbar">
            <Link to="/" className="navbar-brand">
                <MapPinned size={22} />
                <span>The Cape <strong>Guide</strong></span>
            </Link>

            <button
                className="navbar-toggle"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
            >
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
                <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
                <a href="#services" onClick={() => setMenuOpen(false)}>Services</a>
                <a href="#about" onClick={() => setMenuOpen(false)}>About</a>

                {token ? (
                    <button
                        className="navbar-cta"
                        onClick={() => { setMenuOpen(false); navigate('/dashboard'); }}
                    >
                        Dashboard
                    </button>
                ) : (
                    <button
                        className="navbar-cta"
                        onClick={() => { setMenuOpen(false); navigate('/login'); }}
                    >
                        Log In
                    </button>
                )}
            </div>
        </nav>
    );
}

export default Navbar;