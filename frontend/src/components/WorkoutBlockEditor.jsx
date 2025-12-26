import { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import "./WorkoutBlockEditor.css";

function WorkoutBlockEditor({ initialBlocks = [], onChange }) {
  const [blocks, setBlocks] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedBlock, setDraggedBlock] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [resizingBlock, setResizingBlock] = useState(null);
  const [resizeEdge, setResizeEdge] = useState(null); // 'left' or 'right'
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartDuration, setResizeStartDuration] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [showBlockTypeMenu, setShowBlockTypeMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  // Inicjalizuj bloki z initialBlocks lub domyślnymi blokami - TYLKO RAZ
  useEffect(() => {
    if (initialized) return; // Już zainicjalizowane, nie rób nic
    
    if (initialBlocks.length > 0) {
      console.log('Loading blocks from initialBlocks:', initialBlocks);
      setBlocks(initialBlocks);
      setInitialized(true);
    } else {
      // Domyślna struktura tylko jeśli nie ma bloków i nie przekazano initialBlocks
      console.log('Creating default blocks');
      setBlocks([
        { id: Date.now() + 1, type: "warmup", duration: 10, pace: "6:00", distance: 1.7 },
        { id: Date.now() + 2, type: "main", duration: 30, pace: "5:00", distance: 6.0 },
        { id: Date.now() + 3, type: "cooldown", duration: 5, pace: "6:30", distance: 0.8 }
      ]);
      setInitialized(true);
    }
  }, [initialBlocks, initialized]); // Obserwuj initialBlocks, ale użyj flagi initialized

  useEffect(() => {
    // Wywołaj onChange gdy bloki się zmienią (ale nie przy pierwszej inicjalizacji)
    if (blocks.length > 0 && onChange) {
      onChange(blocks);
    }
  }, [blocks]); // Usunięto onChange z dependencies aby uniknąć pętli

  // Zamknij menu po kliknięciu poza nim
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showBlockTypeMenu && !e.target.closest('.add-block-container')) {
        setShowBlockTypeMenu(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showBlockTypeMenu]);

  const blockTypes = [
    { value: "warmup", label: "Rozgrzewka", color: "#10b981" },
    { value: "intervals", label: "Interwały", color: "#ef4444" },
    { value: "tempo", label: "Tempo", color: "#f59e0b" },
    { value: "recovery", label: "Regeneracja", color: "#3b82f6" },
    { value: "cooldown", label: "Wyciszenie", color: "#8b5cf6" },
  ];

  const addBlockOfType = (blockType) => {
    setShowBlockTypeMenu(false);
    
    // Funkcja do parsowania tempa
    const parsePace = (paceStr) => {
      const match = paceStr.match(/(\d+):(\d+)/);
      if (!match) return 5.0;
      return parseInt(match[1]) + parseInt(match[2]) / 60;
    };
    
    // Domyślne wartości dla różnych typów bloków
    const blockDefaults = {
      warmup: { duration: 10, pace: "6:00" },
      intervals: { duration: 5, pace: "4:30" },
      tempo: { duration: 20, pace: "4:45" },
      main: { duration: 30, pace: "5:00" },
      recovery: { duration: 2, pace: "6:00" },
      cooldown: { duration: 5, pace: "6:30" },
    };
    
    const defaults = blockDefaults[blockType] || { duration: 5, pace: "5:00" };
    const paceMinutes = parsePace(defaults.pace);
    const calculatedDistance = parseFloat((defaults.duration / paceMinutes).toFixed(2));
    
    console.log('Creating block:', blockType, 'duration:', defaults.duration, 'pace:', defaults.pace, 'paceMinutes:', paceMinutes, 'distance:', calculatedDistance);
    
    const newBlock = {
      id: Date.now(),
      type: blockType,
      duration: defaults.duration,
      pace: defaults.pace,
      distance: calculatedDistance,
    };
    
    // Jeśli dodajemy interwał, automatycznie dodaj regenerację
    if (blockType === 'intervals') {
      const recoveryDefaults = blockDefaults.recovery;
      const recoveryPace = parsePace(recoveryDefaults.pace);
      const recoveryDistance = parseFloat((recoveryDefaults.duration / recoveryPace).toFixed(2));
      
      console.log('Creating recovery block: duration:', recoveryDefaults.duration, 'pace:', recoveryDefaults.pace, 'paceMinutes:', recoveryPace, 'distance:', recoveryDistance);
      
      const recoveryBlock = {
        id: Date.now() + 1,
        type: "recovery",
        duration: recoveryDefaults.duration,
        pace: recoveryDefaults.pace,
        distance: recoveryDistance,
      };
      setBlocks([...blocks, newBlock, recoveryBlock]);
    } else {
      setBlocks([...blocks, newBlock]);
    }
    
    setSelectedBlock(newBlock.id);
  };

  const deleteBlock = (id) => {
    setBlocks(blocks.filter(b => b.id !== id));
    if (selectedBlock === id) setSelectedBlock(null);
  };

  const updateBlock = (id, updates) => {
    setBlocks(blocks.map(b => {
      if (b.id === id) {
        const updated = { ...b, ...updates };
        
        // Automatycznie oblicz dystans z czasu i tempa
        if (updated.duration && updated.pace) {
          const paceMinutes = parsePace(updated.pace);
          if (paceMinutes) {
            updated.distance = parseFloat((updated.duration / paceMinutes).toFixed(2));
          }
        }
        
        return updated;
      }
      return b;
    }));
  };

  const getTotalDuration = () => {
    return blocks.reduce((sum, block) => sum + (block.duration || 0), 0);
  };

  const getTotalDistance = () => {
    return blocks.reduce((sum, block) => {
      // Oblicz dystans z czasu i tempa jeśli nie ma podanego dystansu
      if (block.distance) return sum + block.distance;
      if (block.duration && block.pace) {
        const paceMinutes = parsePace(block.pace);
        if (paceMinutes) {
          return sum + (block.duration / paceMinutes);
        }
      }
      return sum;
    }, 0);
  };

  const parsePace = (paceStr) => {
    if (!paceStr) return null;
    const match = paceStr.match(/(\d+):(\d+)/);
    if (!match) return null;
    return parseInt(match[1]) + parseInt(match[2]) / 60;
  };

  const paceToHeight = (pace) => {
    // Konwersja tempa na wysokość bloku
    // Szybsze tempo (niższa wartość) = wyższy blok
    const paceMinutes = parsePace(pace);
    if (!paceMinutes) return 50;
    
    // Tempo 3:00/km = 100%, tempo 8:00/km = 20%
    const minPace = 3.0;
    const maxPace = 8.0;
    const normalized = (maxPace - paceMinutes) / (maxPace - minPace);
    return Math.max(20, Math.min(100, normalized * 100));
  };

  const heightToPace = (heightPercent) => {
    // Konwersja wysokości bloku na tempo
    const minPace = 3.0;
    const maxPace = 8.0;
    const paceMinutes = maxPace - ((heightPercent / 100) * (maxPace - minPace));
    const minutes = Math.floor(paceMinutes);
    const seconds = Math.round((paceMinutes - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getBlockColor = (type) => {
    return blockTypes.find(t => t.value === type)?.color || "#6b7280";
  };

  const getBlockLabel = (type) => {
    return blockTypes.find(t => t.value === type)?.label || type;
  };

  const handleMouseDown = (e, blockId, edge = null) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (edge) {
      // Rozpocznij resize
      const block = blocks.find(b => b.id === blockId);
      setResizingBlock(blockId);
      setResizeEdge(edge);
      setResizeStartX(e.clientX);
      setResizeStartDuration(block.duration);
    } else {
      setSelectedBlock(blockId);
    }
  };

  const handleMouseMove = (e) => {
    if (resizingBlock !== null && resizeEdge) {
      const deltaX = e.clientX - resizeStartX;
      const totalWidth = e.currentTarget?.offsetWidth || 800;
      const totalDuration = getTotalDuration();
      const pixelsPerMinute = totalWidth / Math.max(totalDuration, 60);
      const deltaMinutes = Math.round(deltaX / pixelsPerMinute);
      
      const newDuration = Math.max(1, resizeStartDuration + deltaMinutes);
      updateBlock(resizingBlock, { duration: newDuration });
    }
  };

  const handleMouseUp = () => {
    setResizingBlock(null);
    setResizeEdge(null);
  };

  const handleDragStart = (e, block, index) => {
    if (resizingBlock) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    setDraggedBlock({ block, index });
    setIsDragging(true);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedBlock) return;
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    // Tylko wyczyść jeśli opuszczamy timeline całkowicie
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverIndex(null);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedBlock(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedBlock) return;

    const { index: dragIndex } = draggedBlock;
    if (dragIndex === dropIndex) {
      handleDragEnd();
      return;
    }

    const newBlocks = [...blocks];
    const [movedBlock] = newBlocks.splice(dragIndex, 1);
    newBlocks.splice(dropIndex, 0, movedBlock);
    
    setBlocks(newBlocks);
    handleDragEnd();
  };

  const handlePaceResize = (e, blockId) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const block = blocks.find(b => b.id === blockId);
    const startHeight = paceToHeight(block.pace);

    const handleMouseMove = (moveEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newHeight = Math.max(20, Math.min(100, startHeight + deltaY / 2));
      const newPace = heightToPace(newHeight);
      updateBlock(blockId, { pace: newPace });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="workout-block-editor">
      <div className="editor-header">
        <h3>Struktura treningu</h3>
        <div className="workout-summary">
          <span className="summary-item">
            ⏱️ {getTotalDuration()} min
          </span>
          <span className="summary-item">
            📏 {getTotalDistance().toFixed(2)} km
          </span>
        </div>
      </div>

      <div 
        className="blocks-timeline"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {blocks.map((block, index) => {
          const totalDuration = getTotalDuration();
          // Dla > 5 bloków używamy absolutnej szerokości w pixelach
          const useAbsoluteWidth = blocks.length > 5;
          const pixelsPerMinute = 8; // 8px na minutę
          const blockWidth = useAbsoluteWidth 
            ? `${block.duration * pixelsPerMinute}px`
            : `${(block.duration / Math.max(totalDuration, 60)) * 100}%`;
          
          const heightPercentage = paceToHeight(block.pace);
          const isDraggedOver = dragOverIndex === index;

          return (
            <div
              key={block.id}
              draggable={!resizingBlock}
              onDragStart={(e) => handleDragStart(e, block, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`timeline-block ${selectedBlock === block.id ? 'selected' : ''} ${isDraggedOver ? 'drag-over' : ''} ${draggedBlock?.index === index ? 'dragging' : ''}`}
              style={{
                width: blockWidth,
                height: `${heightPercentage}%`,
                backgroundColor: getBlockColor(block.type),
                position: 'relative',
                cursor: resizingBlock ? 'default' : 'grab',
              }}
              onClick={(e) => {
                if (!isDragging) {
                  setSelectedBlock(block.id);
                }
              }}
            >
              {/* Left resize handle */}
              <div
                className="resize-handle-horizontal resize-left"
                onMouseDown={(e) => handleMouseDown(e, block.id, 'left')}
              />
              
              {/* Right resize handle */}
              <div
                className="resize-handle-horizontal resize-right"
                onMouseDown={(e) => handleMouseDown(e, block.id, 'right')}
              />
              
              {/* Top resize handle for pace */}
              <div
                className="resize-handle"
                onMouseDown={(e) => handlePaceResize(e, block.id)}
              >
                <GripVertical size={14} />
              </div>

              <div className="block-label">
                <span className="block-type">{getBlockLabel(block.type)}</span>
                <span className="block-duration">{block.duration}min</span>
                <span className="block-pace">{block.pace}/km</span>
              </div>

              <button
                className="block-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteBlock(block.id);
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}

        <div className="add-block-container">
          <button 
            className="add-block-btn"
            id="add-block-btn"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setMenuPosition({
                top: rect.top - 8,
                left: rect.left
              });
              setShowBlockTypeMenu(!showBlockTypeMenu);
            }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {showBlockTypeMenu && (
        <div 
          className="block-type-menu"
          style={{
            position: 'fixed',
            top: menuPosition.top,
            left: menuPosition.left,
            transform: 'translateY(-100%)'
          }}
        >
          {blockTypes.map(type => (
            <button
              key={type.value}
              className="block-type-option"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addBlockOfType(type.value);
              }}
              style={{ borderLeftColor: type.color }}
            >
              <span className="type-color" style={{ backgroundColor: type.color }} />
              {type.label}
            </button>
          ))}
        </div>
      )}

      {selectedBlock !== null && (() => {
        const block = blocks.find(b => b.id === selectedBlock);
        if (!block) return null;

        return (
          <div className="block-properties">
            <h4>Właściwości bloku</h4>
            
            <div className="property-row">
              <label>Typ</label>
              <select
                value={block.type}
                onChange={(e) => updateBlock(block.id, { type: e.target.value })}
              >
                {blockTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="property-row">
              <label>Czas (min)</label>
              <input
                type="number"
                value={block.duration}
                onChange={(e) => updateBlock(block.id, { duration: parseInt(e.target.value) || 0 })}
                min="1"
                max="180"
              />
            </div>

            <div className="property-row">
              <label>Tempo (min/km)</label>
              <input
                type="text"
                value={block.pace}
                onChange={(e) => updateBlock(block.id, { pace: e.target.value })}
                placeholder="4:30"
              />
            </div>

            <div className="property-row">
              <label>Dystans (km)</label>
              <input
                type="number"
                value={block.distance !== null && block.distance !== undefined ? block.distance.toFixed(2) : '0.00'}
                readOnly
                disabled
                min="0"
                step="0.1"
                style={{ background: '#f3f4f6', cursor: 'not-allowed' }}
              />
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>auto</span>
            </div>

            {block.type === "intervals" && (
              <>
                <div className="property-row">
                  <label>Powtórzenia</label>
                  <input
                    type="number"
                    value={block.repetitions || 1}
                    onChange={(e) => updateBlock(block.id, { repetitions: parseInt(e.target.value) || 1 })}
                    min="1"
                    max="20"
                  />
                </div>

                <div className="property-row">
                  <label>Dystans (m)</label>
                  <input
                    type="number"
                    value={block.intervalDistance || 400}
                    onChange={(e) => updateBlock(block.id, { intervalDistance: parseInt(e.target.value) || 400 })}
                    step="100"
                  />
                </div>

                <div className="property-row">
                  <label>Odpoczynek (s)</label>
                  <input
                    type="number"
                    value={block.recoveryTime || 60}
                    onChange={(e) => updateBlock(block.id, { recoveryTime: parseInt(e.target.value) || 60 })}
                    step="15"
                  />
                </div>
              </>
            )}
          </div>
        );
      })()}

      <div className="blocks-legend">
        {blockTypes.map(type => (
          <div key={type.value} className="legend-item">
            <div 
              className="legend-color" 
              style={{ backgroundColor: type.color }}
            />
            <span>{type.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WorkoutBlockEditor;
