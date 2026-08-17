import React, { useState } from 'react';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';

interface AuthViewProps {
  initialMode?: 'login' | 'register';
}

export const AuthView: React.FC<AuthViewProps> = ({ initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4">
      {/* Main Container */}
      <div className="w-full max-w-sm">
        {mode === 'login' ? (
          <LoginForm onSwitchToRegister={() => setMode('register')} />
        ) : (
          <RegisterForm onSwitchToLogin={() => setMode('login')} />
        )}
      </div>

      {/* Understated Footer */}
      <div className="mt-6 text-center text-[11px] text-zinc-600 font-mono">
        DevDeploy • Self-Hosted Deployment Platform
      </div>
    </div>
  );
};
