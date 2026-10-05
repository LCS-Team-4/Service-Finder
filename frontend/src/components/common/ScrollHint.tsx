import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ScrollHintProps {
  /** Ref to the scrollable container to observe */
  targetRef: React.RefObject<HTMLElement>;
  /** Label to announce for screen readers */
  label?: string;
}

export function ScrollHint({ targetRef, label = 'More content below' }: ScrollHintProps) {
  const [moreBelow, setMoreBelow] = useState(false);
  const [moreAbove, setMoreAbove] = useState(false);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    const update = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
      const atTop = el.scrollTop < 8;
      setMoreBelow(!atBottom);
      setMoreAbove(!atTop);
    };

    update();

    el.addEventListener('scroll', update, { passive: true });

    // Re-check if the panel content changes (e.g. legend gains incident rows)
    const observer = new MutationObserver(update);
    observer.observe(el, { childList: true, subtree: true });

    // Also re-check on resize/rotation
    window.addEventListener('resize', update);

    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [targetRef]);

  return (
    <>
      {moreAbove && (
        <div className="scroll-hint scroll-hint-top" aria-hidden="true">
          <ChevronDown size={16} style={{ transform: 'rotate(180deg)' }} />
        </div>
      )}
      {moreBelow && (
        <div className="scroll-hint scroll-hint-bottom" aria-hidden="true">
          <ChevronDown size={16} />
          <span>{label}</span>
        </div>
      )}
    </>
  );
}