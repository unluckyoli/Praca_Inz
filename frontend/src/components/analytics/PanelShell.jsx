import "./PanelShell.css";

export default function PanelShell({
  title,
  description,
  interpretation,
  insight,
  children,
}) {
  return (
    <div className="panel">
      <div className="panel-top">
        <div className="panel-text">
          <h3 className="panel-title">{title}</h3>
          <div className="panel-block">
            <div className="panel-label">Opis</div>
            <div className="panel-body">{description}</div>
          </div>
          <div className="panel-block">
            <div className="panel-label">Interpretacja</div>
            <div className="panel-body">{interpretation}</div>
          </div>
          {insight && (
            <div className="panel-insight">
              <div className="panel-insight-label">Insight</div>
              <div className="panel-insight-body">{insight}</div>
            </div>
          )}
        </div>
      </div>

      <div className="panel-chart">{children}</div>
    </div>
  );
}


