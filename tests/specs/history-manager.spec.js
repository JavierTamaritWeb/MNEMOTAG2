// Tests de historyManager — únicamente la lógica que NO depende de canvas real.
// saveState/restoreState requieren un canvas global de main.js, así que se
// validan manipulando los internals directamente.

describe('historyManager — estado inicial', function () {
  it('está expuesto como objeto global', function () {
    expect(typeof historyManager).toBe('object');
    expect(historyManager).not.toBeNull();
  });

  it('arranca vacío y sin posibilidad de undo/redo', function () {
    historyManager.clear();
    expect(historyManager.canUndo()).toBe(false);
    expect(historyManager.canRedo()).toBe(false);
    const info = historyManager.getInfo();
    expect(info.totalStates).toBe(0);
    expect(info.currentIndex).toBe(-1);
  });

  it('declara un límite máximo de estados', function () {
    expect(typeof historyManager.maxStates).toBe('number');
    expect(historyManager.maxStates).toBeGreaterThan(0);
  });
});

describe('historyManager — navegación lógica con estado simulado', function () {
  it('canUndo true cuando currentIndex > 0', function () {
    historyManager.clear();
    historyManager.states = [{ id: 1 }, { id: 2 }, { id: 3 }];
    historyManager.currentIndex = 2;
    expect(historyManager.canUndo()).toBe(true);
    expect(historyManager.canRedo()).toBe(false);
    historyManager.clear();
  });

  it('canRedo true cuando currentIndex < states.length - 1', function () {
    historyManager.clear();
    historyManager.states = [{ id: 1 }, { id: 2 }, { id: 3 }];
    historyManager.currentIndex = 0;
    expect(historyManager.canUndo()).toBe(false);
    expect(historyManager.canRedo()).toBe(true);
    historyManager.clear();
  });

  it('clear() devuelve el historial al estado inicial', function () {
    historyManager.states = [{ id: 1 }, { id: 2 }];
    historyManager.currentIndex = 1;
    historyManager.clear();
    expect(historyManager.states.length).toBe(0);
    expect(historyManager.currentIndex).toBe(-1);
  });
});
