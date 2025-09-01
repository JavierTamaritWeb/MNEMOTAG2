/**
 * MnemoTag v3.0 - Filter Cache
 * Sistema de cache inteligente para estados de filtros
 * Características: Hash generation, state management, cleanup automático, performance optimization
 */

const FilterCache = {
  // Almacenamiento de estados
  states: new Map(),
  lastApplied: null,
  isDirty: false,
  
  // Configuración
  config: {
    maxAge: 5 * 60 * 1000, // 5 minutos
    maxStates: 50, // Máximo de estados guardados
    enableLogging: true,
    autoCleanup: true,
    compressionEnabled: true
  },
  
  // Métricas de rendimiento
  stats: {
    hits: 0,
    misses: 0,
    saves: 0,
    cleanups: 0
  },
  
  // Guardar estado actual con metadatos extendidos
  saveState: function(key, filterState, metadata = {}) {
    try {
      const stateHash = this.generateHash(filterState);
      const stateData = {
        filters: { ...filterState },
        hash: stateHash,
        timestamp: Date.now(),
        metadata: {
          version: '3.0',
          source: metadata.source || 'manual',
          performance: metadata.performance || {},
          ...metadata
        }
      };
      
      // Comprimir si está habilitado
      if (this.config.compressionEnabled) {
        stateData.compressed = this.compressState(filterState);
      }
      
      this.states.set(key, stateData);
      this.stats.saves++;
      
      if (this.config.enableLogging) {
        console.log(`💾 FilterCache: Estado guardado [${key}] - Hash: ${stateHash.substring(0, 8)}...`);
      }
      
      // Cleanup automático si está habilitado
      if (this.config.autoCleanup && this.states.size > this.config.maxStates) {
        this.cleanup();
      }
      
      return stateHash;
    } catch (error) {
      console.error('Error al guardar estado en FilterCache:', error);
      return null;
    }
  },
  
  // Obtener estado guardado con validación
  getState: function(key) {
    const state = this.states.get(key);
    
    if (!state) {
      this.stats.misses++;
      return null;
    }
    
    // Verificar si el estado no ha expirado
    const age = Date.now() - state.timestamp;
    if (age > this.config.maxAge) {
      this.states.delete(key);
      this.stats.misses++;
      
      if (this.config.enableLogging) {
        console.log(`⏰ FilterCache: Estado expirado [${key}]`);
      }
      
      return null;
    }
    
    this.stats.hits++;
    
    if (this.config.enableLogging) {
      console.log(`✅ FilterCache: Estado recuperado [${key}]`);
    }
    
    return state;
  },
  
  // Verificar si el estado ha cambiado
  hasChanged: function(currentState) {
    const currentHash = this.generateHash(currentState);
    const hasChanged = this.lastApplied !== currentHash;
    
    if (this.config.enableLogging && hasChanged) {
      console.log('🔄 FilterCache: Estado ha cambiado, requiere actualización');
    }
    
    return hasChanged;
  },
  
  // Marcar estado como aplicado
  markApplied: function(filterState) {
    this.lastApplied = this.generateHash(filterState);
    this.isDirty = false;
    
    if (this.config.enableLogging) {
      console.log(`✅ FilterCache: Estado marcado como aplicado - Hash: ${this.lastApplied.substring(0, 8)}...`);
    }
  },
  
  // Generar hash único para estado de filtros con mejoras
  generateHash: function(filterState) {
    try {
      // Normalizar el estado para hash consistente
      const normalizedState = this.normalizeState(filterState);
      
      // Usar JSON.stringify con orden de claves consistente
      const stateString = JSON.stringify(normalizedState, Object.keys(normalizedState).sort());
      
      // Generar hash simple pero efectivo
      return this.simpleHash(stateString);
    } catch (error) {
      console.error('Error al generar hash:', error);
      return Date.now().toString(); // Fallback
    }
  },
  
  // Normalizar estado para hash consistente
  normalizeState: function(state) {
    const normalized = {};
    
    // Ordenar claves y normalizar valores
    Object.keys(state).sort().forEach(key => {
      const value = state[key];
      
      // Normalizar números flotantes
      if (typeof value === 'number') {
        normalized[key] = Math.round(value * 100) / 100; // 2 decimales
      } else {
        normalized[key] = value;
      }
    });
    
    return normalized;
  },
  
  // Hash simple pero efectivo
  simpleHash: function(str) {
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32bit int
    }
    
    return hash.toString(36); // Base 36 para hash más corto
  },
  
  // Comprimir estado (simple object serialization)
  compressState: function(state) {
    try {
      // Comprimir removiendo valores por defecto (0)
      const compressed = {};
      
      Object.entries(state).forEach(([key, value]) => {
        if (value !== 0 && value !== false && value !== '' && value !== null) {
          compressed[key] = value;
        }
      });
      
      return compressed;
    } catch (error) {
      console.error('Error al comprimir estado:', error);
      return state;
    }
  },
  
  // Limpiar cache con estrategias avanzadas
  cleanup: function() {
    const now = Date.now();
    let cleaned = 0;
    
    // Estrategia 1: Eliminar estados expirados
    for (const [key, state] of this.states.entries()) {
      if (now - state.timestamp > this.config.maxAge) {
        this.states.delete(key);
        cleaned++;
      }
    }
    
    // Estrategia 2: Si aún hay demasiados, eliminar los más antiguos
    if (this.states.size > this.config.maxStates) {
      const sortedStates = Array.from(this.states.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = this.states.size - this.config.maxStates;
      for (let i = 0; i < toRemove; i++) {
        this.states.delete(sortedStates[i][0]);
        cleaned++;
      }
    }
    
    this.stats.cleanups++;
    
    if (this.config.enableLogging && cleaned > 0) {
      console.log(`🧹 FilterCache: ${cleaned} estados limpiados. Total restante: ${this.states.size}`);
    }
    
    return cleaned;
  },
  
  // Marcar como sucio (necesita actualización)
  markDirty: function() {
    this.isDirty = true;
    
    if (this.config.enableLogging) {
      console.log('🟡 FilterCache: Marcado como sucio');
    }
  },
  
  // Verificar si está sucio
  isDirtyState: function() {
    return this.isDirty;
  },
  
  // Buscar estados similares
  findSimilarStates: function(targetState, tolerance = 0.1) {
    const targetHash = this.generateHash(targetState);
    const similar = [];
    
    for (const [key, state] of this.states.entries()) {
      const similarity = this.calculateSimilarity(targetState, state.filters);
      
      if (similarity >= (1 - tolerance)) {
        similar.push({
          key,
          state,
          similarity,
          hash: state.hash
        });
      }
    }
    
    return similar.sort((a, b) => b.similarity - a.similarity);
  },
  
  // Calcular similaridad entre estados
  calculateSimilarity: function(state1, state2) {
    const keys = new Set([...Object.keys(state1), ...Object.keys(state2)]);
    let matches = 0;
    
    for (const key of keys) {
      const val1 = state1[key] || 0;
      const val2 = state2[key] || 0;
      
      // Calcular diferencia normalizada
      const maxVal = Math.max(Math.abs(val1), Math.abs(val2), 1);
      const difference = Math.abs(val1 - val2) / maxVal;
      
      matches += 1 - difference;
    }
    
    return matches / keys.size;
  },
  
  // Exportar cache para backup
  exportCache: function() {
    const exportData = {
      timestamp: Date.now(),
      version: '3.0',
      states: Array.from(this.states.entries()),
      stats: { ...this.stats },
      config: { ...this.config }
    };
    
    if (this.config.enableLogging) {
      console.log(`📤 FilterCache: Exportando ${this.states.size} estados`);
    }
    
    return exportData;
  },
  
  // Importar cache desde backup
  importCache: function(importData) {
    try {
      if (!importData || !importData.states) {
        throw new Error('Datos de importación inválidos');
      }
      
      // Limpiar cache actual
      this.states.clear();
      
      // Importar estados
      importData.states.forEach(([key, state]) => {
        this.states.set(key, state);
      });
      
      // Importar estadísticas si están disponibles
      if (importData.stats) {
        this.stats = { ...this.stats, ...importData.stats };
      }
      
      if (this.config.enableLogging) {
        console.log(`📥 FilterCache: Importados ${this.states.size} estados`);
      }
      
      return true;
    } catch (error) {
      console.error('Error al importar cache:', error);
      return false;
    }
  },
  
  // Configurar el cache
  configure: function(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enableLogging) {
      console.log('⚙️ FilterCache configurado:', this.config);
    }
  },
  
  // Obtener estadísticas detalladas
  getStats: function() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      totalStates: this.states.size,
      memoryUsage: this.estimateMemoryUsage(),
      isDirty: this.isDirty,
      lastApplied: this.lastApplied,
      config: this.config
    };
  },
  
  // Estimar uso de memoria
  estimateMemoryUsage: function() {
    let size = 0;
    
    for (const [key, state] of this.states.entries()) {
      size += key.length * 2; // String UTF-16
      size += JSON.stringify(state).length * 2;
    }
    
    return {
      bytes: size,
      kb: (size / 1024).toFixed(2),
      mb: (size / (1024 * 1024)).toFixed(2)
    };
  },
  
  // Limpiar todo el cache
  clear: function() {
    const oldSize = this.states.size;
    this.states.clear();
    this.lastApplied = null;
    this.isDirty = false;
    
    // Reset stats pero mantener counters históricos
    this.stats.cleanups++;
    
    if (this.config.enableLogging) {
      console.log(`🗑️ FilterCache: Cache limpiado completamente. ${oldSize} estados removidos`);
    }
  },
  
  // Cleanup al cerrar aplicación
  destroy: function() {
    this.clear();
    
    // Limpiar referencias
    this.states = null;
    this.lastApplied = null;
    
    if (this.config.enableLogging) {
      console.log('💥 FilterCache: Destruido');
    }
  }
};

// Verificar si existe window para registrar globalmente
if (typeof window !== 'undefined') {
  window.FilterCache = FilterCache;
}

// Exportar para módulos si es necesario
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FilterCache;
}
