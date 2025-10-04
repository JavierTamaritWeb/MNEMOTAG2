/**
 * KeyboardShortcutManager - Sistema de gestión de atajos de teclado
 * Maneja combinaciones de teclas para acciones rápidas en la aplicación
 * @version 1.0.0
 */

class KeyboardShortcutManager {
  constructor() {
    this.shortcuts = new Map();
    this.isEnabled = true;
    this.ignoreTargets = ['INPUT', 'TEXTAREA', 'SELECT'];
    this.activeKeys = new Set();
    this.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    
    // Detectar OS para mostrar símbolos correctos
    this.modifierSymbols = {
      ctrl: this.isMac ? '⌘' : 'Ctrl',
      shift: 'Shift',
      alt: this.isMac ? '⌥' : 'Alt'
    };
    
    this.init();
  }

  /**
   * Inicializar event listeners
   */
  init() {
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));
    
    // Prevenir atajos del navegador que queremos capturar
    document.addEventListener('keydown', (e) => {
      if (this.shouldPreventDefault(e)) {
        e.preventDefault();
      }
    });
    
    console.log('✅ KeyboardShortcutManager inicializado');
  }

  /**
   * Registrar un atajo de teclado
   * @param {string} key - Tecla principal ('z', 's', ' ', etc.)
   * @param {Array<string>} modifiers - Modificadores ['ctrl', 'shift', 'alt']
   * @param {Function} callback - Función a ejecutar
   * @param {Object} options - Opciones adicionales
   */
  register(key, modifiers = [], callback, options = {}) {
    const combo = this.createCombo(key, modifiers);
    this.shortcuts.set(combo, { 
      callback, 
      description: options.description || '',
      preventDefault: options.preventDefault !== false 
    });
    console.log(`🎹 Atajo registrado: ${this.getDisplayCombo(key, modifiers)}`);
  }

  /**
   * Crear identificador único de combinación
   */
  createCombo(key, modifiers) {
    const sortedModifiers = [...modifiers].sort().join('+');
    return `${sortedModifiers}${sortedModifiers ? '+' : ''}${key.toLowerCase()}`;
  }

  /**
   * Obtener combinación desde evento
   */
  getComboFromEvent(e) {
    const modifiers = [];
    
    // En Mac, usar metaKey (Cmd) en lugar de ctrlKey
    if (this.isMac) {
      if (e.metaKey) modifiers.push('ctrl');
    } else {
      if (e.ctrlKey) modifiers.push('ctrl');
    }
    
    if (e.shiftKey) modifiers.push('shift');
    if (e.altKey) modifiers.push('alt');
    
    const key = e.key.toLowerCase();
    return this.createCombo(key, modifiers);
  }

  /**
   * Manejar evento keydown
   */
  handleKeyDown(e) {
    if (!this.isEnabled) return;
    
    // Ignorar si el foco está en inputs de texto
    if (this.ignoreTargets.includes(e.target.tagName)) return;
    
    const combo = this.getComboFromEvent(e);
    this.activeKeys.add(e.key.toLowerCase());
    
    if (this.shortcuts.has(combo)) {
      const shortcut = this.shortcuts.get(combo);
      
      if (shortcut.preventDefault) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      // Ejecutar callback
      try {
        shortcut.callback(e);
      } catch (error) {
        console.error('Error ejecutando atajo:', combo, error);
      }
    }
  }

  /**
   * Manejar evento keyup
   */
  handleKeyUp(e) {
    this.activeKeys.delete(e.key.toLowerCase());
  }

  /**
   * Verificar si debe prevenir comportamiento por defecto
   */
  shouldPreventDefault(e) {
    const combo = this.getComboFromEvent(e);
    if (this.shortcuts.has(combo)) {
      return this.shortcuts.get(combo).preventDefault;
    }
    return false;
  }

  /**
   * Obtener representación visual de combinación
   */
  getDisplayCombo(key, modifiers) {
    const modSymbols = modifiers.map(m => this.modifierSymbols[m] || m);
    const keyDisplay = key === ' ' ? 'Space' : key.toUpperCase();
    return [...modSymbols, keyDisplay].join(' + ');
  }

  /**
   * Obtener todos los atajos registrados
   */
  getAllShortcuts() {
    const shortcuts = [];
    this.shortcuts.forEach((value, key) => {
      const parts = key.split('+');
      const keyPart = parts.pop();
      const modifiers = parts;
      
      shortcuts.push({
        combo: this.getDisplayCombo(keyPart, modifiers),
        description: value.description
      });
    });
    return shortcuts;
  }

  /**
   * Habilitar/deshabilitar sistema de atajos
   */
  enable() {
    this.isEnabled = true;
    console.log('🎹 Atajos de teclado habilitados');
  }

  disable() {
    this.isEnabled = false;
    console.log('🎹 Atajos de teclado deshabilitados');
  }

  /**
   * Eliminar un atajo
   */
  unregister(key, modifiers) {
    const combo = this.createCombo(key, modifiers);
    this.shortcuts.delete(combo);
  }

  /**
   * Limpiar todos los atajos
   */
  clear() {
    this.shortcuts.clear();
  }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.KeyboardShortcutManager = KeyboardShortcutManager;
}
