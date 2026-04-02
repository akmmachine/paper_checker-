
import React from 'react';
import { UserProfile, UserRole } from '../types';

interface LoginScreenProps {
  users: UserProfile[];
  onLogin: (user: UserProfile) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ users, onLogin, isDarkMode, toggleDarkMode }) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-5 transition-colors duration-300">
      <div className="max-w-md w-full">
        <header className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-6 bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700">
            <span className="bg-indigo-600 text-white p-2.5 rounded-2xl text-2xl">🔍</span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tighter uppercase">Paper AI</h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm uppercase tracking-widest">Select Workspace Identity</p>
        </header>

        <div className="space-y-4">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => onLogin(user)}
              className="w-full flex items-center gap-5 bg-white dark:bg-slate-800 p-5 rounded-3xl border-2 border-slate-100 dark:border-slate-700 hover:border-indigo-500 transition-all active:scale-95 text-left shadow-sm"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shrink-0 ${user.role === UserRole.AUDITOR ? 'bg-indigo-600' : 'bg-rose-600'}`}>
                {user.avatar}
              </div>
              <div className="flex-1 overflow-hidden">
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-50 leading-tight truncate">{user.name}</h3>
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{user.department}</p>
                <div className="mt-2">
                   <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border uppercase tracking-tighter ${user.role === UserRole.AUDITOR ? 'border-indigo-100 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'border-rose-100 text-rose-600 bg-rose-50 dark:bg-rose-900/20'}`}>
                    {user.role === UserRole.AUDITOR ? 'Auditor' : 'QC'}
                  </span>
                </div>
              </div>
              <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
            </button>
          ))}
        </div>

        <footer className="mt-12 text-center space-y-6">
          <button 
            onClick={toggleDarkMode}
            className="px-6 py-2.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-sm"
          >
            {isDarkMode ? '☀️ LIGHT MODE' : '🌙 DARK MODE'}
          </button>
          <p className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.4em]">Academic integrity • v2.5</p>
        </footer>
      </div>
    </div>
  );
};

export default LoginScreen;
