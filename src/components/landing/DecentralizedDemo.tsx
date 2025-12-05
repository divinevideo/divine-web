// ABOUTME: Mini demo component showing decentralized Nostr profile functionality
// ABOUTME: Displays a stock image to showcase decentralized features

import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export function DecentralizedDemo() {
  return (
    <Card className="bg-white/50 dark:bg-black/20 backdrop-blur group hover:scale-105 transition-transform h-full">
      <CardContent className="pt-6 pb-6 h-full flex flex-col">
        <div className="flex flex-col items-center gap-3 flex-1">
          <Users className="h-8 w-8 text-blue-500 group-hover:scale-110 transition-transform flex-shrink-0" />
          <h3 className="font-semibold flex-shrink-0">Decentralized</h3>

          <div className="w-full flex-1 flex flex-col justify-center">
            {/* Stock image with network overlay */}
            <div className="relative w-4/5 mx-auto aspect-square rounded-lg shadow-md overflow-hidden">
              <img
                src="/decentralized-demo.avif"
                alt="Decentralized network collaboration"
                className="w-full h-full object-cover"
              />
              {/* Network indicator */}
              <div className="absolute top-3 right-3">
                <div className="bg-blue-500 text-white p-2 rounded-full shadow-lg">
                  <Users className="h-5 w-5" />
                </div>
              </div>
              {/* Network nodes overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-blue-900/80 to-transparent flex items-end p-4">
                <div className="text-white space-y-1 w-full">
                  <div className="text-sm font-semibold">
                    Nostr Network
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center pt-2 border-t">
              Built on Nostr. Your content, your control
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
