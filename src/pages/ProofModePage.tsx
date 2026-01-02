// ABOUTME: Proofmode information page explaining how Divine.video uses cryptographic authenticity proofs to limit AI-generated content
// ABOUTME: Describes the Proofmode verification system, verification levels, and how it helps distinguish real camera captures from AI fakes

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, ShieldAlert, ShieldQuestion, Camera, Lock, Fingerprint, Video } from "lucide-react";
import { MarketingLayout } from '@/components/MarketingLayout';

export function ProofModePage() {
  return (
    <MarketingLayout>
      <div className="container max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Hero Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="h-12 w-12 text-primary" />
          <h1 className="text-4xl font-bold">Proofmode: Cryptographic Video Authenticity</h1>
        </div>
        <p className="text-xl text-muted-foreground">
          Divine.video uses cryptographic proofs to help you distinguish real camera captures from AI-generated content
        </p>
      </div>

      {/* Why Proofmode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            The Deepfake Problem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            In an era of AI-generated deepfakes and synthetic media, "seeing is believing" no longer holds true.
            Highly realistic fake videos can be produced quickly and cheaply, eroding trust in genuine footage.
          </p>
          <p>
            Traditional detection-based approaches (trying to spot visual artifacts of AI) are a losing arms race.
            As AI improves, forensic tells vanish. Instead, we need to <strong>raise the bar for authenticity</strong> by
            augmenting real videos with cryptographic provenance.
          </p>
          <div className="bg-muted p-4 rounded-lg">
            <p className="font-semibold">
              Proofmode brings a cryptographic "notarization" layer to videos, empowering observers to confidently
              distinguish real footage from AI fakes or post-processed uploads.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            How Proofmode Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Proofmode augments Nostr video events with cryptographic proof metadata that enables independent verification
            of a video's authenticity. Each proof includes:
          </p>
          <div className="grid gap-3">
            <div className="flex gap-3 items-start">
              <Fingerprint className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-semibold">Cryptographic Signatures (OpenPGP)</p>
                <p className="text-sm text-muted-foreground">
                  A signed manifest proving the video's integrity and that it hasn't been altered after capture
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <ShieldCheck className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-semibold">Device Hardware Attestation</p>
                <p className="text-sm text-muted-foreground">
                  Platform verification (Apple App Attest / Android Play Integrity) proving the video was captured on a real,
                  uncompromised device
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <Video className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
              <div>
                <p className="font-semibold">Content Hashes</p>
                <p className="text-sm text-muted-foreground">
                  SHA-256 hashes of the video file and sampled frames to detect any tampering or modification
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification Levels */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Levels</CardTitle>
          <CardDescription>
            Proofmode uses a tiered verification system to indicate different levels of authenticity assurance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex gap-4 items-start p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
              <ShieldCheck className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-green-600">Verified Mobile</Badge>
                </div>
                <p className="font-semibold">Highest Level - Full Hardware Attestation</p>
                <p className="text-sm text-muted-foreground">
                  Video captured on a secure mobile device with valid PGP signature AND device attestation.
                  This provides the strongest proof that the video was captured by a real device's camera and hasn't been altered.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <Shield className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-blue-600">Verified Web</Badge>
                </div>
                <p className="font-semibold">Medium Level - Software Verification</p>
                <p className="text-sm text-muted-foreground">
                  Video captured in a web or desktop context with valid PGP signature but no hardware attestation.
                  Proves integrity but can't guarantee the capture environment wasn't compromised.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
              <ShieldAlert className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-yellow-600 text-yellow-600">Basic Proof</Badge>
                </div>
                <p className="font-semibold">Low Level - Integrity Only</p>
                <p className="text-sm text-muted-foreground">
                  Video has a valid PGP signature proving it hasn't been modified since signing, but provides no
                  guarantee about how or where it was captured. May be an imported file or gallery video.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start p-4 border rounded-lg bg-gray-50 dark:bg-gray-950/20">
              <ShieldQuestion className="h-6 w-6 text-gray-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Unverified</Badge>
                </div>
                <p className="font-semibold">No Verification</p>
                <p className="text-sm text-muted-foreground">
                  Standard upload with no authenticity guarantees. No proof provided, or proof verification failed.
                  Could be AI-generated, edited, or simply uploaded without Proofmode.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What Proofmode Can and Cannot Prove */}
      <Card>
        <CardHeader>
          <CardTitle>What Proofmode Can and Cannot Prove</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-green-600 mb-1">✓ Proofmode CAN prove:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                <li>The video was captured by a real device's camera (not AI-generated)</li>
                <li>The video hasn't been altered or edited after capture</li>
                <li>The approximate time the video was recorded</li>
                <li>The video's content integrity through cryptographic hashes</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-red-600 mb-1">✗ Proofmode CANNOT prove:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                <li>What actually happened in the video (authenticity ≠ truthfulness)</li>
                <li>The identity of the person who recorded it</li>
                <li>The location where it was recorded (unless explicitly included)</li>
                <li>Whether the recorded scene itself was staged or genuine</li>
              </ul>
            </div>
          </div>
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm">
              <strong>Important:</strong> Proofmode proves a video is an authentic camera capture, not that the content
              is "true" or in proper context. Someone could still record a staged event and get full verification.
              Critical thinking about content remains essential.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle>Technical Details</CardTitle>
          <CardDescription>
            Proofmode extends NIP-71 video events with cryptographic proof tags
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Proofmode is implemented as an extension to Nostr's NIP-71 video event standard.
            It adds standardized tags containing proof metadata to video events (kinds 34235 and 34236).
          </p>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm overflow-x-auto">
            <div>["proof-version", "1"]</div>
            <div>["verification-level", "verified_mobile"]</div>
            <div>["proof-manifest", "&lt;base64-encoded-json&gt;"]</div>
            <div>["device-attestation", "&lt;platform-token&gt;"]</div>
            <div>["pgp-pubkey", "&lt;ascii-armored-key&gt;"]</div>
            <div>["pgp-fingerprint", "&lt;hex-fingerprint&gt;"]</div>
          </div>
          <p className="text-sm text-muted-foreground">
            Clients that don't support Proofmode will simply ignore these tags and display the video normally,
            ensuring backward compatibility with the Nostr ecosystem.
          </p>
        </CardContent>
      </Card>

      {/* Privacy Considerations */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy Considerations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Proofmode is designed to balance authenticity verification with user privacy:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
            <li>Each proof uses a fresh, ephemeral PGP key to prevent tracking across videos</li>
            <li>Location data is not included by default (users must opt-in if desired)</li>
            <li>Device attestation tokens don't reveal unique device IDs to verifiers</li>
            <li>Personal identifying information is intentionally excluded from proof metadata</li>
            <li>Users can choose lower verification levels if privacy is a greater concern than maximum authenticity</li>
          </ul>
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm">
              <strong>Trade-off:</strong> Stronger proof usually means sharing slightly more device metadata
              (like OS version). Users can decide their comfort level by choosing which verification level to use.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Get Started */}
      <Card>
        <CardHeader>
          <CardTitle>Using Proofmode on Divine.video</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Currently, Proofmode support on Divine.video is in development. When available:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-4">
            <li>Videos with Proofmode verification will display a badge indicating their verification level</li>
            <li>You can click on the badge to see detailed proof information</li>
            <li>Proofmode-enabled capture apps will automatically attach proofs when publishing to Nostr</li>
            <li>Verification happens transparently - the cryptographic checks run automatically</li>
          </ul>
          <p className="text-sm">
            For more technical details about the Proofmode specification, see the{" "}
            <a href="/proofmode-spec.html" className="text-primary hover:underline" rel="noopener noreferrer">
              full technical specification
            </a>.
          </p>
        </CardContent>
      </Card>
    </div>
    </MarketingLayout>
  );
}

export default ProofModePage;
