import React, { useState, useEffect } from 'react';

function Login() {
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'L') {
        event.preventDefault();
        setShowAdmin(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleUserLogin = (e) => {
    e.preventDefault();
    // Handle regular user login logic
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    // Handle admin login logic
  };

  return (
    <div>
      <h2>User Login</h2>
      <form onSubmit={handleUserLogin}>
        <input type="email" placeholder="Email" required />
        <input type="password" placeholder="Password" required />
        <button type="submit">Login</button>
      </form>

      {showAdmin && (
        <div>
          <h2>Admin Login</h2>
          <form onSubmit={handleAdminLogin}>
            <input type="email" placeholder="Admin Email" required />
            <input type="password" placeholder="Admin Password" required />
            <button type="submit">Admin Login</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default Login;