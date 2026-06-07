import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 to-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <img
              src="/logo.png"
              alt="Kinetics Group"
              className="h-16 object-contain drop-shadow-lg"
            />
          </div>
          <h1 className="text-2xl font-bold text-white">HR Leave System</h1>
          <p className="text-blue-200 mt-1">Sign in to manage your leaves</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-medium mb-3">Demo credentials</p>
            <div className="space-y-1.5 text-xs text-gray-500">
              <div className="flex justify-between bg-gray-50 px-3 py-2 rounded">
                <span className="font-medium">HR Admin</span>
                <span>admin@company.com / Admin@123</span>
              </div>
              <div className="flex justify-between bg-gray-50 px-3 py-2 rounded">
                <span className="font-medium">Manager</span>
                <span>sara@company.com / Manager@123</span>
              </div>
              <div className="flex justify-between bg-gray-50 px-3 py-2 rounded">
                <span className="font-medium">Employee</span>
                <span>john@company.com / Employee@123</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
