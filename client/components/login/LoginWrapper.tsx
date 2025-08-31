import React from 'react';
import Login from './login/Login';
import SignUp from './sign_up/SignUp';
import './LoginWrapper.scss';
import Forgot from './forgot/Forgot';
import {resourceUri} from '../../util/storage';
import {useRouteMatch, Link} from 'react-router-dom';
import block from '../../styles/bem';

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
	}

	// CSS custom properties for SPACE THEME - UZAY AMBIYONSU! 🌌
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

	// Use old wrapper for forgot password
	if (path.startsWith('/forgot')) {
		return (
			<div className={b('wrapper')}>
				<div className={b('header')}>
					<h1>Zkt-Timer</h1>
				</div>
				{body}
			</div>
		);
	}

	return (
		<div 
			style={authPageStyle}
			className="min-h-screen relative overflow-hidden grid place-items-center"
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
			
			{/* Additional Background Animations - Tüm sayfa için */}
			<div className="absolute inset-0 -z-5">
							{/* NEBULA CLOUDS - BULUTSU! 🌠 */}
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
				
							{/* STAR FIELD - YILDIZ ALANI! ⭐ */}
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
							opacity: 0.4 + (Math.random() * 0.6) // Random opacity between 0.4-1.0
						}}
					/>
				);
			})}
				
							{/* COSMIC GRID - KOSMİK AĞ! 🕸️ */}
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
			
			{/* CONSTELLATION LINES - TAKIM YILDIZLARI! ✨ */}
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
			
					{/* SPACESHIP CONSOLE - UZAY GEMİSİ KONSOL! 🚀 */}
		<div 
			className="max-w-sm w-full rounded-[24px] p-6 sm:p-8 backdrop-blur-2xl ring-1 ring-cyan-400/20 shadow-2xl hover:ring-cyan-400/40 hover:shadow-cyan-400/10 transition-all duration-500 relative mx-4"
			style={{
				backgroundColor: 'var(--card-bg)',
				borderColor: 'var(--card-stroke)',
				boxShadow: '0 30px 60px -12px rgba(10, 10, 15, 0.8), 0 0 0 1px rgba(79, 195, 247, 0.2), 0 0 20px rgba(79, 195, 247, 0.1)',
				border: '1px solid var(--card-stroke)'
			} as React.CSSProperties}
		>
			{/* Holographic Inner Glow - HOLOGRAFİK AURA */}
			<div 
				className="absolute inset-0 rounded-[24px] pointer-events-none opacity-60"
				style={{
					background: `linear-gradient(135deg, 
						rgba(79, 195, 247, 0.1) 0%, 
						transparent 30%, 
						rgba(142, 36, 170, 0.08) 70%, 
						transparent 100%)`,
					boxShadow: 'inset 0 0 30px rgba(79, 195, 247, 0.05), inset 0 0 60px rgba(142, 36, 170, 0.03)'
				} as React.CSSProperties}
			/>
			
			{/* Circuit Pattern - DEVRe DESENİ */}
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
			
			{/* Corner Accents - KÖŞE VURGULARI */}
			<div className="absolute top-0 right-0 w-16 h-16 rounded-br-[24px] opacity-30 pointer-events-none"
				style={{
					background: `radial-gradient(circle at top right, var(--cosmic-glow) 0%, transparent 70%)`
				}}
			/>
			<div className="absolute bottom-0 left-0 w-16 h-16 rounded-tl-[24px] opacity-20 pointer-events-none"
				style={{
					background: `radial-gradient(circle at bottom left, var(--plasma-purple) 0%, transparent 70%)`
				}}
			/>
				
							{/* COSMIC LOGO - KOSMİK LOGO! 🌟 */}
			<div className="flex justify-center mb-6 relative">
				<div className="relative">
					{/* Orbital Ring */}
					<div className="absolute inset-0 w-16 h-16 rounded-full animate-spin"
						style={{
							background: `conic-gradient(from 0deg, transparent, var(--cosmic-glow), transparent)`,
							animation: 'spin 8s linear infinite'
						}}
					/>
					
					{/* Text-Based Logo as Fallback */}
					<div className="w-16 h-16 rounded-full relative z-10 flex items-center justify-center text-center"
						style={{
							background: `linear-gradient(135deg, var(--cosmic-glow) 0%, var(--plasma-purple) 100%)`,
							boxShadow: '0 0 30px rgba(79, 195, 247, 0.4), 0 0 60px rgba(79, 195, 247, 0.2), inset 0 0 20px rgba(79, 195, 247, 0.1)',
							border: '2px solid rgba(79, 195, 247, 0.5)'
						}}
					>
						<div className="text-white font-bold text-xs leading-tight">
							<div className="text-sm">ZKT</div>
							<div className="text-xs opacity-80">Timer</div>
						</div>
					</div>
					
					{/* Energy Pulse */}
					<div className="absolute inset-0 w-16 h-16 rounded-full opacity-60"
						style={{
							background: `radial-gradient(circle, rgba(79, 195, 247, 0.2) 0%, transparent 70%)`,
							animation: 'pulse 3s ease-in-out infinite'
						}}
					/>
				</div>
			</div>
				
							{/* COSMIC WELCOME - KOSMİK KARŞILAMA! */}
			<h1 className="text-2xl font-semibold mb-6 text-center bg-gradient-to-r from-cyan-200 via-blue-200 to-purple-200 bg-clip-text text-transparent">
				Hoş geldin
			</h1>
				
							{/* NAVIGATION CONSOLE - NAVİGASYON KONSOL! */}
			{(currentTab === 'login' || currentTab === 'signup') && (
				<div className="flex justify-center gap-8 mb-6">
					<Link 
						to="/login"
						className={`transition-all duration-300 relative ${
							currentTab === 'login' 
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
						className={`transition-all duration-300 relative ${
							currentTab === 'signup' 
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
		</div>
	);
}
