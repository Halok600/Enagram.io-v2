const DOT_COUNT = 3;

export function ThinkingIndicator() {
  return (
    <div className="thinking-indicator" role="status" aria-label="Enagram.io is thinking">
      <div className="thinking-dots" aria-hidden>
        {Array.from({ length: DOT_COUNT }).map((_, i) => (
          <span key={i} className="thinking-dot" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}
