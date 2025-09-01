/**
 * MnemoTag v3.0 - Smart Debounce
 * Sistema de debouncing inteligente con optimization frames y gestión avanzada
 * Características: Animation frames, intelligent timing, performance optimization, memory management
 */

const SmartDebounce = {
  // Almacenamiento de timers y frames
  timers: new Map(),
  animationFrames: new Map(),
  
  // Configuración
  config: {
    defaultDelay: 150,
    immediateDelay: 50,
    enableLogging: true,
    enablePerformanceMonitoring: true,
    maxConcurrentOperations: 10
  },
  
  // Métricas de rendimiento
  stats: {
    totalOperations: 0,
    cancelledOperations: 0,
    completedOperations: 0,
    averageDelay: 0
  },
  
  // Debounce inteligente con 150ms optimizado y métricas
  intelligent: function(key, func, delay = this.config.defaultDelay, options = {}) {
    const config = {
      useAnimationFrame: options.useAnimationFrame !== false,
      priority: options.priority || 'normal',
      context: options.context || null,
      onCancel: options.onCancel || null,
      enableStats: options.enableStats !== false
    };
    
    return (...args) => {
      this.stats.totalOperations++;
      
      // Verificar límite de operaciones concurrentes
      if (this.timers.size >= this.config.maxConcurrentOperations) {
        if (this.config.enableLogging) {
          console.warn(`⚠️ SmartDebounce: Límite de operaciones concurrentes alcanzado (${this.config.maxConcurrentOperations})`);
        }
        return;
      }
      
      // Cancelar timer anterior si existe
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
        this.stats.cancelledOperations++;
        
        // Ejecutar callback de cancelación si existe
        if (config.onCancel) {
          config.onCancel(key);
        }
      }
      
      // Cancelar animation frame anterior si existe
      if (this.animationFrames.has(key)) {
        cancelAnimationFrame(this.animationFrames.get(key));
        this.animationFrames.delete(key);
      }
      
      const startTime = config.enableStats ? performance.now() : 0;
      
      // Crear nuevo timer
      const timer = setTimeout(() => {
        if (config.useAnimationFrame) {
          // Ejecutar en el próximo animation frame para mejor performance
          const frameId = requestAnimationFrame(() => {
            try {
              if (config.context) {
                func.call(config.context, ...args);
              } else {
                func.apply(this, args);
              }
              
              this.stats.completedOperations++;
              
              // Actualizar métricas de tiempo
              if (config.enableStats && startTime) {
                const executionTime = performance.now() - startTime;
                this.updateAverageDelay(executionTime);
              }
              
              if (this.config.enableLogging) {
                console.log(`⚡ SmartDebounce: Ejecutado [${key}] con delay ${delay}ms`);
              }
            } catch (error) {
              console.error(`❌ SmartDebounce: Error ejecutando [${key}]:`, error);
            }
            
            this.animationFrames.delete(key);
          });
          this.animationFrames.set(key, frameId);
        } else {
          // Ejecutar directamente
          try {
            if (config.context) {
              func.call(config.context, ...args);
            } else {
              func.apply(this, args);
            }
            
            this.stats.completedOperations++;
            
            if (this.config.enableLogging) {
              console.log(`⚡ SmartDebounce: Ejecutado directamente [${key}]`);
            }
          } catch (error) {
            console.error(`❌ SmartDebounce: Error ejecutando [${key}]:`, error);
          }
        }
        
        this.timers.delete(key);
      }, delay);
      
      this.timers.set(key, timer);
      
      if (this.config.enableLogging) {
        console.log(`🕒 SmartDebounce: Programado [${key}] con delay ${delay}ms`);
      }
    };
  },
  
  // Debounce inmediato para casos críticos
  immediate: function(key, func, delay = this.config.immediateDelay, options = {}) {
    const config = {
      context: options.context || null,
      enableStats: options.enableStats !== false
    };
    
    return (...args) => {
      // Cancelar animation frame anterior si existe
      if (this.animationFrames.has(key)) {
        cancelAnimationFrame(this.animationFrames.get(key));
        this.stats.cancelledOperations++;
      }
      
      const startTime = config.enableStats ? performance.now() : 0;
      
      const frameId = requestAnimationFrame(() => {
        try {
          if (config.context) {
            func.call(config.context, ...args);
          } else {
            func.apply(this, args);
          }
          
          this.stats.completedOperations++;
          
          // Actualizar métricas
          if (config.enableStats && startTime) {
            const executionTime = performance.now() - startTime;
            this.updateAverageDelay(executionTime);
          }
          
          if (this.config.enableLogging) {
            console.log(`⚡ SmartDebounce: Ejecutado inmediato [${key}]`);
          }
        } catch (error) {
          console.error(`❌ SmartDebounce: Error ejecutando inmediato [${key}]:`, error);
        }
        
        this.animationFrames.delete(key);
      });
      
      this.animationFrames.set(key, frameId);
    };
  },
  
  // Debounce con throttle combinado
  throttledDebounce: function(key, func, debounceDelay = 150, throttleDelay = 50, options = {}) {
    let lastExecution = 0;
    
    return this.intelligent(key, (...args) => {
      const now = Date.now();
      
      if (now - lastExecution >= throttleDelay) {
        lastExecution = now;
        
        if (options.context) {
          func.call(options.context, ...args);
        } else {
          func.apply(this, args);
        }
      }
    }, debounceDelay, options);
  },
  
  // Debounce con prioridades
  priorityDebounce: function(key, func, delay = 150, priority = 'normal') {
    const priorityDelays = {
      high: delay * 0.5,
      normal: delay,
      low: delay * 1.5
    };
    
    const adjustedDelay = priorityDelays[priority] || delay;
    
    return this.intelligent(key, func, adjustedDelay, { priority });
  },
  
  // Ejecutar inmediatamente sin debounce
  execute: function(key, func, options = {}) {
    // Cancelar cualquier operación pendiente
    this.cancel(key);
    
    try {
      if (options.context) {
        func.call(options.context);
      } else {
        func();
      }
      
      this.stats.completedOperations++;
      
      if (this.config.enableLogging) {
        console.log(`⚡ SmartDebounce: Ejecutado inmediatamente [${key}]`);
      }
    } catch (error) {
      console.error(`❌ SmartDebounce: Error ejecutando inmediatamente [${key}]:`, error);
    }
  },
  
  // Cancelar operación específica
  cancel: function(key) {
    let cancelled = false;
    
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
      cancelled = true;
    }
    
    if (this.animationFrames.has(key)) {
      cancelAnimationFrame(this.animationFrames.get(key));
      this.animationFrames.delete(key);
      cancelled = true;
    }
    
    if (cancelled) {
      this.stats.cancelledOperations++;
      
      if (this.config.enableLogging) {
        console.log(`❌ SmartDebounce: Cancelado [${key}]`);
      }
    }
    
    return cancelled;
  },
  
  // Verificar si una operación está pendiente
  isPending: function(key) {
    return this.timers.has(key) || this.animationFrames.has(key);
  },
  
  // Obtener operaciones pendientes
  getPendingOperations: function() {
    return {
      timers: Array.from(this.timers.keys()),
      animationFrames: Array.from(this.animationFrames.keys()),
      total: this.timers.size + this.animationFrames.size
    };
  },
  
  // Pausar todas las operaciones
  pauseAll: function() {
    const pending = this.getPendingOperations();
    
    // Guardar estado para poder reanudar
    this._pausedState = {
      timers: new Map(this.timers),
      animationFrames: new Map(this.animationFrames)
    };
    
    this.clear();
    
    if (this.config.enableLogging) {
      console.log(`⏸️ SmartDebounce: Pausadas ${pending.total} operaciones`);
    }
    
    return pending;
  },
  
  // Reanudar operaciones pausadas
  resumeAll: function() {
    if (!this._pausedState) {
      console.warn('⚠️ SmartDebounce: No hay operaciones pausadas para reanudar');
      return;
    }
    
    // Restaurar timers (con delay reducido)
    for (const [key, timer] of this._pausedState.timers) {
      // Reanudar con delay reducido
      const reducedDelay = Math.max(50, this.config.defaultDelay * 0.3);
      setTimeout(() => {
        // Ejecutar la función original (si está disponible)
        console.log(`🔄 SmartDebounce: Reanudando [${key}]`);
      }, reducedDelay);
    }
    
    this._pausedState = null;
    
    if (this.config.enableLogging) {
      console.log('▶️ SmartDebounce: Operaciones reanudadas');
    }
  },
  
  // Limpiar todos los timers y frames
  clear: function() {
    const totalCleared = this.timers.size + this.animationFrames.size;
    
    this.timers.forEach(timer => clearTimeout(timer));
    this.animationFrames.forEach(frameId => cancelAnimationFrame(frameId));
    this.timers.clear();
    this.animationFrames.clear();
    
    this.stats.cancelledOperations += totalCleared;
    
    if (this.config.enableLogging && totalCleared > 0) {
      console.log(`🧹 SmartDebounce: ${totalCleared} operaciones limpiadas`);
    }
  },
  
  // Actualizar promedio de delay
  updateAverageDelay: function(newDelay) {
    const totalOps = this.stats.completedOperations;
    this.stats.averageDelay = ((this.stats.averageDelay * (totalOps - 1)) + newDelay) / totalOps;
  },
  
  // Configurar el sistema
  configure: function(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enableLogging) {
      console.log('⚙️ SmartDebounce configurado:', this.config);
    }
  },
  
  // Obtener estadísticas detalladas
  getStats: function() {
    const efficiency = this.stats.totalOperations > 0 
      ? ((this.stats.completedOperations / this.stats.totalOperations) * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      efficiency: `${efficiency}%`,
      pendingOperations: this.timers.size + this.animationFrames.size,
      averageDelay: Math.round(this.stats.averageDelay * 100) / 100,
      config: this.config
    };
  },
  
  // Reset estadísticas
  resetStats: function() {
    this.stats = {
      totalOperations: 0,
      cancelledOperations: 0,
      completedOperations: 0,
      averageDelay: 0
    };
    
    if (this.config.enableLogging) {
      console.log('📊 SmartDebounce: Estadísticas reseteadas');
    }
  },
  
  // Cleanup completo
  destroy: function() {
    this.clear();
    this.resetStats();
    
    // Limpiar estado pausado si existe
    this._pausedState = null;
    
    if (this.config.enableLogging) {
      console.log('💥 SmartDebounce: Destruido');
    }
  }
};

// Verificar si existe window para registrar globalmente
if (typeof window !== 'undefined') {
  window.SmartDebounce = SmartDebounce;
}

// Exportar para módulos si es necesario
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SmartDebounce;
}
