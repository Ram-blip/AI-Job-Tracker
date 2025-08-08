import { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import './UserProfile.css';

// Custom SVG icons with better styling
const ChevronDownIcon = () => (
  <svg className="dropdown-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const UserIcon = () => (
  <svg className="dropdown-item-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const LogoutIcon = () => (
  <svg className="dropdown-item-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="dropdown-item-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export default function UserProfile({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Handle overlay click
  const handleOverlayClick = () => {
    setIsOpen(false);
  };

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.post('/auth/logout');
      window.location.reload();
    } catch (error) {
      console.error('Logout failed:', error);
      setLoggingOut(false);
      setIsOpen(false);
    }
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="user-profile" ref={dropdownRef}>
      <button 
        className={`profile-trigger ${isOpen ? 'active' : ''}`}
        onClick={toggleDropdown}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {user.picture && (
          <img 
            src={user.picture} 
            alt={`${user.name || user.email} avatar`}
            className="user-avatar"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={(e) => {
              console.log('❌ Avatar image failed to load:', e.target.src);
              e.target.style.display = 'none';
            }}
            onLoad={() => console.log('✅ Avatar image loaded successfully')}
          />
        )}
        <span className="user-email" title={user.email}>
          {user.email}
        </span>
        <ChevronDownIcon />
      </button>

      {isOpen && <div className="dropdown-overlay" onClick={handleOverlayClick} />}
      
      <div className={`dropdown-menu ${isOpen ? 'open' : ''}`}>
        <div className="dropdown-header">
          <div className="dropdown-user-info">
            {user.picture && (
              <img 
                src={user.picture} 
                alt={`${user.name || user.email} avatar`}
                className="dropdown-avatar"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
                onError={(e) => {
                  console.log('❌ Dropdown avatar failed to load:', e.target.src);
                  e.target.style.display = 'none';
                }}
              />
            )}
            <div className="dropdown-user-details">
              <h4>{user.name || 'User'}</h4>
              <p>{user.email}</p>
            </div>
          </div>
        </div>
        
        <div className="dropdown-body">
          <button className="dropdown-item" disabled>
            <SettingsIcon />
            Account Settings
            <span className="coming-soon-badge">Soon</span>
          </button>
          
          <button 
            className={`dropdown-item danger ${loggingOut ? 'loading' : ''}`}
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <>
                <div className="loading-spinner" />
                Signing out...
              </>
            ) : (
              <>
                <LogoutIcon />
                Sign Out
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}