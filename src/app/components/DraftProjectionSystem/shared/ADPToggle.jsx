'use client';

import React from 'react';

/**
 * ADPToggle - Toggle switch component for enabling/disabling ADP data
 * Provides user control over ADP integration in player valuations
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.5
 */
export default function ADPToggle(props = {}) {
  const { 
    enabled = false, 
    onChange = null, 
    disabled = false,
    showLabel = true,
    showDescription = true,
    className = ''
  } = props;
  /**
   * Handle toggle change with fallback logic
   */
  const handleToggleChange = (event) => {
    const newValue = event.target.checked;
    
    // Call onChange callback if provided
    if (onChange && typeof onChange === 'function') {
      onChange(newValue);
    }
  };

  return (
    <div className={`adp-toggle-container ${className}`}>
      <div className="adp-toggle-wrapper">
        <label className="adp-toggle-label">
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggleChange}
            disabled={disabled}
            className="adp-toggle-input"
            aria-label="Toggle ADP data integration"
          />
          <span className="adp-toggle-slider"></span>
          {showLabel && (
            <span className="adp-toggle-text">
              Include ADP Data
            </span>
          )}
        </label>
        
        {showDescription && (
          <div className="adp-toggle-description">
            {enabled 
              ? "ADP data is being used to influence player valuations" 
              : "Player valuations based purely on projections and positional value"
            }
          </div>
        )}
      </div>

      <style jsx>{`
        .adp-toggle-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .adp-toggle-wrapper {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .adp-toggle-label {
          display: flex;
          align-items: center;
          cursor: pointer;
          user-select: none;
          gap: 12px;
          font-weight: 500;
          color: #333;
          transition: color 0.2s ease;
        }

        .adp-toggle-label:hover {
          color: #007bff;
        }

        .adp-toggle-label[disabled] {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .adp-toggle-input {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        .adp-toggle-slider {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 24px;
          background-color: #ccc;
          border-radius: 24px;
          transition: background-color 0.3s ease;
          flex-shrink: 0;
        }

        .adp-toggle-slider:before {
          content: "";
          position: absolute;
          height: 18px;
          width: 18px;
          left: 3px;
          top: 3px;
          background-color: white;
          border-radius: 50%;
          transition: transform 0.3s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .adp-toggle-input:checked + .adp-toggle-slider {
          background-color: #007bff;
        }

        .adp-toggle-input:checked + .adp-toggle-slider:before {
          transform: translateX(26px);
        }

        .adp-toggle-input:disabled + .adp-toggle-slider {
          background-color: #e0e0e0;
          cursor: not-allowed;
        }

        .adp-toggle-input:disabled + .adp-toggle-slider:before {
          background-color: #f5f5f5;
        }

        .adp-toggle-input:focus + .adp-toggle-slider {
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.25);
        }

        .adp-toggle-text {
          font-size: 14px;
          font-weight: 500;
          color: inherit;
        }

        .adp-toggle-description {
          font-size: 12px;
          color: #666;
          line-height: 1.4;
          margin-left: 62px;
          max-width: 300px;
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .adp-toggle-label {
            color: #e0e0e0;
          }

          .adp-toggle-label:hover {
            color: #4dabf7;
          }

          .adp-toggle-slider {
            background-color: #555;
          }

          .adp-toggle-input:checked + .adp-toggle-slider {
            background-color: #4dabf7;
          }

          .adp-toggle-input:disabled + .adp-toggle-slider {
            background-color: #333;
          }

          .adp-toggle-description {
            color: #aaa;
          }
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .adp-toggle-description {
            margin-left: 0;
            margin-top: 4px;
          }
        }

        /* High contrast mode */
        @media (prefers-contrast: high) {
          .adp-toggle-slider {
            border: 2px solid #000;
          }

          .adp-toggle-input:checked + .adp-toggle-slider {
            background-color: #000;
          }

          .adp-toggle-slider:before {
            border: 1px solid #000;
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .adp-toggle-slider,
          .adp-toggle-slider:before,
          .adp-toggle-label {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}