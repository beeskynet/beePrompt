import { useCallback, useEffect, useRef } from "react";

//Callback = () => void;

//export default function useOnWindowRefocus(callback: Callback): void {
export default function useOnWindowRefocus(callback: any) {
  const isFocusOutOnce = useRef(false);

  const handleFocus = useCallback(() => {
    if (isFocusOutOnce) {
      callback();
    }
  }, [callback]);

  const handleBlur = () => {
    isFocusOutOnce.current = true;
  };

  useEffect(() => {
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [handleFocus]);
}
