import { useEffect, useRef, useState } from "react";
import { useNavigation } from "react-router";

// NodeBB-style top progress bar for route transitions — meaningful here
// because React Router's client-side router (post-hydration) makes
// navigation an in-page transition, not a full reload. Delayed ~120ms
// before showing so a fast local navigation doesn't just flash the bar on
// and off; only a transition slow enough to actually notice gets one.
export function NavigationProgress() {
  const navigation = useNavigation();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (navigation.state !== "idle") {
      clearTimeout(hideTimer.current);
      showTimer.current = setTimeout(() => {
        setVisible(true);
        setWidth(90);
      }, 120);
    } else {
      clearTimeout(showTimer.current);
      setVisible((wasVisible) => {
        if (wasVisible) {
          setWidth(100);
          hideTimer.current = setTimeout(() => {
            setVisible(false);
            setWidth(0);
          }, 200);
        }
        return wasVisible;
      });
    }
    return () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
    };
  }, [navigation.state]);

  return (
    <div
      aria-hidden="true"
      className="nav-progress fixed inset-x-0 top-0 z-50 h-0.5 bg-accent"
      style={{ width: `${width}%`, opacity: visible ? 1 : 0 }}
    />
  );
}
