// jsdom nie ma AnimationEvent, a React DOM bez niego nie nasluchuje zdarzen animationend/animationstart (mapa
// przedrostkow dostawcow). Stub musi byc zaladowany PRZED react-dom (TAKTYL-36, testy A-06, A-10, A-16).
if (typeof window !== "undefined" && !("AnimationEvent" in window)) {
  class AnimationEventStub extends Event {
    animationName: string;
    elapsedTime: number;
    pseudoElement: string;
    constructor(
      type: string,
      init: {
        animationName?: string;
        elapsedTime?: number;
        pseudoElement?: string;
        bubbles?: boolean;
      } = {},
    ) {
      super(type, init);
      this.animationName = init.animationName ?? "";
      this.elapsedTime = init.elapsedTime ?? 0;
      this.pseudoElement = init.pseudoElement ?? "";
    }
  }
  Object.assign(window, { AnimationEvent: AnimationEventStub });
}
