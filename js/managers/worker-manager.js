/**
 * MnemoTag v3.0 - Sistema de gestión de workers
 * Sistema avanzado de workers para procesamiento de imágenes con optimizaciones
 * Características: Pool de workers, transferable objects, jobs management, fallbacks
 */

// Sistema de gestión de workers para procesamiento de imágenes
const WorkerManager = {
  workers: new Map(),
  maxWorkers: navigator.hardwareConcurrency || 4,
  activeJobs: new Map(),
  jobIdCounter: 0,
  
  // Configuración de workers
  config: {
    workerScript: 'workers/image-processor.js',
    defaultPoolSize: 2,
    maxRetries: 3,
    timeout: 30000, // 30 segundos
    enableLogging: true
  },
  
  // Verificar soporte de workers
  isSupported: function() {
    try {
      return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
    } catch (e) {
      return false;
    }
  },
  
  // Verificar soporte de workers (alias)
  supportsWorkers: function() {
    return this.isSupported();
  },
  
  // Verificar soporte de transferable objects
  supportsTransferableObjects: function() {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const imageData = ctx.createImageData(1, 1);
      return imageData.data.buffer instanceof ArrayBuffer;
    } catch (e) {
      return false;
    }
  },
  
  // Verificar si Workers están disponibles
  checkWorkerSupport: function() {
    const support = {
      workers: this.supportsWorkers(),
      transferableObjects: this.supportsTransferableObjects(),
      offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
      hardwareConcurrency: navigator.hardwareConcurrency || 0
    };
    
    if (this.config.enableLogging) {
      console.log('🔍 Worker Support Check:', support);
    }
    
    return support;
  },
  
  // Crear worker pool
  initializeWorkerPool: function(poolSize = null) {
    if (!this.supportsWorkers()) {
      console.warn('⚠️ Workers no soportados, usando fallback');
      return false;
    }
    
    const size = poolSize || Math.min(this.config.defaultPoolSize, this.maxWorkers);
    
    try {
      for (let i = 0; i < size; i++) {
        const worker = new Worker(this.config.workerScript);
        worker.onmessage = this.handleWorkerMessage.bind(this);
        worker.onerror = this.handleWorkerError.bind(this);
        worker.onmessageerror = this.handleWorkerMessageError.bind(this);
        
        this.workers.set(i, {
          worker: worker,
          busy: false,
          lastUsed: Date.now(),
          jobsCompleted: 0,
          errors: 0,
          id: i
        });
      }
      
      if (this.config.enableLogging) {
        console.log(`🔧 Worker pool inicializado con ${this.workers.size} workers`);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error al inicializar workers:', error);
      return false;
    }
  },
  
  // Obtener worker disponible
  getAvailableWorker: function() {
    // Buscar worker no ocupado
    for (const [id, workerInfo] of this.workers.entries()) {
      if (!workerInfo.busy) {
        workerInfo.busy = true;
        workerInfo.lastUsed = Date.now();
        return { id, worker: workerInfo.worker };
      }
    }
    
    // Si no hay workers disponibles, buscar el menos usado
    let leastUsedWorker = null;
    let oldestTime = Date.now();
    
    for (const [id, workerInfo] of this.workers.entries()) {
      if (workerInfo.lastUsed < oldestTime) {
        oldestTime = workerInfo.lastUsed;
        leastUsedWorker = { id, worker: workerInfo.worker };
      }
    }
    
    if (leastUsedWorker && this.config.enableLogging) {
      console.warn('⚠️ Todos los workers ocupados, usando el menos reciente');
    }
    
    return leastUsedWorker;
  },
  
  // Liberar worker
  releaseWorker: function(workerId) {
    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      workerInfo.busy = false;
      workerInfo.lastUsed = Date.now();
      workerInfo.jobsCompleted++;
    }
  },
  
  // Manejar mensajes de workers
  handleWorkerMessage: function(e) {
    const { id, result, error, type } = e.data;
    const job = this.activeJobs.get(id);
    
    if (!job) {
      console.warn(`⚠️ Job ${id} no encontrado`);
      return;
    }
    
    // Limpiar timeout si existe
    if (job.timeoutId) {
      clearTimeout(job.timeoutId);
    }
    
    // Liberar worker
    this.releaseWorker(job.workerId);
    
    // Procesar resultado según tipo
    if (type === 'progress') {
      // Manejar progreso
      if (job.onProgress) {
        job.onProgress(result);
      }
      return;
    }
    
    // Resolver/rechazar promesa
    if (error) {
      if (this.config.enableLogging) {
        console.error(`❌ Job ${id} falló:`, error);
      }
      job.reject(new Error(error));
    } else {
      if (this.config.enableLogging) {
        console.log(`✅ Job ${id} completado en ${Date.now() - job.startTime}ms`);
      }
      job.resolve(result);
    }
    
    // Limpiar job
    this.activeJobs.delete(id);
  },
  
  // Manejar errores de workers
  handleWorkerError: function(error) {
    console.error('❌ Error en worker:', error);
    
    // Incrementar contador de errores del worker
    for (const [id, workerInfo] of this.workers.entries()) {
      if (workerInfo.worker === error.target) {
        workerInfo.errors++;
        break;
      }
    }
    
    // Limpiar jobs activos relacionados
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.workerId === error.target.workerId) {
        if (job.timeoutId) {
          clearTimeout(job.timeoutId);
        }
        job.reject(new Error('Worker error: ' + error.message));
        this.activeJobs.delete(jobId);
      }
    }
  },
  
  // Manejar errores de mensaje
  handleWorkerMessageError: function(error) {
    console.error('❌ Error de mensaje en worker:', error);
  },
  
  // Procesar imagen en worker con timeout y retry
  processInWorker: function(imageData, operations, options = {}) {
    return new Promise((resolve, reject) => {
      // Verificar disponibilidad de worker
      const workerInfo = this.getAvailableWorker();
      if (!workerInfo) {
        reject(new Error('No hay workers disponibles'));
        return;
      }
      
      // Crear job ID único
      const jobId = ++this.jobIdCounter;
      
      // Configurar timeout
      const timeout = options.timeout || this.config.timeout;
      const timeoutId = setTimeout(() => {
        this.releaseWorker(workerInfo.id);
        this.activeJobs.delete(jobId);
        reject(new Error(`Worker timeout después de ${timeout}ms`));
      }, timeout);
      
      // Guardar job
      this.activeJobs.set(jobId, {
        resolve,
        reject,
        workerId: workerInfo.id,
        startTime: Date.now(),
        timeoutId,
        onProgress: options.onProgress,
        retryCount: 0
      });
      
      // Preparar datos para transferencia
      try {
        const transferableData = this.prepareTransferableData(imageData, operations);
        
        // Enviar al worker
        workerInfo.worker.postMessage({
          id: jobId,
          type: 'process',
          data: transferableData.data,
          options: options
        }, transferableData.transferables);
        
        if (this.config.enableLogging) {
          console.log(`🚀 Job ${jobId} enviado a worker ${workerInfo.id}`);
        }
      } catch (error) {
        // Limpiar en caso de error
        clearTimeout(timeoutId);
        this.releaseWorker(workerInfo.id);
        this.activeJobs.delete(jobId);
        reject(error);
      }
    });
  },
  
  // Preparar datos transferables optimizado
  prepareTransferableData: function(imageData, operations) {
    const transferables = [];
    let processedImageData = imageData;
    
    // Si soporta transferable objects, preparar ImageData
    if (this.supportsTransferableObjects() && imageData instanceof ImageData) {
      try {
        // Clonar buffer para transferencia
        const buffer = imageData.data.buffer.slice();
        processedImageData = {
          data: new Uint8ClampedArray(buffer),
          width: imageData.width,
          height: imageData.height
        };
        transferables.push(buffer);
      } catch (error) {
        console.warn('⚠️ Error preparando transferable ImageData:', error);
        // Fallback a copia normal
        processedImageData = {
          data: new Uint8ClampedArray(imageData.data),
          width: imageData.width,
          height: imageData.height
        };
      }
    }
    
    // Procesar operaciones para transferencia
    const processedOperations = operations.map(op => {
      if (op.type === 'watermark-image' && op.config.imageData) {
        try {
          // Manejar datos de imagen de marca de agua
          const watermarkBuffer = op.config.imageData.data.buffer.slice();
          transferables.push(watermarkBuffer);
          return {
            ...op,
            config: {
              ...op.config,
              imageData: {
                data: new Uint8ClampedArray(watermarkBuffer),
                width: op.config.imageData.width,
                height: op.config.imageData.height
              }
            }
          };
        } catch (error) {
          console.warn('⚠️ Error preparando transferable watermark:', error);
          return op;
        }
      }
      return op;
    });
    
    return {
      data: {
        imageData: processedImageData,
        operations: processedOperations
      },
      transferables
    };
  },
  
  // Procesar múltiples trabajos en paralelo
  processInParallel: function(jobs) {
    return Promise.all(jobs.map(job => 
      this.processInWorker(job.imageData, job.operations, job.options)
    ));
  },
  
  // Cancelar job específico
  cancelJob: function(jobId) {
    const job = this.activeJobs.get(jobId);
    if (job) {
      if (job.timeoutId) {
        clearTimeout(job.timeoutId);
      }
      this.releaseWorker(job.workerId);
      this.activeJobs.delete(jobId);
      job.reject(new Error('Job cancelado'));
      return true;
    }
    return false;
  },
  
  // Cancelar todos los jobs activos
  cancelAllJobs: function() {
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.timeoutId) {
        clearTimeout(job.timeoutId);
      }
      this.releaseWorker(job.workerId);
      job.reject(new Error('Job cancelado'));
    }
    this.activeJobs.clear();
    
    if (this.config.enableLogging) {
      console.log('🚫 Todos los jobs cancelados');
    }
  },
  
  // Reiniciar worker específico
  restartWorker: function(workerId) {
    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      // Terminar worker actual
      workerInfo.worker.terminate();
      
      // Crear nuevo worker
      try {
        const newWorker = new Worker(this.config.workerScript);
        newWorker.onmessage = this.handleWorkerMessage.bind(this);
        newWorker.onerror = this.handleWorkerError.bind(this);
        newWorker.onmessageerror = this.handleWorkerMessageError.bind(this);
        
        // Actualizar worker info
        this.workers.set(workerId, {
          worker: newWorker,
          busy: false,
          lastUsed: Date.now(),
          jobsCompleted: 0,
          errors: 0,
          id: workerId
        });
        
        if (this.config.enableLogging) {
          console.log(`🔄 Worker ${workerId} reiniciado`);
        }
        
        return true;
      } catch (error) {
        console.error(`❌ Error reiniciando worker ${workerId}:`, error);
        return false;
      }
    }
    return false;
  },
  
  // Terminar todos los workers
  terminateWorkers: function() {
    // Cancelar todos los jobs activos
    this.cancelAllJobs();
    
    // Terminar workers
    for (const [id, workerInfo] of this.workers.entries()) {
      workerInfo.worker.terminate();
    }
    
    this.workers.clear();
    this.activeJobs.clear();
    this.jobIdCounter = 0;
    
    if (this.config.enableLogging) {
      console.log('🔌 Todos los workers terminados');
    }
  },
  
  // Obtener estadísticas detalladas
  getStats: function() {
    const busyWorkers = Array.from(this.workers.values()).filter(w => w.busy).length;
    const totalJobsCompleted = Array.from(this.workers.values()).reduce((sum, w) => sum + w.jobsCompleted, 0);
    const totalErrors = Array.from(this.workers.values()).reduce((sum, w) => sum + w.errors, 0);
    
    return {
      totalWorkers: this.workers.size,
      busyWorkers,
      availableWorkers: this.workers.size - busyWorkers,
      activeJobs: this.activeJobs.size,
      totalJobsCompleted,
      totalErrors,
      supportsWorkers: this.supportsWorkers(),
      supportsTransferables: this.supportsTransferableObjects(),
      maxWorkers: this.maxWorkers,
      config: this.config
    };
  },
  
  // Obtener información de rendimiento
  getPerformanceInfo: function() {
    const stats = this.getStats();
    const workers = Array.from(this.workers.values()).map(w => ({
      id: w.id,
      busy: w.busy,
      jobsCompleted: w.jobsCompleted,
      errors: w.errors,
      lastUsed: w.lastUsed,
      uptime: Date.now() - w.lastUsed
    }));
    
    return {
      ...stats,
      workers,
      averageJobsPerWorker: stats.totalJobsCompleted / stats.totalWorkers || 0,
      errorRate: stats.totalErrors / Math.max(stats.totalJobsCompleted, 1) * 100
    };
  },
  
  // Configurar manager
  configure: function(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enableLogging) {
      console.log('⚙️ WorkerManager configurado:', this.config);
    }
  },
  
  // Verificar salud de workers
  healthCheck: function() {
    const unhealthyWorkers = [];
    
    for (const [id, workerInfo] of this.workers.entries()) {
      // Verificar si el worker tiene demasiados errores
      if (workerInfo.errors > 5) {
        unhealthyWorkers.push({
          id,
          reason: 'too_many_errors',
          errors: workerInfo.errors
        });
      }
      
      // Verificar si el worker está ocupado por mucho tiempo
      if (workerInfo.busy && (Date.now() - workerInfo.lastUsed) > 60000) {
        unhealthyWorkers.push({
          id,
          reason: 'stuck',
          lastUsed: workerInfo.lastUsed
        });
      }
    }
    
    if (unhealthyWorkers.length > 0 && this.config.enableLogging) {
      console.warn('⚠️ Workers con problemas encontrados:', unhealthyWorkers);
    }
    
    return {
      healthy: unhealthyWorkers.length === 0,
      unhealthyWorkers,
      totalWorkers: this.workers.size
    };
  }
};

// Verificar si existe window para registrar globalmente
if (typeof window !== 'undefined') {
  window.WorkerManager = WorkerManager;
}

// Exportar para módulos si es necesario
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorkerManager;
}
