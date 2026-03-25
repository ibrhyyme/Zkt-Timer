import type { Variants, Transition } from 'framer-motion';

// ============================================
// Transition presets
// ============================================

export const springSnappy: Transition = {
	type: 'spring',
	stiffness: 300,
	damping: 20,
};

export const springGentle: Transition = {
	type: 'spring',
	stiffness: 150,
	damping: 15,
};

export const easeOut: Transition = {
	duration: 0.6,
	ease: [0.22, 1, 0.36, 1],
};

// ============================================
// Container variants (stagger children)
// ============================================

export const staggerContainer: Variants = {
	hidden: {},
	visible: {
		transition: {
			staggerChildren: 0.1,
			delayChildren: 0.1,
		},
	},
};

export const staggerContainerFast: Variants = {
	hidden: {},
	visible: {
		transition: {
			staggerChildren: 0.06,
			delayChildren: 0.05,
		},
	},
};

// ============================================
// Child element variants
// ============================================

export const fadeInUp: Variants = {
	hidden: {
		opacity: 0,
		y: 30,
	},
	visible: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.6,
			ease: [0.22, 1, 0.36, 1],
		},
	},
};

export const fadeInScale: Variants = {
	hidden: {
		opacity: 0,
		scale: 0.9,
	},
	visible: {
		opacity: 1,
		scale: 1,
		transition: {
			duration: 0.5,
			ease: [0.22, 1, 0.36, 1],
		},
	},
};

export const fadeInLeft: Variants = {
	hidden: {
		opacity: 0,
		x: -40,
	},
	visible: {
		opacity: 1,
		x: 0,
		transition: {
			duration: 0.6,
			ease: [0.22, 1, 0.36, 1],
		},
	},
};

export const fadeInRight: Variants = {
	hidden: {
		opacity: 0,
		x: 40,
	},
	visible: {
		opacity: 1,
		x: 0,
		transition: {
			duration: 0.6,
			ease: [0.22, 1, 0.36, 1],
		},
	},
};

// ============================================
// Hover variants
// ============================================

export const hoverLift = {
	y: -8,
	transition: springSnappy,
};

export const hoverScale = {
	scale: 1.05,
	transition: springSnappy,
};

export const hoverScaleSubtle = {
	scale: 1.02,
	transition: springGentle,
};

export const tapScale = {
	scale: 0.97,
};
