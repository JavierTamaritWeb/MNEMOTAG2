/**
 * TextLayerManager - Sistema de capas de texto avanzadas
 * Permite múltiples textos con efectos y Google Fonts
 * @version 1.0.0
 */

class TextLayerManager {
  constructor() {
    this.layers = [];
    this.activeLayerId = null;
    this.maxLayers = 10;
    this.loadedFonts = new Set();
    
    // Google Fonts populares
    this.availableFonts = [
      'Roboto',
      'Open Sans',
      'Lato',
      'Montserrat',
      'Montserrat Alternates',
      'Oswald',
      'Raleway',
      'PT Sans',
      'Merriweather',
      'Playfair Display',
      'Ubuntu',
      'Nunito',
      'Poppins',
      'Inter',
      'Bebas Neue',
      'Dancing Script',
      'Pacifico',
      'Lobster',
      'Russo One',
      'Permanent Marker',
      'Caveat'
    ];
    
    // Plantillas prediseñadas
    this.templates = this.createTemplates();
    
    console.log('✅ TextLayerManager inicializado');
  }

  /**
   * Crear plantillas prediseñadas
   */
  createTemplates() {
    return {
      'modern': {
        name: 'Título Moderno',
        config: {
          font: { family: 'Montserrat', size: 48, weight: 'bold' },
          color: '#ffffff',
          effects: {
            shadow: { offsetX: 2, offsetY: 2, blur: 4, color: 'rgba(0,0,0,0.3)' },
            stroke: null,
            gradient: null
          }
        }
      },
      'elegant': {
        name: 'Elegante Clásico',
        config: {
          font: { family: 'Playfair Display', size: 52, weight: 'normal' },
          color: '#2c2c2c',
          effects: {
            shadow: { offsetX: 1, offsetY: 1, blur: 2, color: 'rgba(0,0,0,0.2)' },
            stroke: null,
            gradient: null
          }
        }
      },
      'neon': {
        name: 'Neon Brillante',
        config: {
          font: { family: 'Bebas Neue', size: 56, weight: 'normal' },
          color: '#00ffff',
          effects: {
            shadow: { offsetX: 0, offsetY: 0, blur: 20, color: '#00ffff' },
            stroke: { width: 2, color: '#ffffff' },
            gradient: null
          }
        }
      },
      'vintage': {
        name: 'Vintage Retro',
        config: {
          font: { family: 'Lobster', size: 44, weight: 'normal' },
          color: '#d4a574',
          effects: {
            shadow: { offsetX: 3, offsetY: 3, blur: 0, color: '#5c4033' },
            stroke: { width: 3, color: '#2c1810' },
            gradient: null
          }
        }
      },
      'minimal': {
        name: 'Minimalista',
        config: {
          font: { family: 'Roboto', size: 40, weight: '300' },
          color: '#333333',
          effects: {
            shadow: null,
            stroke: null,
            gradient: null
          }
        }
      },
      'dramatic': {
        name: 'Dramático',
        config: {
          font: { family: 'Oswald', size: 60, weight: 'bold' },
          color: '#ffffff',
          effects: {
            shadow: { offsetX: 4, offsetY: 4, blur: 8, color: 'rgba(0,0,0,0.8)' },
            stroke: { width: 2, color: '#000000' },
            gradient: null
          }
        }
      },
      'handwritten': {
        name: 'Manuscrito',
        config: {
          font: { family: 'Dancing Script', size: 48, weight: 'normal' },
          color: '#4a4a4a',
          effects: {
            shadow: { offsetX: 1, offsetY: 1, blur: 3, color: 'rgba(0,0,0,0.25)' },
            stroke: null,
            gradient: null
          }
        }
      },
      'urban': {
        name: 'Urbano',
        config: {
          font: { family: 'Russo One', size: 50, weight: 'normal' },
          color: '#ff6b00',
          effects: {
            shadow: { offsetX: 3, offsetY: 3, blur: 0, color: '#000000' },
            stroke: { width: 2, color: '#ffffff' },
            gradient: null
          }
        }
      },
      'watercolor': {
        name: 'Acuarela',
        config: {
          font: { family: 'Caveat', size: 46, weight: 'normal' },
          color: '#7cb5d2',
          effects: {
            shadow: { offsetX: 2, offsetY: 2, blur: 8, color: 'rgba(124,181,210,0.4)' },
            stroke: null,
            gradient: { type: 'linear', colors: ['#7cb5d2', '#a8d5e5'], angle: 45 }
          }
        }
      },
      'corporate': {
        name: 'Corporativo',
        config: {
          font: { family: 'Inter', size: 42, weight: '600' },
          color: '#2d3e50',
          effects: {
            shadow: { offsetX: 0, offsetY: 2, blur: 4, color: 'rgba(0,0,0,0.15)' },
            stroke: null,
            gradient: null
          }
        }
      }
    };
  }

  /**
   * Cargar Google Font
   */
  async loadFont(fontFamily) {
    if (this.loadedFonts.has(fontFamily)) {
      return true;
    }

    try {
      // Crear link element para Google Fonts
      const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@300;400;600;700&display=swap`;
      
      // Verificar si ya existe el link
      const existingLink = document.querySelector(`link[href*="${fontFamily.replace(/ /g, '+')}"]`);
      
      if (!existingLink) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = fontUrl;
        document.head.appendChild(link);
        
        // Esperar a que la fuente se cargue
        await document.fonts.load(`16px "${fontFamily}"`);
      }
      
      this.loadedFonts.add(fontFamily);
      console.log(`✅ Google Font cargada: ${fontFamily}`);
      return true;
      
    } catch (error) {
      console.error(`Error cargando fuente ${fontFamily}:`, error);
      return false;
    }
  }

  /**
   * Agregar nueva capa de texto
   */
  async addLayer(config = {}) {
    if (this.layers.length >= this.maxLayers) {
      throw new Error(`Máximo ${this.maxLayers} capas permitidas`);
    }

    const defaultConfig = {
      text: config.text || 'Nuevo texto',
      font: {
        family: config.font?.family || 'Roboto',
        size: config.font?.size || 40,
        weight: config.font?.weight || 'normal'
      },
      position: {
        x: config.position?.x || 50,
        y: config.position?.y || 50
      },
      color: config.color || '#ffffff',
      effects: {
        shadow: config.effects?.shadow || null,
        stroke: config.effects?.stroke || null,
        gradient: config.effects?.gradient || null
      },
      visible: config.visible !== false,
      opacity: config.opacity || 1
    };

    // Cargar fuente si es necesario
    await this.loadFont(defaultConfig.font.family);

    const layer = {
      id: this.generateId(),
      ...defaultConfig,
      zIndex: this.layers.length,
      createdAt: Date.now()
    };

    this.layers.push(layer);
    this.activeLayerId = layer.id;
    
    console.log(`📝 Capa de texto agregada: ${layer.id}`);
    return layer;
  }

  /**
   * Actualizar capa existente
   */
  async updateLayer(id, updates) {
    const layer = this.getLayer(id);
    if (!layer) {
      throw new Error(`Capa no encontrada: ${id}`);
    }

    // Si cambia la fuente, cargarla
    if (updates.font?.family && updates.font.family !== layer.font.family) {
      await this.loadFont(updates.font.family);
    }

    // Actualizar propiedades
    Object.assign(layer, {
      ...updates,
      font: { ...layer.font, ...updates.font },
      position: { ...layer.position, ...updates.position },
      effects: {
        shadow: updates.effects?.shadow !== undefined ? updates.effects.shadow : layer.effects.shadow,
        stroke: updates.effects?.stroke !== undefined ? updates.effects.stroke : layer.effects.stroke,
        gradient: updates.effects?.gradient !== undefined ? updates.effects.gradient : layer.effects.gradient
      }
    });

    console.log(`✏️ Capa actualizada: ${id}`);
    return layer;
  }

  /**
   * Eliminar capa
   */
  removeLayer(id) {
    const index = this.layers.findIndex(l => l.id === id);
    if (index === -1) {
      throw new Error(`Capa no encontrada: ${id}`);
    }

    this.layers.splice(index, 1);
    
    // Si era la capa activa, seleccionar otra
    if (this.activeLayerId === id) {
      this.activeLayerId = this.layers.length > 0 ? this.layers[0].id : null;
    }

    console.log(`🗑️ Capa eliminada: ${id}`);
    return true;
  }

  /**
   * Duplicar capa
   */
  async duplicateLayer(id) {
    const layer = this.getLayer(id);
    if (!layer) {
      throw new Error(`Capa no encontrada: ${id}`);
    }

    const duplicate = {
      ...layer,
      id: this.generateId(),
      text: layer.text + ' (copia)',
      position: {
        x: layer.position.x + 20,
        y: layer.position.y + 20
      },
      createdAt: Date.now()
    };

    this.layers.push(duplicate);
    this.activeLayerId = duplicate.id;

    console.log(`📋 Capa duplicada: ${id} → ${duplicate.id}`);
    return duplicate;
  }

  /**
   * Reordenar capas (cambiar z-index)
   */
  reorderLayer(id, newIndex) {
    const currentIndex = this.layers.findIndex(l => l.id === id);
    if (currentIndex === -1) {
      throw new Error(`Capa no encontrada: ${id}`);
    }

    const [layer] = this.layers.splice(currentIndex, 1);
    this.layers.splice(newIndex, 0, layer);

    // Actualizar z-index de todas las capas
    this.layers.forEach((l, idx) => {
      l.zIndex = idx;
    });

    console.log(`🔄 Capa reordenada: ${id} (${currentIndex} → ${newIndex})`);
    return true;
  }

  /**
   * Renderizar todas las capas en canvas
   */
  renderLayers(ctx, canvas) {
    if (!ctx || !canvas) {
      throw new Error('Canvas context requerido');
    }

    // Ordenar por z-index
    const sortedLayers = [...this.layers].sort((a, b) => a.zIndex - b.zIndex);

    for (const layer of sortedLayers) {
      if (!layer.visible) continue;
      
      this.renderLayer(ctx, layer, canvas);
    }
  }

  /**
   * Renderizar capa individual
   */
  renderLayer(ctx, layer, canvas) {
    ctx.save();

    // Aplicar opacidad global
    ctx.globalAlpha = layer.opacity;

    // Configurar fuente
    const fontString = `${layer.font.weight} ${layer.font.size}px "${layer.font.family}", sans-serif`;
    ctx.font = fontString;
    ctx.textBaseline = 'top';

    // Aplicar efectos de sombra
    if (layer.effects.shadow) {
      const s = layer.effects.shadow;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = s.blur;
      ctx.shadowOffsetX = s.offsetX;
      ctx.shadowOffsetY = s.offsetY;
    }

    // Aplicar stroke (borde)
    if (layer.effects.stroke) {
      const st = layer.effects.stroke;
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.width;
      ctx.lineJoin = 'round';
      ctx.strokeText(layer.text, layer.position.x, layer.position.y);
    }

    // Aplicar gradiente o color sólido
    if (layer.effects.gradient) {
      const g = layer.effects.gradient;
      let gradient;

      if (g.type === 'linear') {
        const angle = (g.angle || 0) * Math.PI / 180;
        const metrics = ctx.measureText(layer.text);
        const textWidth = metrics.width;
        const textHeight = layer.font.size;

        const x1 = layer.position.x;
        const y1 = layer.position.y;
        const x2 = x1 + textWidth * Math.cos(angle);
        const y2 = y1 + textHeight * Math.sin(angle);

        gradient = ctx.createLinearGradient(x1, y1, x2, y2);
      } else {
        // Radial gradient
        const metrics = ctx.measureText(layer.text);
        const centerX = layer.position.x + metrics.width / 2;
        const centerY = layer.position.y + layer.font.size / 2;
        const radius = Math.max(metrics.width, layer.font.size) / 2;

        gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      }

      g.colors.forEach((color, index) => {
        gradient.addColorStop(index / (g.colors.length - 1), color);
      });

      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = layer.color;
    }

    // Dibujar texto
    ctx.fillText(layer.text, layer.position.x, layer.position.y);

    ctx.restore();
  }

  /**
   * Aplicar plantilla prediseñada
   */
  async applyTemplate(templateKey, text = 'Título') {
    const template = this.templates[templateKey];
    if (!template) {
      throw new Error(`Plantilla no encontrada: ${templateKey}`);
    }

    const config = {
      ...template.config,
      text: text
    };

    return await this.addLayer(config);
  }

  /**
   * Obtener capa por ID
   */
  getLayer(id) {
    return this.layers.find(l => l.id === id);
  }

  /**
   * Obtener capa activa
   */
  getActiveLayer() {
    return this.activeLayerId ? this.getLayer(this.activeLayerId) : null;
  }

  /**
   * Establecer capa activa
   */
  setActiveLayer(id) {
    if (!this.getLayer(id)) {
      throw new Error(`Capa no encontrada: ${id}`);
    }
    this.activeLayerId = id;
  }

  /**
   * Limpiar todas las capas
   */
  clearLayers() {
    this.layers = [];
    this.activeLayerId = null;
    console.log('🧹 Capas de texto limpiadas');
  }

  /**
   * Obtener todas las capas
   */
  getAllLayers() {
    return [...this.layers];
  }

  /**
   * Generar ID único
   */
  generateId() {
    return `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Exportar configuración de capas
   */
  exportConfig() {
    return {
      layers: this.layers.map(l => ({ ...l })),
      activeLayerId: this.activeLayerId
    };
  }

  /**
   * Importar configuración de capas
   */
  async importConfig(config) {
    this.layers = [];
    
    for (const layerData of config.layers) {
      await this.loadFont(layerData.font.family);
      this.layers.push({ ...layerData });
    }
    
    this.activeLayerId = config.activeLayerId;
    console.log(`📥 Configuración importada: ${this.layers.length} capas`);
  }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.TextLayerManager = TextLayerManager;
}
