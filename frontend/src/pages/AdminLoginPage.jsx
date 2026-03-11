import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api/client';
import './AdminLoginPage.css';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await login({ email: email.trim(), password });
      if (data.user?.role !== 'admin') {
        setError('Access denied. This portal is for system administrators only.');
        setLoading(false);
        return;
      }
      localStorage.setItem('agrifinconnect-token', data.token);
      localStorage.setItem('agrifinconnect-user', JSON.stringify(data.user || {}));
      navigate('/dashboard/admin');
    } catch (err) {
      if (err.status === 401) setError('Invalid email or password.');
      else setError('Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-page__card">
        <Link to="/" className="admin-login-page__logo-link">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="AgriFinConnect Rwanda"
            className="admin-login-page__logo"
          />
        </Link>

        <h1 className="admin-login-page__title">Administrator Login</h1>
        <p className="admin-login-page__subtitle">AgriFinConnect Rwanda — System Administration</p>

        <form className="admin-login-page__form" onSubmit={handleSubmit} noValidate>
          <div className="admin-login-page__field">
            <label htmlFor="admin-email" className="admin-login-page__label">Email / Username</label>
            <input
              id="admin-email"
              type="text"
              className="admin-login-page__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="admin-login-page__field">
            <label htmlFor="admin-password" className="admin-login-page__label">Password</label>
            <input
              id="admin-password"
              type="password"
              className="admin-login-page__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="admin-login-page__error">{error}</p>}

          <button
            type="submit"
            className="admin-login-page__submit"
            disabled={loading || !email.trim() || !password.trim()}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <Link to="/get-started" className="admin-login-page__back">
          ← Back to Get Started
        </Link>
      </div>
    </div>
  );
}
