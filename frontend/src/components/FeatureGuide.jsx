import { useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { languageNames } from '../translations';
import './FeatureGuide.css';

const GUIDE_UI = {
  en: {
    open: 'Open navigation help',
    close: 'Close help',
    next: 'Next',
    previous: 'Previous',
    finish: 'Finish',
    restart: 'Start again',
    step: 'Step',
    of: 'of',
    completed: 'You have reached the end of this guide.',
    language: 'Language',
  },
  rw: {
    open: 'Fungura ubufasha bw\'inzira',
    close: 'Funga ubufasha',
    next: 'Ibikurikira',
    previous: 'Subira inyuma',
    finish: 'Rangiza',
    restart: 'Tangira bundi bushya',
    step: 'Intambwe',
    of: 'muri',
    completed: 'Ugeze ku musozo w\'ubufasha bw\'uru rupapuro.',
    language: 'Ururimi',
  },
  fr: {
    open: 'Ouvrir l\'aide de navigation',
    close: 'Fermer l\'aide',
    next: 'Suivant',
    previous: 'Precedent',
    finish: 'Terminer',
    restart: 'Recommencer',
    step: 'Etape',
    of: 'sur',
    completed: 'Vous avez termine ce guide.',
    language: 'Langue',
  },
};

function pickLanguageValue(values, language) {
  if (!values) return '';
  return values[language] || values.en || '';
}

export default function FeatureGuide({ title, intro, steps, className = '' }) {
  const { language, setLanguage } = useLanguage();
  const ui = GUIDE_UI[language] || GUIDE_UI.en;
  const resolvedTitle = pickLanguageValue(title, language);
  const resolvedIntro = pickLanguageValue(intro, language);
  const resolvedSteps = useMemo(() => {
    const candidate = (steps && (steps[language] || steps.en)) || [];
    return Array.isArray(candidate) ? candidate : [];
  }, [steps, language]);

  const [isOpen, setIsOpen] = useState(true);
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [targetRect, setTargetRect] = useState(null);
  const activeTargetRef = useRef(null);

  if (!resolvedSteps.length) return null;

  const current = resolvedSteps[index];
  const isFirst = index === 0;
  const isLast = index === resolvedSteps.length - 1;

  const handleNext = () => {
    if (isLast) {
      setCompleted(true);
      return;
    }
    setIndex((prev) => prev + 1);
  };

  const handlePrevious = () => {
    if (!isFirst) setIndex((prev) => prev - 1);
  };

  const handleRestart = () => {
    setIndex(0);
    setCompleted(false);
  };

  useEffect(() => {
    const clearPrevious = () => {
      if (activeTargetRef.current) {
        activeTargetRef.current.classList.remove('feature-guide-target--active');
        activeTargetRef.current = null;
      }
    };

    clearPrevious();

    if (!isOpen || completed) {
      setTargetRect(null);
      return clearPrevious;
    }

    const targetSelector = resolvedSteps[index]?.target;
    if (!targetSelector) {
      setTargetRect(null);
      return clearPrevious;
    }

    const target = document.querySelector(targetSelector);
    if (!target) {
      setTargetRect(null);
      return clearPrevious;
    }

    activeTargetRef.current = target;
    target.classList.add('feature-guide-target--active');
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    const updateRect = () => {
      const rect = target.getBoundingClientRect();
      const desiredTop = rect.top + 8;
      const desiredLeft = rect.left + (rect.width / 2) - 170;
      setTargetRect({
        top: Math.max(12, Math.min(window.innerHeight - 280, desiredTop)),
        left: Math.max(12, Math.min(window.innerWidth - 352, desiredLeft)),
      });
    };

    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    return () => {
      clearPrevious();
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [completed, index, isOpen, resolvedSteps]);

  if (!isOpen) {
    return (
      <button type="button" className="feature-guide__reopen" onClick={() => setIsOpen(true)}>
        {ui.open}
      </button>
    );
  }

  const guideStyle = targetRect
    ? {
        position: 'fixed',
        top: `${targetRect.top}px`,
        left: `${targetRect.left}px`,
        width: 'min(340px, calc(100vw - 24px))',
        zIndex: 1100,
      }
    : undefined;

  return (
    <aside className={`feature-guide ${className}`.trim()} aria-live="polite" style={guideStyle}>
      <div className="feature-guide__header">
        <div>
          <h2 className="feature-guide__title">{resolvedTitle}</h2>
          {resolvedIntro ? <p className="feature-guide__intro">{resolvedIntro}</p> : null}
        </div>
        <button
          type="button"
          className="feature-guide__close"
          aria-label={ui.close}
          title={ui.close}
          onClick={() => setIsOpen(false)}
        >
          x
        </button>
      </div>

      <div className="feature-guide__body">
        <p className="feature-guide__meta">
          {ui.step} {Math.min(index + 1, resolvedSteps.length)} {ui.of} {resolvedSteps.length}
        </p>
        <div className="feature-guide__lang-row">
          <label htmlFor="feature-guide-language" className="feature-guide__lang-label">
            {ui.language}
          </label>
          <select
            id="feature-guide-language"
            className="feature-guide__lang-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="en">{languageNames.en}</option>
            <option value="rw">{languageNames.rw}</option>
            <option value="fr">{languageNames.fr}</option>
          </select>
        </div>

        {!completed ? (
          <>
            <h3 className="feature-guide__feature">{current?.feature}</h3>
            <p className="feature-guide__description">{current?.description}</p>
          </>
        ) : (
          <p className="feature-guide__completed">{ui.completed}</p>
        )}
      </div>

      <div className="feature-guide__actions">
        {!completed ? (
          <>
            <button
              type="button"
              className="feature-guide__btn feature-guide__btn--secondary"
              onClick={handlePrevious}
              disabled={isFirst}
            >
              {ui.previous}
            </button>
            <button
              type="button"
              className="feature-guide__btn feature-guide__btn--primary"
              onClick={handleNext}
            >
              {isLast ? ui.finish : ui.next}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="feature-guide__btn feature-guide__btn--primary"
            onClick={handleRestart}
          >
            {ui.restart}
          </button>
        )}
      </div>
    </aside>
  );
}
