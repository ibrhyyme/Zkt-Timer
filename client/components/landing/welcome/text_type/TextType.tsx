/**
 * Adapted from reactbits.dev TextType component.
 * Typewriter effect with GSAP cursor blink.
 * @see https://reactbits.dev/text-animations/text-type
 */
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import gsap from 'gsap';
import './TextType.scss';

interface TextTypeProps {
	text: string | string[];
	typingSpeed?: number;
	initialDelay?: number;
	pauseDuration?: number;
	deletingSpeed?: number;
	loop?: boolean;
	className?: string;
	showCursor?: boolean;
	cursorCharacter?: string;
	startOnVisible?: boolean;
}

export default function TextType({
	text,
	typingSpeed = 50,
	initialDelay = 0,
	pauseDuration = 2000,
	deletingSpeed = 30,
	loop = true,
	className = '',
	showCursor = true,
	cursorCharacter = '|',
	startOnVisible = false,
}: TextTypeProps) {
	const [displayedText, setDisplayedText] = useState('');
	const [currentCharIndex, setCurrentCharIndex] = useState(0);
	const [isDeleting, setIsDeleting] = useState(false);
	const [currentTextIndex, setCurrentTextIndex] = useState(0);
	const [isVisible, setIsVisible] = useState(!startOnVisible);
	const cursorRef = useRef<HTMLSpanElement>(null);
	const containerRef = useRef<HTMLSpanElement>(null);

	const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);

	// IntersectionObserver for startOnVisible
	useEffect(() => {
		if (!startOnVisible || !containerRef.current) return;

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						setIsVisible(true);
					}
				});
			},
			{ threshold: 0.1 }
		);

		observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, [startOnVisible]);

	// GSAP cursor blink
	useEffect(() => {
		if (!showCursor || !cursorRef.current) return;

		gsap.set(cursorRef.current, { opacity: 1 });
		const tween = gsap.to(cursorRef.current, {
			opacity: 0,
			duration: 0.5,
			repeat: -1,
			yoyo: true,
			ease: 'power2.inOut',
		});

		return () => { tween.kill(); };
	}, [showCursor]);

	// Typing engine
	useEffect(() => {
		if (!isVisible) return;

		let timeout: ReturnType<typeof setTimeout>;
		const currentText = textArray[currentTextIndex];

		if (isDeleting) {
			if (displayedText === '') {
				setIsDeleting(false);
				if (currentTextIndex === textArray.length - 1 && !loop) return;
				setCurrentTextIndex((prev) => (prev + 1) % textArray.length);
				setCurrentCharIndex(0);
				timeout = setTimeout(() => {}, pauseDuration);
			} else {
				timeout = setTimeout(() => {
					setDisplayedText((prev) => prev.slice(0, -1));
				}, deletingSpeed);
			}
		} else {
			if (currentCharIndex < currentText.length) {
				timeout = setTimeout(() => {
					setDisplayedText((prev) => prev + currentText[currentCharIndex]);
					setCurrentCharIndex((prev) => prev + 1);
				}, typingSpeed);
			} else if (textArray.length > 1) {
				if (!loop && currentTextIndex === textArray.length - 1) return;
				timeout = setTimeout(() => {
					setIsDeleting(true);
				}, pauseDuration);
			}
		}

		return () => clearTimeout(timeout);
	}, [
		currentCharIndex, displayedText, isDeleting, typingSpeed,
		deletingSpeed, pauseDuration, textArray, currentTextIndex,
		loop, isVisible,
	]);

	return (
		<span ref={containerRef} className={className ? `cd-text-type ${className}` : 'cd-text-type'}>
			{/* Hidden sizers — stacked in same grid cell, tallest sets height */}
			{textArray.map((t, i) => (
				<span key={i} className="cd-text-type__sizer" aria-hidden="true">
					{t}{showCursor ? cursorCharacter : ''}
				</span>
			))}
			{/* Visible typed text */}
			<span className="cd-text-type__content">
				{displayedText}
				{showCursor && (
					<span ref={cursorRef} className="cd-text-type__cursor">
						{cursorCharacter}
					</span>
				)}
			</span>
		</span>
	);
}
