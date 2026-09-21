import { useState } from "react";
import { memoryStore, type MemoryCategory, type MemoryItem } from "@/core/memory/memoryStore";
import {
  MemoryIcon,
  TrashIcon,
  CheckIcon,
  SparklesIcon,
  CloseIcon,
} from "@/components/icons/Icons";
import "./MemoryPanel.css";

export function MemoryPanel() {
  const [memories, setMemories] = useState<MemoryItem[]>(() => memoryStore.getMemories());
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryCategory>("PROJECT");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const refresh = () => {
    setMemories(memoryStore.getMemories());
  };

  const handleAdd = () => {
    if (!newContent.trim()) return;
    memoryStore.addMemory(newCategory, newContent.trim(), "normal");
    setNewContent("");
    refresh();
  };

  const handleDelete = (id: string) => {
    memoryStore.deleteMemory(id);
    refresh();
  };

  const handleStartEdit = (m: MemoryItem) => {
    setEditingId(m.id);
    setEditContent(m.content);
  };

  const handleSaveEdit = (id: string) => {
    if (!editContent.trim()) return;
    memoryStore.updateMemory(id, editContent.trim());
    setEditingId(null);
    setEditContent("");
    refresh();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleClear = () => {
    if (window.confirm("Clear all stored memories? Hermoz will start fresh.")) {
      memoryStore.clearAll();
      refresh();
    }
  };

  const categoryLabels: Record<MemoryCategory, string> = {
    USER_PROFILE: "Profile",
    PROJECT: "Project",
    PROJECT_GOAL: "Goal",
    CURRENT_TASK: "Task",
    PREFERENCE: "Preference",
    IMPORTANT_FACT: "Fact",
    RELATIONSHIP: "Relationship",
    INSIDE_JOKE: "Banter",
    CONVERSATION_SUMMARY: "Summary",
  };

  const filtered = memories.filter((m) => {
    const matchCategory = selectedCategory === "ALL" || m.category === selectedCategory;
    const matchSearch =
      !searchQuery.trim() ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (categoryLabels[m.category] || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="hermoz-memory-container">
      <header className="hermoz-memory-header">
        <div className="hermoz-memory-header-info">
          <h2>Memory Vault</h2>
          <p>Long-term knowledge Hermoz uses across conversations.</p>
        </div>
        {memories.length > 0 && (
          <button className="liquid-glass-btn hermoz-memory-clear-btn" onClick={handleClear}>
            <TrashIcon size={14} /> Clear All
          </button>
        )}
      </header>

      {/* Add Memory Card */}
      <div className="hermoz-memory-add-card liquid-glass-card">
        <div className="hermoz-memory-add-row">
          <select
            className="liquid-glass-input hermoz-memory-category-select"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
          >
            <option value="PROJECT">Project</option>
            <option value="PROJECT_GOAL">Goal</option>
            <option value="CURRENT_TASK">Task</option>
            <option value="PREFERENCE">Preference</option>
            <option value="IMPORTANT_FACT">Fact</option>
            <option value="INSIDE_JOKE">Inside Joke</option>
          </select>
          <input
            type="text"
            className="liquid-glass-input hermoz-memory-input selectable-text"
            placeholder="e.g. 'I am building a game called Nebula'..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <button
            className="liquid-glass-btn liquid-glass-btn-primary"
            onClick={handleAdd}
            disabled={!newContent.trim()}
          >
            <CheckIcon size={14} /> Remember
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="hermoz-memory-filter-row">
        <input
          type="text"
          className="liquid-glass-input hermoz-memory-search-input selectable-text"
          placeholder="Search memories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="hermoz-memory-pills">
          <button
            className={`hermoz-memory-pill ${selectedCategory === "ALL" ? "active" : ""}`}
            onClick={() => setSelectedCategory("ALL")}
          >
            All ({memories.length})
          </button>
          {["PROJECT", "PREFERENCE", "IMPORTANT_FACT", "INSIDE_JOKE"].map((cat) => (
            <button
              key={cat}
              className={`hermoz-memory-pill ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {categoryLabels[cat as MemoryCategory] || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Memory Cards Stream */}
      <div className="hermoz-memory-list">
        {filtered.length === 0 ? (
          <div className="hermoz-memory-empty liquid-glass-card">
            <MemoryIcon size={32} />
            <p>
              {searchQuery
                ? "No memories match your search."
                : "Vault is empty. Add a fact or talk with Hermoz to start remembering."}
            </p>
          </div>
        ) : (
          filtered.map((m) => (
            <div key={m.id} className="hermoz-memory-item liquid-glass-card">
              {editingId === m.id ? (
                <div className="hermoz-memory-edit-box">
                  <input
                    type="text"
                    className="liquid-glass-input selectable-text"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(m.id);
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                  />
                  <div className="hermoz-memory-edit-actions">
                    <button className="liquid-glass-btn liquid-glass-btn-primary" onClick={() => handleSaveEdit(m.id)}>
                      Save
                    </button>
                    <button className="liquid-glass-btn" onClick={handleCancelEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="hermoz-memory-item-content">
                    <span className="hermoz-memory-badge">
                      <SparklesIcon size={11} /> {categoryLabels[m.category] || m.category}
                    </span>
                    <p className="selectable-text">{m.content}</p>
                  </div>
                  <div className="hermoz-memory-actions">
                    <button
                      className="hermoz-icon-btn"
                      onClick={() => handleStartEdit(m)}
                      title="Edit memory"
                    >
                      Edit
                    </button>
                    <button
                      className="hermoz-icon-btn"
                      onClick={() => handleDelete(m.id)}
                      title="Delete memory"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
