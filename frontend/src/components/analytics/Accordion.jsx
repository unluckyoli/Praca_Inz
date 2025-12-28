import "./Accordion.css";

export default function Accordion({
  items,
  openId,
  onToggle,
  renderBody,
}) {
  return (
    <div className="acc">
      {items.map((item) => {
        const isOpen = item.id === openId;
        return (
          <div key={item.id} className={`acc-item ${isOpen ? "open" : ""}`}>
            <button
              type="button"
              className="acc-header"
              onClick={() => onToggle(item.id)}
              aria-expanded={isOpen}
            >
              <div className="acc-header-left">
                <div className="acc-title-row">
                  <div className="acc-title">{item.title}</div>
                  {item.badges?.map((b) => (
                    <span key={b} className={`acc-badge acc-badge-${b.toLowerCase()}`}>
                      {b}
                    </span>
                  ))}
                  {item.requirements?.map((r) => (
                    <span key={r} className="acc-req">
                      {r}
                    </span>
                  ))}
                </div>
                <div className="acc-subtitle">{item.collapsedDescription}</div>
              </div>
              <div className="acc-chevron">{isOpen ? "−" : "+"}</div>
            </button>

            {isOpen && (
              <div className="acc-body">
                {renderBody(item)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


