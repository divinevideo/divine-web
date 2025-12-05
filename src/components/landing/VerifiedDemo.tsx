// ABOUTME: Mini demo component showing ProofMode verification functionality
// ABOUTME: Displays a stock image to showcase verification features

import { Card, CardContent } from "@/components/ui/card";
import { Shield, CheckCircle2 } from "lucide-react";

export function VerifiedDemo() {
  return (
    <Card className="bg-white/50 dark:bg-black/20 backdrop-blur group hover:scale-105 transition-transform h-full">
      <CardContent className="pt-6 pb-6 h-full flex flex-col">
        <div className="flex flex-col items-center gap-3 flex-1">
          <Shield className="h-8 w-8 text-green-500 group-hover:scale-110 transition-transform flex-shrink-0" />
          <h3 className="font-semibold flex-shrink-0 text-foreground">Verified</h3>

          <div className="w-full flex-1 flex flex-col justify-center">
            {/* Stock image with verification badge */}
            <div className="relative w-4/5 mx-auto aspect-square rounded-lg shadow-md overflow-hidden">
              <img
                src="/verified-demo.avif"
                alt="Verified authentic moment"
                className="w-full h-full object-cover"
              />
              {/* Verification badge overlay */}
              <div className="absolute top-3 right-3">
                <div className="bg-green-500 text-white p-2 rounded-full shadow-lg">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              </div>
              {/* ProofMode indicator */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <div className="text-white text-xs font-semibold">
                  ProofMode Certified
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center pt-2 border-t">
              Cryptographically proven authenticity
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
