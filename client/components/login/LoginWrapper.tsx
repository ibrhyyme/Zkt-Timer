import React from 'react';
// LoginWrapper Component
import Login from './login/Login';
import SignUp from './sign_up/SignUp';
import Forgot from './forgot/Forgot';
import './LoginWrapper.scss';
import { useRouteMatch, Link } from 'react-router-dom';
import block from '../../styles/bem';
import { Cube, Gear, Clock, Lightning } from 'phosphor-react';

const b = block('login');

export default function LoginWrapper() {
    const match = useRouteMatch();
    const path = match.path;

    let body = null;
    let currentTab = '';
    if (path.startsWith('/login')) {
        body = <Login />;
        currentTab = 'login';
    } else if (path.startsWith('/signup')) {
        body = <SignUp />;
        currentTab = 'signup';
    } else if (path.startsWith('/forgot')) {
        body = <Forgot />;
        currentTab = 'forgot';
    }

    // CSS custom properties for SPACE THEME (Geri Yüklendi) 🌌
    const authPageStyle = {
        '--space-black': '#0A0A0F',
        '--space-dark': '#1A1A2E',
        '--nebula-blue': '#16213E',
        '--nebula-purple': '#0F2167',
        '--star-white': '#E0E6ED',
        '--cosmic-glow': '#4FC3F7',
        '--plasma-purple': '#8E24AA',
        '--card-bg': 'rgba(26, 26, 46, 0.7)',
        '--card-stroke': 'rgba(79, 195, 247, 0.3)',
        '--card-stroke-2': 'rgba(142, 36, 170, 0.2)',
        '--card-shadow': '0 24px 80px rgba(0,0,15,0.80)',
        '--input-bg': 'rgba(26, 26, 46, 0.8)',
        '--input-stroke': 'rgba(79, 195, 247, 0.4)',
        '--placeholder': 'rgba(224, 230, 237, 0.60)',
        '--text': '#E0E6ED',
        '--text-dim': 'rgba(224, 230, 237, 0.80)',
        '--tab-active': '#E0E6ED',
        '--tab-inactive': 'rgba(224, 230, 237, 0.65)',
        '--btn-from': '#4FC3F7',
        '--btn-to': '#8E24AA',
        '--btn-shadow': '0 10px 30px rgba(79, 195, 247, 0.4)',
        '--focus': 'rgba(79, 195, 247, 0.70)'
    } as React.CSSProperties;

    return (
        <div
            style={authPageStyle}
            className="min-h-screen relative overflow-x-hidden overflow-y-auto w-full flex flex-col items-center justify-center py-10 px-4"
        >
            {/* SPACE BACKGROUND - UZAY DERIN BOŞLUĞU! 🌌 */}
            <div
                className="absolute inset-0 -z-20"
                style={{
                    background: `
						radial-gradient(ellipse at top left, rgba(15, 33, 103, 0.8) 0%, transparent 50%), 
						radial-gradient(ellipse at top right, rgba(22, 33, 62, 0.6) 0%, transparent 50%),
						radial-gradient(ellipse at bottom, rgba(26, 26, 46, 0.9) 0%, transparent 60%),
						radial-gradient(circle at 30% 40%, rgba(79, 195, 247, 0.1) 0%, transparent 30%),
						radial-gradient(circle at 70% 80%, rgba(142, 36, 170, 0.15) 0%, transparent 35%)`
                }}
            />
            <div
                className="absolute inset-0 -z-10"
                style={{
                    background: `linear-gradient(180deg, var(--space-black) 0%, var(--space-dark) 50%, var(--nebula-blue) 100%)`
                }}
            />

            {/* Additional Background Animations */}
            <div className="absolute inset-0 -z-5">
                {/* NEBULA CLOUDS */}
                <div
                    className="absolute inset-0 opacity-40"
                    style={{
                        background: `
							linear-gradient(45deg, transparent 30%, rgba(79, 195, 247, 0.15) 50%, transparent 70%),
							linear-gradient(-45deg, transparent 30%, rgba(142, 36, 170, 0.12) 50%, transparent 70%),
							radial-gradient(ellipse at 20% 80%, rgba(79, 195, 247, 0.2) 0%, transparent 50%),
							radial-gradient(ellipse at 80% 20%, rgba(142, 36, 170, 0.18) 0%, transparent 50%),
							radial-gradient(ellipse at 50% 30%, rgba(15, 33, 103, 0.3) 0%, transparent 60%),
							radial-gradient(ellipse at 30% 70%, rgba(22, 33, 62, 0.25) 0%, transparent 55%)
						`,
                        backgroundSize: '600% 600%, 600% 600%, 300% 300%, 300% 300%, 400% 400%, 350% 350%',
                        animation: 'gradientMove 15s ease infinite'
                    }}
                />

                {/* STAR FIELD */}
                {[...Array(25)].map((_, i) => {
                    const starTypes = [
                        { size: 'w-1 h-1', color: 'bg-white/70', glow: '0 0 4px rgba(224, 230, 237, 0.8)' },
                        { size: 'w-0.5 h-0.5', color: 'bg-cyan-200/60', glow: '0 0 2px rgba(79, 195, 247, 0.6)' },
                        { size: 'w-1.5 h-1.5', color: 'bg-purple-200/50', glow: '0 0 6px rgba(142, 36, 170, 0.5)' },
                        { size: 'w-2 h-2', color: 'bg-blue-100/80', glow: '0 0 8px rgba(79, 195, 247, 0.7)' }
                    ];
                    const star = starTypes[i % 4];
                    return (
                        <div
                            key={i}
                            className={`absolute ${star.size} ${star.color} rounded-full`}
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                                animation: `float ${8 + (i * 0.4)}s ease-in-out infinite ${i * 0.3}s`,
                                boxShadow: star.glow,
                                opacity: 0.4 + (Math.random() * 0.6)
                            }}
                        />
                    );
                })}

                {/* COSMIC GRID */}
                <div
                    className="absolute inset-0 opacity-10"
                    style={{
                        backgroundImage: `
							linear-gradient(rgba(79, 195, 247, 0.15) 1px, transparent 1px),
							linear-gradient(90deg, rgba(142, 36, 170, 0.1) 1px, transparent 1px)
						`,
                        backgroundSize: '60px 60px',
                        animation: 'meshMove 25s linear infinite'
                    }}
                />

                {/* CONSTELLATION LINES */}
                <div
                    className="absolute inset-0 opacity-5"
                    style={{
                        backgroundImage: `
							linear-gradient(45deg, rgba(224, 230, 237, 0.2) 0.5px, transparent 0.5px),
							linear-gradient(-45deg, rgba(79, 195, 247, 0.1) 0.5px, transparent 0.5px)
						`,
                        backgroundSize: '120px 120px',
                        animation: 'meshMove 30s linear infinite reverse'
                    }}
                />
            </div>

            {/* SPACESHIP CONSOLE - CARD */}
            <div
                className="max-w-md w-full rounded-[24px] p-6 sm:p-8 backdrop-blur-2xl ring-1 ring-cyan-400/20 shadow-2xl hover:ring-cyan-400/40 hover:shadow-cyan-400/10 transition-all duration-500 relative"
                style={{
                    backgroundColor: 'var(--card-bg)',
                    borderColor: 'var(--card-stroke)',
                    boxShadow: '0 30px 60px -12px rgba(10, 10, 15, 0.8), 0 0 0 1px rgba(79, 195, 247, 0.2), 0 0 20px rgba(79, 195, 247, 0.1)',
                    border: '1px solid var(--card-stroke)'
                } as React.CSSProperties}
            >
                {/* Holographic Inner Glow */}
                <div
                    className="absolute inset-0 rounded-[24px] pointer-events-none opacity-60"
                    style={{
                        background: `linear-gradient(135deg, rgba(79, 195, 247, 0.1) 0%, transparent 30%, rgba(142, 36, 170, 0.08) 70%, transparent 100%)`,
                        boxShadow: 'inset 0 0 30px rgba(79, 195, 247, 0.05), inset 0 0 60px rgba(142, 36, 170, 0.03)'
                    } as React.CSSProperties}
                />

                {/* Circuit Pattern */}
                <div
                    className="absolute top-4 left-4 w-8 h-8 opacity-20"
                    style={{
                        background: `
							linear-gradient(90deg, var(--cosmic-glow) 2px, transparent 2px),
							linear-gradient(var(--cosmic-glow) 2px, transparent 2px),
							linear-gradient(45deg, transparent 2px, var(--cosmic-glow) 2px, var(--cosmic-glow) 4px, transparent 4px)
						`,
                        backgroundSize: '8px 8px, 8px 8px, 16px 16px'
                    }}
                />

                {/* Corner Accents */}
                <div className="absolute top-0 right-0 w-16 h-16 rounded-br-[24px] opacity-30 pointer-events-none"
                    style={{ background: `radial-gradient(circle at top right, var(--cosmic-glow) 0%, transparent 70%)` }}
                />
                <div className="absolute bottom-0 left-0 w-16 h-16 rounded-tl-[24px] opacity-20 pointer-events-none"
                    style={{ background: `radial-gradient(circle at bottom left, var(--plasma-purple) 0%, transparent 70%)` }}
                />

                {/* ANIMATED CUBE LOGO */}
                <div className="flex justify-center mb-6 relative">
                    <div className="relative">
                        {/* Cube Container */}
                        <div className="relative inline-block" style={{ animation: 'cubeFloat 6s ease-in-out infinite' }}>
                            <Cube
                                size={64}
                                style={{
                                    color: 'var(--cosmic-glow)',
                                    filter: 'drop-shadow(0 10px 30px rgba(79, 195, 247, 0.3))',
                                    animation: 'cubeRotate 12s linear infinite'
                                }}
                            />

                            {/* Floating Icons */}
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                                <Gear
                                    size={16}
                                    className="absolute"
                                    style={{
                                        color: 'var(--plasma-purple)',
                                        opacity: 0.8,
                                        top: '-40px',
                                        left: '-40px',
                                        animation: 'iconOrbit 8s linear infinite, iconSpin 4s linear infinite'
                                    }}
                                />
                                <Clock
                                    size={16}
                                    className="absolute"
                                    style={{
                                        color: 'var(--plasma-purple)',
                                        opacity: 0.8,
                                        top: '-40px',
                                        right: '-40px',
                                        animation: 'iconOrbit 10s linear infinite reverse, iconBounce 2s ease-in-out infinite'
                                    }}
                                />
                                <Lightning
                                    size={16}
                                    className="absolute"
                                    style={{
                                        color: 'var(--plasma-purple)',
                                        opacity: 0.8,
                                        bottom: '-40px',
                                        left: '0',
                                        animation: 'iconOrbit 12s linear infinite, iconFlash 3s ease-in-out infinite'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* COSMIC WELCOME */}
                <h1 className="text-2xl font-semibold mb-6 text-center bg-gradient-to-r from-cyan-200 via-blue-200 to-purple-200 bg-clip-text text-transparent">
                    {currentTab === 'forgot' ? 'Şifre Sıfırla' : 'Hoş geldin'}
                </h1>

                {/* NAVIGATION CONSOLE */}
                {(currentTab === 'login' || currentTab === 'signup') && (
                    <div className="flex justify-center gap-8 mb-6">
                        <Link
                            to="/login"
                            className={`transition-all duration-300 relative ${currentTab === 'login'
                                ? 'font-medium text-cyan-200'
                                : 'hover:text-cyan-300 text-gray-400'
                                }`}
                            style={{
                                textShadow: currentTab === 'login' ? '0 0 10px rgba(79, 195, 247, 0.5)' : 'none'
                            }}
                        >
                            {currentTab === 'login' && (
                                <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
                            )}
                            Giriş
                        </Link>
                        <Link
                            to="/signup"
                            className={`transition-all duration-300 relative ${currentTab === 'signup'
                                ? 'font-medium text-cyan-200'
                                : 'hover:text-cyan-300 text-gray-400'
                                }`}
                            style={{
                                textShadow: currentTab === 'signup' ? '0 0 10px rgba(79, 195, 247, 0.5)' : 'none'
                            }}
                        >
                            {currentTab === 'signup' && (
                                <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>
                            )}
                            Kayıt Ol
                        </Link>
                    </div>
                )}

                {body}
            </div>

            {/* DEMO BUTONU - SADE */}
            <div className="mt-8 z-20 animate-fade-in-up">
                <Link
                    to="/"
                    className="group relative inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[var(--card-bg)] hover:bg-[var(--bg-light)] border border-[var(--card-stroke)] transition-all duration-300 backdrop-blur-md"
                >
                    <span className="text-sm font-medium text-cyan-200 group-hover:text-white transition-colors">Kararsız mısın? Bir göz at</span>
                    {/* ArrowRight ikonu eklemek için Phosphor import'una eklenmesi gerek, şimdilik basit metin */}
                </Link>
            </div>
        </div>
    );
}
