import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen as CapacitorSplashScreen } from '@capacitor/splash-screen';

interface SplashScreenProps {
  onFinished: () => void;
  minDisplayTime?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinished,
  minDisplayTime = 2000
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeSplash = async () => {
      const startTime = Date.now();

      // Hide native splash screen on mobile
      if (Capacitor.isNativePlatform()) {
        try {
          await CapacitorSplashScreen.hide();
        } catch (error) {
          console.warn('Failed to hide native splash screen:', error);
        }
      }

      // Wait for minimum display time
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayTime - elapsed);

      setTimeout(() => {
        setIsLoading(false);
        // Add fade out time before calling onFinished
        setTimeout(() => {
          setIsVisible(false);
          onFinished();
        }, 500); // Fade out duration
      }, remainingTime);
    };

    initializeSplash();
  }, [minDisplayTime, onFinished]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-gradient-to-b from-[#0a0a0a] via-[#0d0d0d] to-[#111111] flex items-center justify-center transition-opacity duration-500 ${
        isLoading ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex flex-col items-center justify-center gap-0 px-8">
        {/* Logo with subtle animation */}
        <div className="relative animate-fade-in">
          <img
            src="/official_airaplay_logo.png"
            alt="Airaplay Logo"
            className="w-48 h-48 object-contain drop-shadow-2xl"
            style={{
              animation: 'breathe 3s ease-in-out infinite'
            }}
          />

          {/* Glow effect behind logo */}
          <div className="absolute inset-0 -z-10 blur-3xl opacity-30 bg-[#309605] scale-75 animate-pulse" />
        </div>
      </div>

      {/* Add custom keyframes via style tag */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes breathe {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.9;
          }
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
        }
      `}</style>
    </div>
  );
};
