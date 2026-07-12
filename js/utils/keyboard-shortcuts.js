'use strict';

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
      // Categoría para el modal de atajos: 'Edición' | 'Archivo' |
      // 'Herramientas' | 'Vista'. El modal se genera desde este registro,
      // así que lo mostrado nunca puede divergir del comportamiento real.
      category: options.category || 'Otros',
      preventDefault: options.preventDefault !== false,
      // Guardamos las partes originales para poder renderizar el combo
      key,
      modifiers
    });
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

    // e.key puede ser undefined en eventos sintéticos, autofill o IME composition
    if (typeof e.key !== 'string') return '';
    const key = e.key.toLowerCase();
    return this.createCombo(key, modifiers);
  }

  /**
   * Manejar evento keydown
   */
  handleKeyDown(e) {
    if (!this.isEnabled) return;

    if (typeof e.key !== 'string') return;

    // Ignorar si el foco está en inputs de texto
    if (e.target && this.ignoreTargets.includes(e.target.tagName)) return;

    const combo = this.getComboFromEvent(e);
    if (!combo) return;
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
    if (typeof e.key !== 'string') return;
    this.activeKeys.delete(e.key.toLowerCase());
  }

  /**
   * Verificar si debe prevenir comportamiento por defecto
   */
  shouldPreventDefault(e) {
    // Aplicar los mismos checks que handleKeyDown: sin ellos, Cmd+Z dentro
    // de un input bloqueaba el undo nativo del texto, y tras disable()
    // seguían bloqueados los comportamientos por defecto del navegador.
    if (!this.isEnabled) return false;
    if (e.target && this.ignoreTargets.includes(e.target.tagName)) return false;

    const combo = this.getComboFromEvent(e);
    if (combo && this.shortcuts.has(combo)) {
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
    this.shortcuts.forEach((value, comboKey) => {
      // Usar key/modifiers originales si existen (registro nuevo);
      // fallback al parseo del combo para registros antiguos.
      let keyPart, modifiers;
      if (value.key !== undefined) {
        keyPart = value.key;
        modifiers = value.modifiers;
      } else {
        const parts = comboKey.split('+');
        keyPart = parts.pop();
        modifiers = parts;
      }

      shortcuts.push({
        combo: this.getDisplayCombo(keyPart, modifiers),
        description: value.description,
        category: value.category || 'Otros'
      });
    });
    return shortcuts;
  }

  /**
   * Habilitar/deshabilitar sistema de atajos
   */
  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
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
