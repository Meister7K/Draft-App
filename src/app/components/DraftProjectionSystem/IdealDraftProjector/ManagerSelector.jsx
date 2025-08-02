'use client';

import React, { useState, useRef, useEffect } from 'react';

/**
 * ManagerSelector - Dropdown component for selecting any manager in the league
 * Implements manager data loading and selection handling with responsive design
 */
export default function ManagerSelector({ 
  managers = [], 
  selectedManager = null, 
  onManagerChange = null, 
  loading = false,
  placeholder = "Select a manager..."
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  /**
   * Filter managers based on search term
   */
  const filteredManagers = managers.filter(manager => {
    if (!searchTerm) return true;
    
    const name = manager.name || manager.display_name || `Manager ${manager.id}`;
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  /**
   * Handle manager selection
   */
  const handleManagerSelect = (manager) => {
    if (onManagerChange) {
      onManagerChange(manager);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  /**
   * Handle dropdown toggle
   */
  const handleToggleDropdown = () => {
    if (loading) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm('');
    }
  };

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    } else if (event.key === 'Enter' && filteredManagers.length === 1) {
      handleManagerSelect(filteredManagers[0]);
    }
  };

  /**
   * Get display name for a manager
   */
  const getManagerDisplayName = (manager) => {
    return manager.name || manager.display_name || `Manager ${manager.id}`;
  };

  /**
   * Get manager draft position display
   */
  const getManagerDraftPosition = (manager) => {
    if (manager.draftPosition) {
      return `Pick ${manager.draftPosition}`;
    }
    return '';
  };

  /**
   * Get selected manager display text
   */
  const getSelectedManagerText = () => {
    if (!selectedManager) return placeholder;
    
    const name = getManagerDisplayName(selectedManager);
    const position = getManagerDraftPosition(selectedManager);
    
    return position ? `${name} (${position})` : name;
  };

  return (
    <div className="manager-selector" ref={dropdownRef}>
      <label className="selector-label">
        Select Manager
      </label>
      
      <div className="dropdown-container">
        <button
          className={`dropdown-trigger ${isOpen ? 'open' : ''} ${loading ? 'loading' : ''}`}
          onClick={handleToggleDropdown}
          disabled={loading || managers.length === 0}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="selected-text">
            {loading ? 'Loading managers...' : getSelectedManagerText()}
          </span>
          <span className={`dropdown-arrow ${isOpen ? 'rotated' : ''}`}>
            ▼
          </span>
        </button>

        {isOpen && (
          <div className="dropdown-menu" role="listbox">
            {managers.length > 5 && (
              <div className="search-container">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="search-input"
                  placeholder="Search managers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
            )}

            <div className="managers-list">
              {filteredManagers.length === 0 ? (
                <div className="no-results">
                  {searchTerm ? 'No managers found' : 'No managers available'}
                </div>
              ) : (
                filteredManagers.map((manager, index) => (
                  <button
                    key={manager.id || index}
                    className={`manager-option ${
                      selectedManager?.id === manager.id ? 'selected' : ''
                    }`}
                    onClick={() => handleManagerSelect(manager)}
                    role="option"
                    aria-selected={selectedManager?.id === manager.id}
                  >
                    <div className="manager-info">
                      <div className="manager-name">
                        {getManagerDisplayName(manager)}
                      </div>
                      {getManagerDraftPosition(manager) && (
                        <div className="manager-position">
                          {getManagerDraftPosition(manager)}
                        </div>
                      )}
                    </div>
                    {manager.avatar && (
                      <img
                        src={manager.avatar}
                        alt={`${getManagerDisplayName(manager)} avatar`}
                        className="manager-avatar"
                      />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {managers.length === 0 && !loading && (
        <div className="no-managers-message">
          No managers available. Please check your league data.
        </div>
      )}

      <style jsx>{`
        .manager-selector {
          position: relative;
          width: 100%;
          max-width: 300px;
        }

        .selector-label {
          display: block;
          font-weight: 600;
          color: #333;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .dropdown-container {
          position: relative;
        }

        .dropdown-trigger {
          width: 100%;
          padding: 12px 16px;
          background: white;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 16px;
          transition: all 0.2s ease;
        }

        .dropdown-trigger:hover:not(:disabled) {
          border-color: #007bff;
        }

        .dropdown-trigger.open {
          border-color: #007bff;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }

        .dropdown-trigger:disabled {
          background: #f8f9fa;
          cursor: not-allowed;
          color: #6c757d;
        }

        .dropdown-trigger.loading {
          color: #6c757d;
        }

        .selected-text {
          flex: 1;
          text-align: left;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dropdown-arrow {
          margin-left: 8px;
          transition: transform 0.2s ease;
          color: #666;
        }

        .dropdown-arrow.rotated {
          transform: rotate(180deg);
        }

        .dropdown-menu {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 2px solid #007bff;
          border-top: none;
          border-radius: 0 0 8px 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          max-height: 300px;
          overflow: hidden;
        }

        .search-container {
          padding: 12px;
          border-bottom: 1px solid #e0e0e0;
        }

        .search-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          font-size: 14px;
        }

        .search-input:focus {
          outline: none;
          border-color: #007bff;
        }

        .managers-list {
          max-height: 240px;
          overflow-y: auto;
        }

        .manager-option {
          width: 100%;
          padding: 12px 16px;
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background-color 0.2s ease;
          text-align: left;
        }

        .manager-option:hover {
          background: #f8f9fa;
        }

        .manager-option.selected {
          background: #e3f2fd;
          color: #1976d2;
        }

        .manager-info {
          flex: 1;
        }

        .manager-name {
          font-weight: 500;
          color: #333;
          margin-bottom: 2px;
        }

        .manager-position {
          font-size: 12px;
          color: #666;
        }

        .manager-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          margin-left: 12px;
        }

        .no-results {
          padding: 16px;
          text-align: center;
          color: #666;
          font-style: italic;
        }

        .no-managers-message {
          margin-top: 8px;
          padding: 12px;
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 4px;
          color: #856404;
          font-size: 14px;
        }

        /* Mobile responsive styles */
        @media (max-width: 768px) {
          .manager-selector {
            max-width: 100%;
          }

          .dropdown-trigger {
            padding: 14px 16px;
            font-size: 16px; /* Prevent zoom on iOS */
          }

          .dropdown-menu {
            max-height: 250px;
          }

          .manager-option {
            padding: 14px 16px;
          }

          .manager-name {
            font-size: 16px;
          }

          .manager-position {
            font-size: 14px;
          }
        }

        /* Touch-friendly improvements */
        @media (hover: none) and (pointer: coarse) {
          .manager-option {
            padding: 16px;
          }

          .dropdown-trigger {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
}