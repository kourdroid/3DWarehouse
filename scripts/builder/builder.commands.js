// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE BUILDER — COMMANDS
//  Handles undo/redo stack
// ═══════════════════════════════════════════════════════

const BuilderCommands = {
    history: [],
    position: -1,

    execute(command) {
        if (this.position < this.history.length - 1) {
            this.history = this.history.slice(0, this.position + 1);
        }

        command.execute();
        this.history.push(command);
        this.position++;
    },

    undo() {
        if (this.position >= 0) {
            const command = this.history[this.position];
            command.undo();
            this.position--;
        }
    },

    redo() {
        if (this.position < this.history.length - 1) {
            this.position++;
            const command = this.history[this.position];
            command.execute();
        }
    },

    clear() {
        this.history = [];
        this.position = -1;
    }
};

// Global Keyboard Shortcuts for Undo/Redo
document.addEventListener('keydown', (e) => {
    // Only capture if not typing in an input field (except maybe layout inputs, but we'll be safe)
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
            BuilderCommands.redo();
        } else {
            BuilderCommands.undo();
        }
        e.preventDefault();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        BuilderCommands.redo();
        e.preventDefault();
    }
});
