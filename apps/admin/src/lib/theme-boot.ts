// B-627: klucz motywu i skrypt startowy (modul bez "use client", importowany przez uklad serwerowy).
export const THEME_KEY = "taktyl.admin.motyw.v1";

/** Skrypt w <head> ustawia motyw przed pierwszym malowaniem (bez mrugniecia jasnego tla). */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"ciemny":"jasny"}if(t==="ciemny"){document.documentElement.setAttribute("data-motyw","ciemny")}}catch(e){}})();`;
