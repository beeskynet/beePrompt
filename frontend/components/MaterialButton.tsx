import React, { useState } from "react";

interface MaterialButtonProps {
  name?: string;
  onClick?: () => void;
  groupHoverVisible?: string | boolean;
  disabled?: boolean;
  size?: number;
  className?: string;
  blur?: boolean;
  blurColorRga?: string;
}

function MaterialButton({ name, onClick, groupHoverVisible, disabled, size, className, blur, blurColorRga, ...props }: MaterialButtonProps) {
  const opticalSize = size ? size : 24;
  const [isBlinking, setIsBlinking] = useState(false);

  const _onClick = () => {
    if (disabled) return;
    if (onClick) onClick();
    setIsBlinking(true);
    setTimeout(() => {
      setIsBlinking(false);
    }, 50);
  };

  let visible = "";
  if (groupHoverVisible) {
    visible = groupHoverVisible === "nest" ? `group-hover/nest:visible` : "group-hover:visible";
    // `group-hover/${groupHoverVisible}:visible`とすると動かない
  }

  let blurStyle: { background: string } = { background: "" };
  if (blur) {
    blurColorRga = blurColorRga ? blurColorRga : "255, 255, 255";
    blurStyle.background = `
        linear-gradient(
          to left,
          rgba(${blurColorRga}, 1) 0%,
          rgba(${blurColorRga}, 1) 50%,
          rgba(${blurColorRga}, 0.5) 75%,
          rgba(${blurColorRga}, 0) 100%
        )
      `;
  }

  const hidden = isBlinking ? "invisible" : visible;

  return (
    <div className="flex justify-end">
      {blur ? (
        <div
          className={`${hidden} ${className}`}
          style={{
            width: `${opticalSize * 2 + 8}px`,
            height: `${opticalSize + 8}px`,
            ...blurStyle,
          }}
        />
      ) : null}
      <span
        className={`material-symbols-outlined p-1 cursor-pointer select-none ${hidden} ${className}`}
        {...props}
        onClick={_onClick}
        style={{
          fontSize: `${opticalSize}px`,
          color: !disabled ? undefined : "rgba(0, 0, 0, 0.26)",
          fontVariationSettings: `'opsz' ${opticalSize}`,
        }}
      >
        {name}
      </span>
    </div>
  );
}

export default MaterialButton;
