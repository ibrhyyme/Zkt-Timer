/**
 * Adapted from reactbits.dev SplitText component.
 * Stagger-animates each character with Framer Motion.
 * @see https://reactbits.dev/text-animations/split-text
 */
import React from 'react';
import { motion } from 'framer-motion';

interface SplitTextProps {
	text: string;
	className?: string;
	delay?: number;
	staggerSpeed?: number;
}

export default function SplitText({ text, className = '', delay = 0, staggerSpeed = 0.03 }: SplitTextProps) {
	return (
		<span className={className} aria-label={text}>
			{text.split('').map((char, i) => (
				<motion.span
					key={`${i}-${char}`}
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{
						duration: 0.4,
						delay: delay + i * staggerSpeed,
						ease: [0.25, 0.46, 0.45, 0.94],
					}}
					style={{ display: 'inline-block' }}
					aria-hidden="true"
				>
					{char === ' ' ? '\u00A0' : char}
				</motion.span>
			))}
		</span>
	);
}
