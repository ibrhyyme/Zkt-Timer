import React, { useEffect, useRef } from 'react';
import block from '../../../../styles/bem';

const b = block('hero-particles');

// Rubik's cube colors as RGB
const PARTICLE_COLORS = [
	[183, 18, 52],    // Red
	[255, 88, 0],     // Orange
	[255, 255, 255],  // White
	[255, 213, 0],    // Yellow
	[0, 155, 72],     // Green
	[0, 70, 173],     // Blue
];

const PARTICLE_COUNT = 60;
const BASE_SPEED = 0.3;

interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	size: number;
	color: number[];
	opacity: number;
	rotation: number;
	rotationSpeed: number;
}

export default function ParticleCanvas() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		let width = canvas.clientWidth;
		let height = canvas.clientHeight;
		let mouseX = width / 2;
		let mouseY = height / 2;
		let reqId: number;

		// Set canvas size
		function resize() {
			width = canvas.clientWidth;
			height = canvas.clientHeight;
			canvas.width = width * window.devicePixelRatio;
			canvas.height = height * window.devicePixelRatio;
			ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
		}
		resize();

		// Create particles
		const particles: Particle[] = [];
		for (let i = 0; i < PARTICLE_COUNT; i++) {
			particles.push({
				x: Math.random() * width,
				y: Math.random() * height,
				vx: (Math.random() - 0.5) * BASE_SPEED,
				vy: (Math.random() - 0.5) * BASE_SPEED,
				size: Math.random() * 6 + 2,
				color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
				opacity: Math.random() * 0.4 + 0.1,
				rotation: Math.random() * Math.PI * 2,
				rotationSpeed: (Math.random() - 0.5) * 0.02,
			});
		}

		function render() {
			ctx.clearRect(0, 0, width, height);

			for (const p of particles) {
				// Mouse attraction (subtle)
				const dx = mouseX - p.x;
				const dy = mouseY - p.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist < 300) {
					const force = (300 - dist) / 300 * 0.01;
					p.vx += dx * force * 0.01;
					p.vy += dy * force * 0.01;
				}

				// Damping
				p.vx *= 0.99;
				p.vy *= 0.99;

				// Move
				p.x += p.vx;
				p.y += p.vy;
				p.rotation += p.rotationSpeed;

				// Wrap
				if (p.x < -20) p.x = width + 20;
				if (p.x > width + 20) p.x = -20;
				if (p.y < -20) p.y = height + 20;
				if (p.y > height + 20) p.y = -20;

				// Draw small rounded square
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.rotation);
				ctx.globalAlpha = p.opacity;

				const [r, g, b] = p.color;
				ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
				ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
				ctx.shadowBlur = p.size * 2;

				const half = p.size / 2;
				const radius = p.size * 0.2;
				ctx.beginPath();
				ctx.moveTo(-half + radius, -half);
				ctx.lineTo(half - radius, -half);
				ctx.quadraticCurveTo(half, -half, half, -half + radius);
				ctx.lineTo(half, half - radius);
				ctx.quadraticCurveTo(half, half, half - radius, half);
				ctx.lineTo(-half + radius, half);
				ctx.quadraticCurveTo(-half, half, -half, half - radius);
				ctx.lineTo(-half, -half + radius);
				ctx.quadraticCurveTo(-half, -half, -half + radius, -half);
				ctx.fill();

				ctx.restore();
			}

			reqId = requestAnimationFrame(render);
		}
		render();

		function onMouseMove(e: MouseEvent) {
			const rect = canvas.getBoundingClientRect();
			mouseX = e.clientX - rect.left;
			mouseY = e.clientY - rect.top;
		}

		function onTouchMove(e: TouchEvent) {
			const touch = e.touches[0];
			if (!touch) return;
			const rect = canvas.getBoundingClientRect();
			mouseX = touch.clientX - rect.left;
			mouseY = touch.clientY - rect.top;
		}

		window.addEventListener('resize', resize);
		canvas.addEventListener('mousemove', onMouseMove);
		canvas.addEventListener('touchmove', onTouchMove, { passive: true });

		return () => {
			cancelAnimationFrame(reqId);
			window.removeEventListener('resize', resize);
			canvas.removeEventListener('mousemove', onMouseMove);
			canvas.removeEventListener('touchmove', onTouchMove);
		};
	}, []);

	return <canvas ref={canvasRef} className={b()} />;
}
