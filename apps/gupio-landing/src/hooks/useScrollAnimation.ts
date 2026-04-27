import { useEffect, useRef, RefObject } from 'react';

export function useScrollAnimation(): RefObject<HTMLDivElement> {
    const ref = useRef<HTMLDivElement>(null!);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.classList.add('scroll-hidden');

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    el.classList.remove('scroll-hidden');
                    el.classList.add('scroll-visible');
                }
            },
            { threshold: 0.2 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return ref;
}
