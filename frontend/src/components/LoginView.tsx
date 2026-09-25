import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import { authApi } from '../services/api';
import { Leaf, Eye, EyeOff, Shield, User, Lock, Briefcase, GraduationCap, MapPin, Phone, Award, Smartphone, KeyRound, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { UserRole } from '../types';

interface LoginViewProps {
  onSuccess: (role: UserRole) => void;
  onOpenDownload?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess, onOpenDownload }) => {
  const { login, register, isLoading } = useAuth();
  const { setRoleTheme, tokens } = useTheme();
  const { t } = useLanguage();
  const [selectedRole, setSelectedRole] = useState<UserRole>('FARMER');
  const [isSignUp, setIsSignUp] = useState(false);

  // Forgot Password States
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  // Form Fields (Starts clean — no auto-filled fake credentials)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isTakingLonger, setIsTakingLonger] = useState(false);
  const [canRetry, setCanRetry] = useState(false);

  // Role-specific registration fields
  const [specialization, setSpecialization] = useState('Crop Disease & Plant Pathology');
  const [qualifications, setQualifications] = useState('MSc / PhD in Agricultural Sciences');
  const [yearsExperience, setYearsExperience] = useState('8');
  const [assignedRegion, setAssignedRegion] = useState('Telangana Agricultural Zone');
  const [department, setDepartment] = useState('Department of Agriculture & Plant Protection');

  // Handle role tab switch — updates centralized theme tokens dynamically
  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setRoleTheme(role);
    setError('');
    setCanRetry(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCanRetry(false);
    setIsTakingLonger(false);

    // If request takes longer than 3.5 seconds, display reassurance notice
    const longerTimer = setTimeout(() => {
      setIsTakingLonger(true);
    }, 3500);

    try {
      if (isSignUp) {
        const user = await register({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: selectedRole,
          phone: phone.trim() || undefined,
          specialization: selectedRole === 'EXPERT' ? specialization : undefined,
          qualifications: selectedRole === 'EXPERT' ? qualifications : undefined,
          years_experience: selectedRole === 'EXPERT' ? yearsExperience : undefined,
          assigned_region: selectedRole === 'OFFICER' ? assignedRegion : undefined,
          department: selectedRole === 'OFFICER' ? department : undefined,
        });

        if (user.role !== selectedRole) {
          setError(`Account created with role ${user.role}. Redirecting to ${user.role} dashboard...`);
        }
        onSuccess(user.role);
      } else {
        const user = await login(email.trim(), password, selectedRole);
        if (user.role !== selectedRole) {
          console.info(`User role is ${user.role}. Routing to designated dashboard.`);
        }
        onSuccess(user.role);
      }
    } catch (err: any) {
      setCanRetry(false);
      const isTimeout = err?.code === 'ECONNABORTED' || err?.message?.includes('timeout') || err?.isTimeout;
      const isNetwork = err?.code === 'ERR_NETWORK' || !err?.response;
      const status = err?.response?.status;

      if (status === 400 && err?.response?.data?.detail) {
        // Detailed role mismatch error from server
        setError(err.response.data.detail);
      } else if (status === 401) {
        setError('Invalid email or password. Please verify your credentials and try again.');
      } else if (status === 403) {
        const detail = err?.response?.data?.detail || 'Account has been disabled. Please contact support.';
        setError(detail);
      } else if (isTimeout) {
        setError('Connection timed out. The server is taking longer than usual to respond. Please check your internet connection.');
        setCanRetry(true);
      } else if (isNetwork) {
        setError('Unable to reach AgriGuard server. Please verify your connection or try again.');
        setCanRetry(true);
      } else {
        const detail = err?.response?.data?.detail || 'Authentication failed. Please check credentials.';
        setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }
    } finally {
      clearTimeout(longerTimer);
      setIsTakingLonger(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your registered email address or username.');
      return;
    }
    setIsForgotLoading(true);
    try {
      const res = await authApi.forgotPassword(forgotEmail.trim());
      setForgotSuccess(
        res?.message ||
        'If an account exists for this email, a new temporary password has been sent. Please check your inbox and spam folder.'
      );
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) {
        setForgotError(err?.response?.data?.detail || 'Too many reset requests. Please wait a while before trying again.');
      } else {
        const detail = err?.response?.data?.detail || 'Unable to connect to server. Please check your network connection and try again.';
        setForgotError(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }
    } finally {
      setIsForgotLoading(false);
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'OFFICER': return t('roles.officer');
      case 'EXPERT': return t('roles.expert');
      default: return t('roles.farmer');
    }
  };

  if (isForgotPassword) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative bg-cover bg-center select-none"
        style={{
          backgroundImage: `linear-gradient(rgba(3, 26, 20, 0.70), rgba(1, 14, 11, 0.85)), url('/agri_background.jpg')`,
        }}
      >
        {/* Top Floating Language Selector */}
        <div className="absolute top-4 right-4 z-20">
          <LanguageSelector variant="dropdown" />
        </div>

        <div className="glass-panel w-full max-w-[440px] p-6 sm:p-8 relative border border-emerald-400/25 shadow-[0_20px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl text-center animate-fade-in-up">
          {/* Header */}
          <div className="flex flex-col items-center gap-2 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center shrink-0 shadow-[0_0_25px_rgba(16,185,129,0.45)]">
              <KeyRound className="w-7 h-7 text-emerald-400 stroke-[2.5]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-heading leading-tight">
              {t('auth.forgotPassword', undefined, 'Forgot Password')}
            </h1>
            <p className="text-emerald-200/80 text-[11px] font-semibold tracking-wide">
              {t('auth.accountRecovery', undefined, 'AgriGuard Account Recovery')}
            </p>
          </div>

          <div className="mb-4 text-left">
            <p className="text-emerald-300/70 text-xs mt-0.5 leading-relaxed">
              {t('auth.forgotHelp', undefined, 'Enter your registered email address or username. If an account exists, a secure temporary password will be emailed to you immediately.')}
            </p>
          </div>

          {/* Success Alert */}
          {forgotSuccess && (
            <div className="p-3 mb-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-medium text-left space-y-1">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="leading-snug">{forgotSuccess}</p>
              </div>
              <p className="text-[11px] text-emerald-300/70 pt-1.5 border-t border-emerald-500/20">
                ⚠️ {t('auth.tempPasswordNotice', undefined, 'Temporary passwords expire in 1 hour. You will be required to set a new permanent password immediately upon logging in.')}
              </p>
            </div>
          )}

          {/* Error Alert */}
          {forgotError && (
            <div className="p-3 mb-4 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs font-medium text-left flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="leading-snug">{forgotError}</p>
            </div>
          )}

          <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5 text-left">
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/70 pointer-events-none" />
              <input
                type="text"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder={t('auth.emailOrUsername', undefined, 'Registered email or username')}
                className="glass-input pl-11 text-xs font-medium"
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isForgotLoading}
              className="btn-primary w-full py-2.5 text-xs font-bold tracking-wide flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.35)] cursor-pointer"
            >
              {isForgotLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-emerald-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                t('auth.sendResetPassword', undefined, 'Send Reset Password')
              )}
            </button>
          </form>

          {/* Back to sign in */}
          <div className="mt-5 pt-3 border-t border-emerald-500/20 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setForgotError(null);
                setForgotSuccess(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t('auth.backToSignIn', undefined, 'Back to Sign In')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative bg-cover bg-center select-none"
      style={{
        backgroundImage: `linear-gradient(rgba(3, 26, 20, 0.70), rgba(1, 14, 11, 0.85)), url('/agri_background.jpg')`,
      }}
    >
      {/* Top Floating Language Selector */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector variant="dropdown" />
      </div>

      {/* Centered Glass Login Card — dynamically styled with active role token */}
      <div
        className="glass-panel w-full max-w-[440px] p-6 sm:p-8 relative shadow-[0_20px_60px_rgba(0,0,0,0.65)] backdrop-blur-2xl text-center animate-fade-in-up transition-all duration-300"
        style={{ borderColor: tokens.border }}
      >
        {/* Logo & Brand Header */}
        <div className="flex flex-col items-center gap-2 mb-5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300"
            style={{
              backgroundColor: tokens.soft,
              borderColor: tokens.border,
              borderWidth: '1px',
              borderStyle: 'solid',
              boxShadow: `0 0 25px ${tokens.glow}`,
            }}
          >
            <Leaf className="w-7 h-7 stroke-[2.5]" style={{ color: tokens.primary }} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-heading leading-tight">
            Agri<span style={{ color: tokens.primary }}>Guard</span>
          </h1>
          <p className="text-slate-300 text-[11px] font-semibold tracking-wide">
            {t('common.brandTagline', undefined, 'Healthy Crops • Safe Food • Sustainable Future')}
          </p>
        </div>

        {/* 3-Role Tab Selector with distinct role accent colors */}
        <div className="mb-5 p-1 bg-black/40 rounded-xl border border-white/10 flex items-center gap-1 backdrop-blur-md">
          {(['FARMER', 'OFFICER', 'EXPERT'] as UserRole[]).map((role) => {
            const isActive = selectedRole === role;
            const label = getRoleLabel(role);

            let activeClass = 'bg-emerald-500 text-emerald-950 shadow-[0_0_16px_rgba(16,185,129,0.45)]';
            if (role === 'OFFICER') {
              activeClass = 'bg-amber-500 text-amber-950 shadow-[0_0_16px_rgba(245,158,11,0.45)]';
            } else if (role === 'EXPERT') {
              activeClass = 'bg-cyan-500 text-cyan-950 shadow-[0_0_16px_rgba(6,182,212,0.45)]';
            }

            return (
              <button
                key={role}
                type="button"
                onClick={() => handleRoleChange(role)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? activeClass
                    : 'text-slate-300/80 hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Welcome Text */}
        <div className="mb-4 text-left">
          <h2 className="text-lg sm:text-xl font-black text-white font-heading">
            {isSignUp
              ? t('auth.createRoleAccount', { role: getRoleLabel(selectedRole) }, `Register as ${getRoleLabel(selectedRole)}`)
              : t('auth.welcomeRole', { role: getRoleLabel(selectedRole) }, `Welcome, ${getRoleLabel(selectedRole)}!`)}
          </h2>
          <p className="text-emerald-300/70 text-xs mt-0.5">
            {isSignUp
              ? t('auth.createProfile', undefined, 'Create your official profile with verified credentials.')
              : t('auth.signInToAccess', undefined, 'Sign in to access your role-specific dashboard and analytics.')}
          </p>
        </div>

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs font-medium text-left space-y-2">
            <p>{error}</p>
            {canRetry && (
              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-100 text-[11px] font-bold transition cursor-pointer"
              >
                <span>{t('common.tryAgain', undefined, 'Try Again')}</span>
              </button>
            )}
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          {/* Sign-up Full Name */}
          {isSignUp && (
            <div>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/70 pointer-events-none" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={selectedRole === 'EXPERT' ? t('auth.drFullName', undefined, 'Dr. Full Name') : t('auth.fullName', undefined, 'Full Name')}
                  className="glass-input pl-11 text-xs"
                  required
                />
              </div>
            </div>
          )}

          {/* Email field */}
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/70 pointer-events-none" />
            <input
              type={isSignUp ? 'email' : 'text'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isSignUp ? t('auth.email', undefined, 'Email address') : t('auth.emailOrUsername', undefined, 'Email address or username')}
              className="glass-input pl-11 text-xs font-medium"
              required
              autoComplete="username"
            />
          </div>

          {/* Phone (for Farmer sign-up) */}
          {isSignUp && selectedRole === 'FARMER' && (
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/70 pointer-events-none" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('auth.phone', undefined, 'Mobile number (optional)')}
                className="glass-input pl-11 text-xs"
              />
            </div>
          )}

          {/* Expert-specific sign-up fields */}
          {isSignUp && selectedRole === 'EXPERT' && (
            <>
              <div className="relative">
                <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/70 pointer-events-none" />
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder={t('auth.specialization', undefined, 'Specialization (e.g. Plant Pathology)')}
                  className="glass-input pl-11 text-xs"
                  required
                />
              </div>

              <div className="relative">
                <Award className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/70 pointer-events-none" />
                <input
                  type="text"
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  placeholder={t('auth.qualifications', undefined, 'Qualifications (e.g. PhD Agriculture)')}
                  className="glass-input pl-11 text-xs"
                  required
                />
              </div>

              <div className="relative">
                <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/70 pointer-events-none" />
                <input
                  type="text"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  placeholder={t('auth.yearsExperience', undefined, 'Years of experience')}
                  className="glass-input pl-11 text-xs"
                />
              </div>
            </>
          )}

          {/* Officer-specific sign-up fields */}
          {isSignUp && selectedRole === 'OFFICER' && (
            <>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/70 pointer-events-none" />
                <input
                  type="text"
                  value={assignedRegion}
                  onChange={(e) => setAssignedRegion(e.target.value)}
                  placeholder={t('auth.assignedRegion', undefined, 'Assigned Jurisdiction / District')}
                  className="glass-input pl-11 text-xs"
                  required
                />
              </div>

              <div className="relative">
                <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/70 pointer-events-none" />
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder={t('auth.department', undefined, 'Department / Division')}
                  className="glass-input pl-11 text-xs"
                />
              </div>
            </>
          )}

          {/* Password field */}
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/70 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="glass-input pl-11 pr-11 text-xs font-medium"
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400/60 hover:text-emerald-300 transition cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Remember Me & Forgot Password */}
          {!isSignUp && (
            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 text-emerald-200/80 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
                />
                <span className="font-medium text-[11px]">{t('auth.rememberMe', undefined, 'Remember me')}</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(true);
                  setForgotError(null);
                  setForgotSuccess(null);
                  setForgotEmail(email);
                }}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium underline underline-offset-2 transition cursor-pointer"
              >
                {t('auth.forgotPassword', undefined, 'Forgot password?')}
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-2.5 text-xs font-bold tracking-wide mt-2 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-emerald-950 border-t-transparent rounded-full animate-spin" />
            ) : isSignUp ? (
              t('auth.createRoleAccount', { role: getRoleLabel(selectedRole) }, `Create ${getRoleLabel(selectedRole)} Account`)
            ) : (
              t('auth.signInAs', { role: getRoleLabel(selectedRole) }, `Sign In as ${getRoleLabel(selectedRole)}`)
            )}
          </button>

          {isTakingLonger && (
            <p className="text-[11px] text-emerald-300/80 text-center animate-pulse pt-1">
              {t('auth.connectingSecure', undefined, 'Connecting to AgriGuard secure services (taking a bit longer than usual, please hold on)...')}
            </p>
          )}
        </form>

        {/* Quick Demo Login Chips */}
        {!isSignUp && (
          <div className="mt-4 pt-3 border-t border-emerald-500/20 text-left">
            <p className="text-[10px] font-bold text-emerald-300/70 uppercase tracking-wider mb-2">
              {t('auth.quickCredentials', undefined, 'Quick Test Credentials:')}
            </p>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('FARMER');
                  setEmail('farmer@demo.agriguard.app');
                  setPassword('Demo@1234');
                }}
                className="py-1 px-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40 text-center font-semibold"
              >
                {t('roles.farmer')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('OFFICER');
                  setEmail('officer@demo.agriguard.app');
                  setPassword('Demo@1234');
                }}
                className="py-1 px-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40 text-center font-semibold"
              >
                {t('roles.officer')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('EXPERT');
                  setEmail('expert@demo.agriguard.app');
                  setPassword('Demo@1234');
                }}
                className="py-1 px-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/40 text-center font-semibold"
              >
                {t('roles.expert')}
              </button>
            </div>
          </div>
        )}

        {/* Switch Sign in / Sign up */}
        <div className="mt-4 text-xs text-emerald-300/80">
          <span>{isSignUp ? t('auth.alreadyHaveAccount', undefined, 'Already have an account?') : t('auth.dontHaveAccount', undefined, "Don't have an account?")}</span>{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            className="font-bold text-emerald-400 hover:text-emerald-300 underline underline-offset-2 ml-1 cursor-pointer"
          >
            {isSignUp ? t('auth.login', undefined, 'Sign In') : t('auth.register', undefined, 'Sign Up')}
          </button>
        </div>

        {/* Get the Mobile App Gateway */}
        {onOpenDownload && (
          <div className="mt-4 pt-3 border-t border-emerald-500/20 flex justify-center">
            <button
              type="button"
              onClick={onOpenDownload}
              className="inline-flex items-center gap-1.5 py-1.5 px-3.5 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-white text-xs font-bold transition cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('auth.getMobileApp', undefined, 'Get the App / Download APK')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
