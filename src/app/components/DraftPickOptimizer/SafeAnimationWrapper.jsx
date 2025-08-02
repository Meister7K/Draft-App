/**
 * SafeAnimationWrapper - Prevents CSS animation conflicts
 * Wraps components to isolate animation properties and prevent conflicts
 */

"use client";

import { Component } from "react";

class SafeAnimationWrapper extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Check if error is related to CSS/animation conflicts
    if (error.message && error.message.includes('animation')) {
      return { hasError: true };
    }
    return null;
  }

  componentDidCatch(error, errorInfo) {
    // Log animation-related errors
    if (error.message && error.message.includes('animation')) {
      console.warn('Animation conflict detected and handled:', error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      // Render children without animations - use only individual properties to avoid conflicts
      return (
        <div style={{ 
          animationName: 'none',
          animationDuration: '0s',
          animationDelay: '0s'
        }}>
          {this.props.children}
        </div>
      );
    }

    return this.props.children;
  }
}

export default SafeAnimationWrapper;