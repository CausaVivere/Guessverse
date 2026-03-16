import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { motion, AnimatePresence, useMotionValue } from "motion/react";
import { cn } from "~/lib/utils";

export const FollowerPointerCard = ({
  children,
  className,
  title,
  cursor,
  ...props
}: {
  children: React.ReactNode;
  cursor?: boolean;
  className?: string;
  title?: string | React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [isInside, setIsInside] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    x.set(e.clientX);
    y.set(e.clientY);
  };
  const handleMouseLeave = () => {
    setIsInside(false);
  };

  const handleMouseEnter = () => {
    setIsInside(true);
  };

  const mergedStyle: React.CSSProperties = {
    ...(props.style ?? {}),
    cursor: "none",
    zIndex: isInside ? 9999 : props.style?.zIndex,
  };

  return (
    <div
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      style={mergedStyle}
      className={cn("relative", isInside ? "z-9999" : "z-0", className)}
      {...props}
    >
      {mounted
        ? createPortal(
            <AnimatePresence>
              {isInside ? (
                <FollowPointer x={x} y={y} title={title} showPointer={cursor} />
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
      {children}
    </div>
  );
};

export const FollowPointer = ({
  x,
  y,
  title,
  showPointer = true,
}: {
  x: ReturnType<typeof useMotionValue<number>>;
  y: ReturnType<typeof useMotionValue<number>>;
  showPointer?: boolean;
  title?: string | React.ReactNode;
}) => {
  const colors = [
    "#0ea5e9",
    "#737373",
    "#14b8a6",
    "#22c55e",
    "#3b82f6",
    "#ef4444",
    "#eab308",
    "#8b5cf6",
    "#ec4899",
    "#f97316",
  ];

  const color = useMemo(() => {
    return colors[Math.floor(Math.random() * colors.length)];
  }, [title]);

  return (
    <motion.div
      className="fixed h-4 w-4 rounded-full"
      style={{
        top: y,
        left: x,
        pointerEvents: "none",
        zIndex: 2147483647,
      }}
      initial={{
        scale: 1,
        opacity: 1,
      }}
      animate={{
        scale: 1,
        opacity: 1,
      }}
      exit={{
        scale: 0,
        opacity: 0,
      }}
    >
      {showPointer && (
        <svg
          stroke="currentColor"
          fill="currentColor"
          strokeWidth="1"
          viewBox="0 0 16 16"
          className="h-6 w-6 -translate-x-3 -translate-y-2.5 -rotate-70 transform stroke-red-900 text-red-500"
          height="1em"
          width="1em"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M14.082 2.182a.5.5 0 0 1 .103.557L8.528 15.467a.5.5 0 0 1-.917-.007L5.57 10.694.803 8.652a.5.5 0 0 1-.006-.916l12.728-5.657a.5.5 0 0 1 .556.103z"></path>
        </svg>
      )}
      <motion.div
        style={{
          backgroundColor: color,
        }}
        initial={{
          scale: 0.5,
          opacity: 0,
        }}
        animate={{
          scale: 1,
          opacity: 1,
        }}
        exit={{
          scale: 0.5,
          opacity: 0,
        }}
        className={
          "mt-5 max-w-56 min-w-max rounded-full bg-neutral-200 px-2 py-2 text-center text-xs text-white"
        }
      >
        {title || `William Shakespeare`}
      </motion.div>
    </motion.div>
  );
};
