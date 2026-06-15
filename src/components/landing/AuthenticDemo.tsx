// ABOUTME: Mini demo component showing authentic looping video functionality
// ABOUTME: Displays a stock image to showcase the looping video feature

import { Card, CardContent } from "@/components/ui/card";
import { Heart, Play } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

export function AuthenticDemo() {
  const { t } = useTranslation();
  return (
    <Card className="bg-white/50 dark:bg-black/20 backdrop-blur group hover:scale-105 transition-transform h-full">
      <CardContent className="pt-6 pb-6 h-full flex flex-col">
        <div className="flex flex-col items-center gap-3 flex-1">
          <Heart className="h-8 w-8 text-red-500 group-hover:scale-110 transition-transform flex-shrink-0" />
          <h3 className="font-semibold flex-shrink-0">{t('authenticDemo.title')}</h3>

          <div className="w-full flex-1 flex flex-col justify-center">
            {/* Stock image with play overlay */}
            <div className="relative w-4/5 mx-auto aspect-square rounded-lg shadow-md overflow-hidden">
              <img
                src="/authentic-demo.avif"
                alt={t('authenticDemo.imageAlt')}
                className="w-full h-full object-cover"
              />
              {/* Play overlay */}
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <div className="bg-black/40 dark:bg-black/60 rounded-full p-4 backdrop-blur-sm">
                  <Play className="h-12 w-12 text-white drop-shadow-lg group-hover:scale-110 transition-transform" fill="white" />
                </div>
              </div>
              {/* Animated loop indicator */}
              <div className="absolute bottom-3 right-3">
                <div className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="font-semibold">{t('authenticDemo.liveLabel')}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center pt-2 border-t">
              {t('authenticDemo.caption')}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
