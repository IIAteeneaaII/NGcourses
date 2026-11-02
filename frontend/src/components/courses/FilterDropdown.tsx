'use client';

import { useEffect, useId, useRef, useState } from 'react';
import styles from './FilterDropdown.module.css';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  /** Texto del botón cuando no hay nada seleccionado (p. ej. "Categoría"). */
  placeholder: string;
  /** Texto de la opción que limpia el filtro (p. ej. "Todas las categorías"). */
  allLabel: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

export default function FilterDropdown({ placeholder, allLabel, options, value, onChange, ariaLabel }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const items: FilterOption[] = [{ value: '', label: allLabel }, ...options];
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const openMenu = () => {
    const idx = items.findIndex((o) => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
    setOpen(true);
  };

  const select = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(items[activeIndex].value);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${selected ? styles.triggerActive : ''} ${open ? styles.triggerOpen : ''}`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
      >
        <span className={styles.triggerLabel}>{selected ? selected.label : placeholder}</span>
        <svg className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <ul className={styles.menu} role="listbox" id={listId} aria-label={ariaLabel}>
          {items.map((opt, i) => {
            const isSelected = opt.value === value;
            return (
              <li
                key={opt.value || '__all'}
                role="option"
                aria-selected={isSelected}
                className={`${styles.option} ${i === activeIndex ? styles.optionActive : ''} ${isSelected ? styles.optionSelected : ''} ${opt.value === '' ? styles.optionAll : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(opt.value)}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <svg className={styles.check} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </li>
            );
          })}
          {options.length === 0 && <li className={styles.empty}>Sin opciones disponibles</li>}
        </ul>
      )}
    </div>
  );
}
